from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import joinedload

from app.core.deps import DbSession, VerifiedUser
from app.models.child import Child
from app.models.parent import Parent
from app.schemas.child import ParentLookupChild, ParentLookupResponse, ParentResponse
from app.services.child_service import find_parent_by_phone

router = APIRouter()


@router.get("/lookup/by-phone", response_model=ParentLookupResponse | None)
def lookup_parent_by_phone(
    phone: str = Query(min_length=7),
    db: DbSession = ...,
    current_user: VerifiedUser = ...,
) -> ParentLookupResponse | None:
    parent = find_parent_by_phone(db, phone)
    if not parent:
        return None

    children = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.parent_id == parent.id, Child.is_active.is_(True))
        .all()
    )
    return ParentLookupResponse(
        id=str(parent.id),
        first_name=parent.first_name,
        last_name=parent.last_name,
        phone=parent.phone,
        alternative_phone=parent.alternative_phone,
        email=parent.email,
        address=parent.address,
        children=[
            ParentLookupChild(
                id=str(c.id),
                child_code=c.child_code,
                full_name=c.full_name,
                class_name=c.class_.name,
                is_active=c.is_active,
            )
            for c in children
        ],
    )


@router.get("", response_model=list[ParentResponse])
def list_parents(
    db: DbSession,
    current_user: VerifiedUser,
    q: str | None = Query(default=None),
) -> list[ParentResponse]:
    query = db.query(Parent)
    if q:
        search = f"%{q}%"
        query = query.filter(
            Parent.first_name.ilike(search)
            | Parent.last_name.ilike(search)
            | Parent.phone.ilike(search)
            | Parent.email.ilike(search)
        )
    parents = query.order_by(Parent.last_name, Parent.first_name).limit(100).all()
    return [
        ParentResponse(
            id=str(p.id),
            first_name=p.first_name,
            last_name=p.last_name,
            phone=p.phone,
            alternative_phone=p.alternative_phone,
            email=p.email,
            address=p.address,
            created_at=p.created_at.isoformat(),
        )
        for p in parents
    ]


@router.get("/{parent_id}", response_model=dict)
def get_parent(parent_id: str, db: DbSession, current_user: VerifiedUser) -> dict:
    parent = db.query(Parent).filter(Parent.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

    children = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.parent_id == parent.id)
        .all()
    )
    return {
        "id": str(parent.id),
        "first_name": parent.first_name,
        "last_name": parent.last_name,
        "phone": parent.phone,
        "alternative_phone": parent.alternative_phone,
        "email": parent.email,
        "address": parent.address,
        "created_at": parent.created_at.isoformat(),
        "children": [
            {
                "id": str(c.id),
                "child_code": c.child_code,
                "full_name": c.full_name,
                "class_name": c.class_.name,
                "is_active": c.is_active,
            }
            for c in children
        ],
    }
