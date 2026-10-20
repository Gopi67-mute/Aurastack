"""Clerk JWT verification.

Verifies the bearer token locally against Clerk's JWKS endpoint (derived from
CLERK_JWT_ISSUER) instead of calling the Clerk Backend API on every request.
`PyJWKClient` caches the signing keys internally. The resolved `sub` claim is
the Clerk user id and is the only trusted source of identity for every
protected route — a client-supplied userId is never accepted.
"""

from functools import lru_cache

import jwt
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient

from app.core.config import get_settings


@lru_cache
def _jwks_client() -> PyJWKClient:
    settings = get_settings()
    jwks_url = f"{settings.clerk_jwt_issuer.rstrip('/')}/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True)


async def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_jwt_issuer,
            audience=settings.jwt_audience or None,
            options={"verify_aud": bool(settings.jwt_audience)},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token missing subject claim")

    return user_id
