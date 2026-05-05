"""
CPAP Dashboard MCP Server — HTTP/SSE transport

For use with Claude.ai (web UI) and other remote MCP clients.
The stdio version (mcp_server.py) is still used for Claude Code locally.

Usage:
    python3.13 api/mcp_server_http.py

Environment variables:
    CPAP_API_URL      Base URL of the CPAP API (default: http://localhost:8000)
    CPAP_API_TOKEN    Pre-obtained JWT (preferred; tokens last 30 days)
    CPAP_EMAIL        Login email (used if no token)
    CPAP_PASSWORD     Login password (used if no token)
    MCP_PORT          Port to listen on (default: 8001)
    MCP_HOST          Host to bind to (default: 0.0.0.0)
"""

import json
import os

import httpx
import uvicorn
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import TextContent, Tool
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Mount, Route

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_URL = os.environ.get("CPAP_API_URL", "http://localhost:8000").rstrip("/")
API_TOKEN = os.environ.get("CPAP_API_TOKEN", "")
CPAP_EMAIL = os.environ.get("CPAP_EMAIL", "")
CPAP_PASSWORD = os.environ.get("CPAP_PASSWORD", "")
MCP_PORT = int(os.environ.get("MCP_PORT", "8001"))
MCP_HOST = os.environ.get("MCP_HOST", "0.0.0.0")

_cached_token: str = API_TOKEN

# ---------------------------------------------------------------------------
# HTTP helpers (identical to stdio version)
# ---------------------------------------------------------------------------


def _resolve_token() -> str:
    global _cached_token
    if _cached_token:
        return _cached_token
    if not CPAP_EMAIL or not CPAP_PASSWORD:
        return ""
    resp = httpx.post(
        f"{API_URL}/auth/login",
        json={"email": CPAP_EMAIL, "password": CPAP_PASSWORD},
        timeout=15,
    )
    if resp.status_code == 200:
        _cached_token = resp.json()["token"]
    return _cached_token


def _get(path: str, params: dict | None = None) -> str:
    token = _resolve_token()
    if not token:
        return (
            "Error: no authentication configured. "
            "Set CPAP_API_TOKEN or CPAP_EMAIL + CPAP_PASSWORD."
        )
    try:
        resp = httpx.get(
            f"{API_URL}{path}",
            params={k: v for k, v in (params or {}).items() if v is not None},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    except httpx.ConnectError:
        return f"Error: cannot reach CPAP API at {API_URL}. Is the server running?"
    if resp.status_code == 404:
        return f"Not found: {path}"
    if resp.status_code == 401:
        return "Error: authentication failed. Check your CPAP_API_TOKEN or credentials."
    if not resp.is_success:
        return f"Error {resp.status_code}: {resp.text}"
    return json.dumps(resp.json(), indent=2)


def _text(content: str) -> list[TextContent]:
    return [TextContent(type="text", text=content)]


# ---------------------------------------------------------------------------
# MCP server (identical tool definitions to stdio version)
# ---------------------------------------------------------------------------

server = Server("cpap-dashboard")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_dashboard_summary",
            description=(
                "Get overall CPAP therapy stats: total nights, compliance percentage, "
                "average AHI, average pressure, event type breakdown (central apnea, "
                "obstructive apnea, hypopnea), and the last 90 nights of AHI trend data. "
                "Use this first to understand the big picture."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="list_sessions",
            description=(
                "List sleep sessions with summary stats (date, AHI, event counts, "
                "pressure, duration). Use date_from/date_to (YYYY-MM-DD) to filter a "
                "range; use page/per_page for pagination. Returns session IDs needed "
                "for the detail/events/metrics tools."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "page": {"type": "integer", "default": 1},
                    "per_page": {"type": "integer", "default": 20},
                    "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                },
            },
        ),
        Tool(
            name="get_session_detail",
            description=(
                "Get full details for a single sleep session by its UUID. Includes "
                "respiratory rate, tidal volume, minute ventilation, snore index, flow "
                "limitation, SpO2 averages, and device serial. "
                "Get a session ID from list_sessions first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {
                        "type": "string",
                        "description": "UUID from list_sessions",
                    }
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_session_events",
            description=(
                "Get timestamped respiratory events (central apnea, obstructive apnea, "
                "hypopnea, arousal) for a session. Each event has a type, onset in "
                "seconds from start, duration, and absolute datetime. Useful for "
                "understanding when events clustered during the night. May return many "
                "rows for active nights — prefer get_session_detail for counts only."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "UUID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_session_metrics",
            description=(
                "Get time-series pressure, leak, respiratory rate, tidal volume, and "
                "other signals for a session as columnar arrays. "
                "downsample controls resolution: 1=2s intervals (very large), "
                "15=30s intervals, 30=1-minute intervals (default, ~300 points for 5h). "
                "Use higher values unless fine-grained analysis is needed."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "UUID"},
                    "downsample": {
                        "type": "integer",
                        "default": 30,
                        "minimum": 1,
                        "maximum": 120,
                    },
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_session_spo2",
            description=(
                "Get SpO2 (blood oxygen saturation) and pulse rate time series for a "
                "session. Returns timestamps, SpO2 percent, and pulse BPM. Only "
                "available when has_spo2 is true — check get_session_detail first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "UUID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_ai_summary",
            description=(
                "Get a server-generated AI summary (via OpenAI) for the last N days "
                "of therapy. Returns insights, what's going well, what's not, and "
                "recommended changes. Requires OPENAI_API_KEY on the server."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "default": 30, "minimum": 1}
                },
            },
        ),
        Tool(
            name="get_trend_analysis",
            description=(
                "Get a server-generated AI analysis of AHI trend direction over the "
                "last 30 nights: improving/stable/worsening/variable, anomalies "
                "(e.g. 3+ consecutive bad nights), and a severity flag. "
                "Requires OPENAI_API_KEY on the server."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="get_session_breath",
            description=(
                "Get full 2-second resolution metrics for a specific time window within a session. "
                "Use offset_minutes to seek into the night and window_minutes (1-60, default 10) "
                "to control the window size. Each window returns ~300 rows at 2s intervals. "
                "Use this to analyse breath-by-breath patterns around events — e.g. set "
                "offset_minutes to just before an apnea cluster to see pressure, tidal volume, "
                "resp rate, and flow limitation at full resolution. Combine with get_session_events "
                "to find onset_seconds of events, then convert to minutes for the offset."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "UUID"},
                    "offset_minutes": {
                        "type": "integer",
                        "default": 0,
                        "minimum": 0,
                        "description": "Minutes from session start",
                    },
                    "window_minutes": {
                        "type": "integer",
                        "default": 10,
                        "minimum": 1,
                        "maximum": 60,
                        "description": "Window length in minutes",
                    },
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="check_server_health",
            description=(
                "Check whether the CPAP API server is reachable and running. "
                "Use this if other tools are returning connection errors."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "get_dashboard_summary":
        return _text(_get("/stats/summary"))

    if name == "list_sessions":
        return _text(
            _get(
                "/sessions/",
                {
                    "page": arguments.get("page", 1),
                    "per_page": arguments.get("per_page", 20),
                    "date_from": arguments.get("date_from"),
                    "date_to": arguments.get("date_to"),
                },
            )
        )

    if name == "get_session_detail":
        sid = arguments["session_id"]
        return _text(_get(f"/sessions/{sid}"))

    if name == "get_session_events":
        sid = arguments["session_id"]
        return _text(_get(f"/sessions/{sid}/events"))

    if name == "get_session_metrics":
        sid = arguments["session_id"]
        return _text(
            _get(f"/sessions/{sid}/metrics", {"downsample": arguments.get("downsample", 30)})
        )

    if name == "get_session_spo2":
        sid = arguments["session_id"]
        return _text(_get(f"/sessions/{sid}/spo2"))

    if name == "get_ai_summary":
        return _text(_get("/stats/ai-summary", {"days": arguments.get("days", 30)}))

    if name == "get_trend_analysis":
        return _text(_get("/stats/trend-ai"))

    if name == "get_session_breath":
        sid = arguments["session_id"]
        return _text(
            _get(f"/sessions/{sid}/breath", {
                "offset_minutes": arguments.get("offset_minutes", 0),
                "window_minutes": arguments.get("window_minutes", 10),
            })
        )

    if name == "check_server_health":
        try:
            resp = httpx.get(f"{API_URL}/health", timeout=5)
            return _text(json.dumps(resp.json(), indent=2))
        except httpx.ConnectError:
            return _text(f"Error: cannot reach {API_URL}")

    return _text(f"Unknown tool: {name}")


# ---------------------------------------------------------------------------
# SSE transport / Starlette app
# ---------------------------------------------------------------------------

sse = SseServerTransport("/messages/")


async def handle_sse(request: Request) -> Response:
    async with sse.connect_sse(
        request.scope, request.receive, request._send
    ) as streams:
        await server.run(streams[0], streams[1], server.create_initialization_options())
    return Response()


app = Starlette(
    routes=[
        Route("/sse", endpoint=handle_sse),
        Mount("/messages/", app=sse.handle_post_message),
    ]
)

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"CPAP MCP server running at http://{MCP_HOST}:{MCP_PORT}/sse")
    uvicorn.run(app, host=MCP_HOST, port=MCP_PORT)
