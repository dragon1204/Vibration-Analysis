"""Passwords (bcrypt) and JWT tokens (spec 6.6, 6.8)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

ROLE_RANK = {"viewer": 1, "operator": 2, "engineer": 3, "analyst": 4, "admin": 5}


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(24)


def create_token(secret: str, user_id: int, kind: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "typ": kind, "iat": now, "exp": now + ttl}, secret, algorithm="HS256")


def decode_token(secret: str, token: str, kind: str) -> int | None:
    try:
        p = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if p.get("typ") != kind:
        return None
    return int(p["sub"])
