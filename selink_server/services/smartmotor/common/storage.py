"""MinIO object storage for waveforms, spectra, models and reports (ADR-08)."""
from __future__ import annotations

import asyncio
import io
from datetime import datetime, timedelta

from minio import Minio
from minio.error import S3Error

from .settings import Settings


class Storage:
    def __init__(self, s: Settings):
        self.bucket = s.minio_bucket
        self.client = Minio(s.minio_endpoint, access_key=s.minio_access_key, secret_key=s.minio_secret_key,
                            secure=s.minio_secure)

    async def ensure_bucket(self) -> None:
        def _do():
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        await asyncio.to_thread(_do)

    async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        await asyncio.to_thread(self.client.put_object, self.bucket, key, io.BytesIO(data), len(data),
                                content_type=content_type)
        return key

    async def get(self, key: str) -> bytes | None:
        def _do():
            try:
                r = self.client.get_object(self.bucket, key)
                try:
                    return r.read()
                finally:
                    r.close()
                    r.release_conn()
            except S3Error as e:
                if e.code in ("NoSuchKey", "NoSuchObject"):
                    return None
                raise
        return await asyncio.to_thread(_do)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.remove_object, self.bucket, key)

    async def presigned(self, key: str, hours: int = 1) -> str:
        return await asyncio.to_thread(self.client.presigned_get_object, self.bucket, key, timedelta(hours=hours))

    async def presigned_put(self, key: str, hours: int = 1) -> str:
        return await asyncio.to_thread(self.client.presigned_put_object, self.bucket, key, timedelta(hours=hours))


def capture_key(kind: str, point: str, ts: datetime, capture_id: str, ext: str) -> str:
    """raw/<point>/<yyyy>/<mm>/<dd>/<capture_id>.bin.gz (spec 6.2)."""
    return f"{kind}/{point}/{ts:%Y/%m/%d}/{capture_id}{ext}"
