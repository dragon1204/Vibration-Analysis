"""Upload an edge.yaml as the gateway's versioned configuration and publish it (retained).

    python -m smartmotor.tools.push_config /path/edge.yaml [--gateway hem-gw-01]

Secrets (mqtt password, storage paths) stay local on the gateway: the edge keeps its own
`mqtt` and `storage` sections when applying a downlink config.
"""
import argparse
import asyncio
import json

import yaml

from ..common import gwconfig
from ..common.db import create_pool
from ..common.settings import get_settings


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("yaml_file")
    ap.add_argument("--gateway")
    a = ap.parse_args()
    with open(a.yaml_file, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    cfg = json.loads(json.dumps(cfg, default=str))
    cfg.get("mqtt", {}).pop("password", None)
    gw = a.gateway or cfg["gateway"]["id"]
    s = get_settings()
    pool = await create_pool(s.db_url, max_size=2)
    async with pool.acquire() as c:
        merged = await gwconfig.merge_managed(c, cfg)
    ver = await gwconfig.save_and_publish(pool, s, gw, merged, "push_config")
    await pool.close()
    print(f"gateway {gw}: config version {ver} stored and published")


if __name__ == "__main__":
    asyncio.run(main())
