import os
import time

from sqlalchemy import create_engine, text


database_url = os.environ["DATABASE_URL"]
deadline = time.time() + 60

while True:
    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[startup] database is ready")
        break
    except Exception as exc:
        if time.time() >= deadline:
            raise RuntimeError(f"Database did not become ready in time: {exc}") from exc
        print(f"[startup] waiting for database: {exc}")
        time.sleep(2)
