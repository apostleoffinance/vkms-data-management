from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.config import get_settings


def require_kiosk_access(request: Request) -> None:
    settings = get_settings()
    if not settings.KIOSK_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parent kiosk is not enabled",
        )
    if settings.KIOSK_TOKEN:
        token = request.headers.get("X-Kiosk-Token") or request.query_params.get("token")
        if token != settings.KIOSK_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid kiosk access token",
            )


KioskAccess = Annotated[None, Depends(require_kiosk_access)]
