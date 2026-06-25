import uuid

from fastapi import APIRouter, HTTPException, status

from app.core.deps import AdminUser, DbSession, VerifiedUser
from app.models.class_model import Class
from app.schemas.child import ClassCreate, ClassResponse, ClassUpdate
from app.services.audit import log_audit

router = APIRouter()


def _class_response(cls: Class) -> ClassResponse:
    return ClassResponse(
        id=str(cls.id),
        name=cls.name,
        description=cls.description,
        min_age=cls.min_age,
        max_age=cls.max_age,
        created_at=cls.created_at.isoformat(),
    )


@router.get("", response_model=list[ClassResponse])
def list_classes(db: DbSession, current_user: VerifiedUser) -> list[ClassResponse]:
    classes = db.query(Class).order_by(Class.min_age).all()
    return [_class_response(c) for c in classes]


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(body: ClassCreate, db: DbSession, admin: AdminUser) -> ClassResponse:
    existing = db.query(Class).filter(Class.name == body.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class already exists")
    if body.min_age > body.max_age:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="min_age cannot exceed max_age"
        )

    cls = Class(
        name=body.name,
        description=body.description,
        min_age=body.min_age,
        max_age=body.max_age,
    )
    db.add(cls)
    db.commit()
    db.refresh(cls)
    log_audit(db, "create", "class", user_id=admin.id, resource_id=str(cls.id))
    return _class_response(cls)


@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: uuid.UUID, body: ClassUpdate, db: DbSession, admin: AdminUser
) -> ClassResponse:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    if body.name is not None:
        cls.name = body.name
    if body.description is not None:
        cls.description = body.description
    if body.min_age is not None:
        cls.min_age = body.min_age
    if body.max_age is not None:
        cls.max_age = body.max_age

    db.commit()
    db.refresh(cls)
    log_audit(db, "update", "class", user_id=admin.id, resource_id=str(cls.id))
    return _class_response(cls)
