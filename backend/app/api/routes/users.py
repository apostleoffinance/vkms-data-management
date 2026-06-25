import uuid

from fastapi import APIRouter, HTTPException, status

from app.core.deps import AdminUser, DbSession
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.auth import ResetPasswordRequest, UserCreate, UserResponse, UserUpdate
from app.schemas.common import MessageResponse
from app.services.audit import log_audit

router = APIRouter()


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


@router.get("", response_model=list[UserResponse])
def list_users(db: DbSession, admin: AdminUser) -> list[UserResponse]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_response(u) for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, db: DbSession, admin: AdminUser) -> UserResponse:
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        password_hash=get_password_hash(body.password),
        role=role,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_audit(db, "create", "user", user_id=admin.id, resource_id=str(user.id))
    return _user_response(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: uuid.UUID, body: UserUpdate, db: DbSession, admin: AdminUser
) -> UserResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.first_name is not None:
        user.first_name = body.first_name
    if body.last_name is not None:
        user.last_name = body.last_name
    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        try:
            user.role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    if body.is_active is not None:
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)
    log_audit(db, "update", "user", user_id=admin.id, resource_id=str(user.id))
    return _user_response(user)


@router.post("/{user_id}/reset-password", response_model=MessageResponse)
def reset_password(
    user_id: uuid.UUID,
    body: ResetPasswordRequest,
    db: DbSession,
    admin: AdminUser,
) -> MessageResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(body.new_password)
    user.must_change_password = True
    db.commit()
    log_audit(db, "reset_password", "user", user_id=admin.id, resource_id=str(user.id))
    return MessageResponse(message="Password reset successfully")
