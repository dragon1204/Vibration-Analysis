"""FastAPI application (spec 6.6): REST under /api/v1, WebSocket at /ws, OpenAPI at /api/v1/docs."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .. import __version__
from ..common import bus
from ..common.db import create_pool, migrate, migrations_dir
from ..common.logs import setup
from ..common.settings import get_settings
from ..common.storage import Storage
from . import ws
from .routers import accuracy, auth, events, gateways, internal, machines, overview, points, settings_rt
from .security import hash_password

log = logging.getLogger("api")


async def bootstrap_admin(pool, s) -> None:
    """Create the first admin account (ADMIN_EMAIL/ADMIN_PASSWORD) if no user exists."""
    async with pool.acquire() as c:
        if await c.fetchval("SELECT count(*) FROM users"):
            return
        uid = await c.fetchval("INSERT INTO users (email, name, password_hash) VALUES ($1, 'Quản trị', $2) RETURNING id",
                               s.admin_email, hash_password(s.admin_password))
        await c.execute("INSERT INTO user_roles (user_id, tenant_id, site_id, role) VALUES ($1, NULL, NULL, 'admin')", uid)
        await c.execute("INSERT INTO notification_prefs (user_id, channel, min_severity) VALUES ($1, 'email', 'warning')", uid)
    log.warning("created bootstrap admin %s – change the password", s.admin_email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    setup(s.log_level)
    app.state.settings = s
    app.state.pool = await create_pool(s.db_url, max_size=15)
    await migrate(app.state.pool, migrations_dir(s.migrations_dir))
    await bootstrap_admin(app.state.pool, s)
    app.state.redis = bus.connect(s.redis_url)
    app.state.storage = Storage(s)
    try:
        await app.state.storage.ensure_bucket()
    except Exception as e:  # MinIO may start later; endpoints retry on use
        log.warning("minio not ready: %s", e)
    yield
    await app.state.pool.close()
    await app.state.redis.aclose()


app = FastAPI(title="Smart Motor API", version=__version__, lifespan=lifespan,
              docs_url="/api/v1/docs", openapi_url="/api/v1/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth, overview, machines, points, events, gateways, settings_rt, accuracy, internal):
    app.include_router(r.router, prefix="/api/v1")
app.include_router(ws.router)


@app.get("/api/v1/health", include_in_schema=False)
async def health():
    async with app.state.pool.acquire() as c:
        await c.fetchval("SELECT 1")
    await app.state.redis.ping()
    return {"ok": True, "version": __version__}
