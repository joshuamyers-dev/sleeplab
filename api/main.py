import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth as auth_router
from .routers import sessions, stats, upload, ai_summary, llm
from .env import load_env

load_env()

app = FastAPI(title="SleepLab API", version="1.0.0")


def _get_allowed_origins() -> List[str]:
    configured = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
    if configured:
        if configured == "*":
            return ["*"]
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(ai_summary.router, prefix="/stats", tags=["stats"])
app.include_router(llm.router, prefix="/llm", tags=["llm"])


@app.get("/health")
def health():
    return {"status": "ok"}
