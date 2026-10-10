from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from ...common.settings import Settings, get_settings
from ..deps import User, current_user
from ..security import create_token, decode_token, verify_password

router = APIRouter(tags=["auth"])

REFRESH_COOKIE = "sm_refresh"


class LoginIn(BaseModel):
    email: str
    password: str


def _tokens(s: Settings, resp: Response, uid: int) -> dict:
    access = create_token(s.jwt_secret, uid, "access", timedelta(minutes=s.jwt_access_minutes))
    refresh = create_token(s.jwt_secret, uid, "refresh", timedelta(days=s.jwt_refresh_days))
    resp.set_cookie(REFRESH_COOKIE, refresh, httponly=True, samesite="strict", secure=s.public_base_url.startswith("https"),
                    max_age=s.jwt_refresh_days * 86400, path="/api/v1/auth")
    return {"access_token": access, "token_type": "bearer", "expires_in": s.jwt_access_minutes * 60}


@router.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response, s: Settings = Depends(get_settings)):
    r = request.app.state.redis
    ip = request.client.host if request.client else "?"
    key = f"login:{ip}"
    n = await r.incr(key)
    if n == 1:
        await r.expire(key, 300)
    if n > 10:
        raise HTTPException(429, "Quá nhiều lần đăng nhập, thử lại sau 5 phút")
    async with request.app.state.pool.acquire() as c:
        u = await c.fetchrow("SELECT id, password_hash FROM users WHERE lower(email)=lower($1) AND active", body.email)
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Sai email hoặc mật khẩu")
    await r.delete(key)
    return _tokens(s, response, u["id"])


@router.post("/auth/refresh")
async def refresh(request: Request, response: Response, s: Settings = Depends(get_settings)):
    tok = request.cookies.get(REFRESH_COOKIE)
    uid = decode_token(s.jwt_secret, tok, "refresh") if tok else None
    if uid is None:
        raise HTTPException(401, "Phiên đăng nhập hết hạn")
    return _tokens(s, response, uid)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.max_role, "roles": user.roles,
            "sites": user.sites()}
