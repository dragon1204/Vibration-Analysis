"""One-shot MQTT publishing used by api/analytics (commands, retained config)."""
from __future__ import annotations

import json
from urllib.parse import urlparse

import aiomqtt

from .settings import Settings


async def publish(s: Settings, topic: str, payload, qos: int = 1, retain: bool = False, client_id: str = "") -> None:
    u = urlparse(s.mqtt_url)
    tls = u.scheme in ("mqtts", "ssl")
    data = payload if isinstance(payload, (bytes, str)) else json.dumps(payload, ensure_ascii=False, default=str)
    async with aiomqtt.Client(hostname=u.hostname, port=u.port or (8883 if tls else 1883),
                              username=s.mqtt_ingest_user, password=s.mqtt_ingest_pass,
                              identifier=client_id or None, tls_params=aiomqtt.TLSParameters() if tls else None) as c:
        await c.publish(topic, data, qos=qos, retain=retain)


def gateway_prefix(s: Settings, tenant: str, site: str, gateway: str) -> str:
    return f"{s.mqtt_topic_root}/{tenant}/{site}/{gateway}/"
