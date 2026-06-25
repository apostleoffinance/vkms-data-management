import logging
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.config import get_settings
from app.core.deps import CurrentUser, DbSession
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserResponse
from app.schemas.common import MessageResponse
from app.services.audit import log_audit

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role.value,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        created_at=user.created_at.isoformat(),
    )


@router.post("/login", response_model=TokenResponse)
def login(request: Request, response: Response, body: LoginRequest, db: DbSession) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    token = create_access_token(
        {"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    client_ip = request.client.host if request.client else None
    log_audit(db, "login", "user", user_id=user.id, resource_id=str(user.id), ip_address=client_ip)

    return TokenResponse(access_token=token, must_change_password=user.must_change_password)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response, current_user: CurrentUser, db: DbSession) -> MessageResponse:
    response.delete_cookie(key="access_token", path="/")
    log_audit(db, "logout", "user", user_id=current_user.id, resource_id=str(current_user.id))
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser) -> UserResponse:
    return _user_response(current_user)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> MessageResponse:
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = get_password_hash(body.new_password)
    current_user.must_change_password = False
    db.commit()
    log_audit(db, "change_password", "user", user_id=current_user.id, resource_id=str(current_user.id))
    return MessageResponse(message="Password changed successfully")
