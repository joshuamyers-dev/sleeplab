from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth as auth_router
from .routers import sessions, stats, upload, ai_summary

app = FastAPI(title="SleepLab API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(ai_summary.router, prefix="/stats", tags=["stats"])


@app.get("/health")
def health():
    return {"status": "ok"}
