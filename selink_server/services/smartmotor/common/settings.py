"""Environment configuration (spec 6.1 ".env")."""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    db_url: str = "postgresql://smartmotor:smartmotor@db:5432/smartmotor"
    redis_url: str = "redis://redis:6379/0"
    mqtt_url: str = "mqtt://emqx:1883"
    mqtt_ingest_user: str = "svc-ingest"
    mqtt_ingest_pass: str = "change-me"
    mqtt_topic_root: str = "sm/v1"

    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "smartmotor"
    minio_secret_key: str = "change-me-minio"
    minio_bucket: str = "smartmotor"
    minio_secure: bool = False

    jwt_secret: str = "change-me-jwt"
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7

    admin_email: str = "admin@selink.vn"
    admin_password: str = "admin123"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "smartmotor@selink.vn"
    zalo_oa_token: str = ""
    telegram_bot_token: str = ""
    sms_url: str = ""
    sms_token: str = ""
    public_base_url: str = "http://localhost"

    migrations_dir: str = "/app/db/migrations"
    log_level: str = "INFO"
    timezone: str = "Asia/Ho_Chi_Minh"

    @model_validator(mode="after")
    def reject_unsafe_production_secrets(self):
        """Fail fast instead of accidentally starting production with sample secrets."""
        if self.app_env.lower() != "production":
            return self
        secrets = {
            "MQTT_INGEST_PASS": self.mqtt_ingest_pass,
            "MINIO_SECRET_KEY": self.minio_secret_key,
            "JWT_SECRET": self.jwt_secret,
            "ADMIN_PASSWORD": self.admin_password,
        }
        unsafe = [
            name for name, value in secrets.items()
            if len(value) < 16 or "change-me" in value.lower() or value.lower() == "admin123"
        ]
        if unsafe:
            raise ValueError(f"unsafe production secret(s): {', '.join(unsafe)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
