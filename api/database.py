import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .env import load_env


load_env()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg2://cpap:cpap@localhost:5432/cpap")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
