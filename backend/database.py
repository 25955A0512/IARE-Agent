"""
database.py — Async SQLAlchemy engine and session factory for IARE Agent.

Uses Supabase PostgreSQL when SUPABASE_DB_URL is configured, or falls back to
a local SQLite file for offline development/testing.
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import SQLITE_FALLBACK_PATH, SUPABASE_DB_URL

logger = logging.getLogger(__name__)


def _build_db_url() -> str:
    """Return the database URL to use, applying the SQLite fallback if needed."""
    if SUPABASE_DB_URL:
        logger.info("Database: using Supabase PostgreSQL")
        return SUPABASE_DB_URL
    fallback = f"sqlite+aiosqlite:///{SQLITE_FALLBACK_PATH}"
    logger.warning(
        "SUPABASE_DB_URL not set — falling back to local SQLite: %s", SQLITE_FALLBACK_PATH
    )
    return fallback


DB_URL = _build_db_url()

# aiosqlite requires check_same_thread=False; ignored for asyncpg (Postgres).
_connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}

engine = create_async_engine(
    DB_URL,
    echo=False,          # Set to True to log all SQL (noisy but useful for debugging)
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        yield session


async def create_all_tables() -> None:
    """Create all tables defined in models.py (idempotent — safe to call on startup)."""
    # Import models so their metadata is registered before create_all.
    import models  # noqa: F401 (side-effect import)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified / created.")
