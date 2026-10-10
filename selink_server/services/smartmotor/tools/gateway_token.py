"""Set or rotate a gateway's MQTT token.

    python -m smartmotor.tools.gateway_token <gateway_id> [--token TOKEN]

Prints the token once; write it to /etc/edge-agent/mqtt.token on the T153.
"""
import argparse
import asyncio

import asyncpg

from ..api.security import hash_password, new_token
from ..common.settings import get_settings


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("gateway_id")
    ap.add_argument("--token", help="use this token instead of a random one (dev only)")
    a = ap.parse_args()
    token = a.token or new_token()
    conn = await asyncpg.connect(get_settings().db_url)
    n = await conn.execute("UPDATE gateways SET mqtt_username=id, mqtt_password_hash=$2 WHERE id=$1", a.gateway_id, hash_password(token))
    await conn.close()
    if n.endswith(" 0"):
        raise SystemExit(f"gateway {a.gateway_id} not found (create it via POST /api/v1/gateways or seed SQL)")
    print(f"username={a.gateway_id}\ntoken={token}")


if __name__ == "__main__":
    asyncio.run(main())
