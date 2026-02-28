from pathlib import Path

from sqlalchemy import text

from api.database import engine
from api.main import app  # noqa: F401 — imported for uvicorn


def run_migrations() -> None:
    migrations_dir = Path(__file__).parent / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))

    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        conn.commit()

        for path in sql_files:
            filename = path.name
            already_applied = conn.execute(
                text("SELECT 1 FROM schema_migrations WHERE filename = :f"),
                {"f": filename},
            ).fetchone()

            if already_applied:
                continue

            print(f"[migrations] applying {filename}")
            conn.execute(text(path.read_text()))
            conn.execute(
                text("INSERT INTO schema_migrations (filename) VALUES (:f)"),
                {"f": filename},
            )
            conn.commit()
            print(f"[migrations] applied {filename}")


run_migrations()
