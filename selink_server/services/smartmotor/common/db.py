"""PostgreSQL/TimescaleDB access (asyncpg) and SQL migrations."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import asyncpg

log = logging.getLogger(__name__)


async def _init_conn(conn: asyncpg.Connection) -> None:
    for typ in ("json", "jsonb"):
        await conn.set_type_codec(typ, encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def create_pool(dsn: str, min_size: int = 1, max_size: int = 10) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn, min_size=min_size, max_size=max_size, init=_init_conn)


async def migrate(pool: asyncpg.Pool, directory: str) -> list[str]:
    """Apply *.sql files in order, once each. Each file runs as one simple-query
    batch; files containing statements that cannot run in a transaction (continuous
    aggregates) must contain a single statement."""
    applied: list[str] = []
    files = sorted(p for p in Path(directory).glob("*.sql"))
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_advisory_lock(727001)")
        try:
            await conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())"
            )
            done = {r["name"] for r in await conn.fetch("SELECT name FROM schema_migrations")}
            for f in files:
                if f.name in done:
                    continue
                log.info("applying migration %s", f.name)
                await conn.execute(f.read_text(encoding="utf-8"))
                await conn.execute("INSERT INTO schema_migrations(name) VALUES($1)", f.name)
                applied.append(f.name)
        finally:
            await conn.execute("SELECT pg_advisory_unlock(727001)")
    return applied


def migrations_dir(default: str) -> str:
    if os.path.isdir(default):
        return default
    here = Path(__file__).resolve()
    for parent in here.parents:
        cand = parent / "db" / "migrations"
        if cand.is_dir():
            return str(cand)
    return default


def records(rows) -> list[dict]:
    return [dict(r) for r in rows]
