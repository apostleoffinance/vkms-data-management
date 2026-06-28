import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.core.deps import AdminUser, DbSession, VerifiedUser
from app.models.authorized_pickup_contact import AuthorizedPickupContact
from app.models.child import Child
from app.schemas.authorized_pickup import (
    AuthorizedPickupCreate,
    AuthorizedPickupResponse,
    AuthorizedPickupUpdate,
)
from app.services.audit import log_audit
from app.services.photo_service import decode_photo_base64, process_upload_photo
from app.services.pickup_service import (
    contact_to_dict,
    create_contact,
    list_contacts_for_child,
)

router = APIRouter()


def _response(contact: AuthorizedPickupContact) -> AuthorizedPickupResponse:
    return AuthorizedPickupResponse(**contact_to_dict(contact))


@router.get("/children/{child_id}", response_model=list[AuthorizedPickupResponse])
def list_child_pickups(
    child_id: uuid.UUID,
    db: DbSession,
    current_user: VerifiedUser,
) -> list[AuthorizedPickupResponse]:
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    return [_response(c) for c in list_contacts_for_child(db, child_id)]


@router.post("/children/{child_id}", response_model=AuthorizedPickupResponse, status_code=status.HTTP_201_CREATED)
def create_child_pickup(
    child_id: uuid.UUID,
    body: AuthorizedPickupCreate,
    db: DbSession,
    current_user: VerifiedUser,
) -> AuthorizedPickupResponse:
    child = db.query(Child).filter(Child.id == child_id, Child.is_active.is_(True)).first()
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

    photo_data = None
    photo_content_type = None
    if body.photo_base64:
        try:
            photo_data, photo_content_type = decode_photo_base64(body.photo_base64)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    contact = create_contact(
        db,
        child_id=child.id,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        relationship=body.relationship,
        is_primary=body.is_primary,
        photo_data=photo_data,
        photo_content_type=photo_content_type,
    )
    db.commit()
    db.refresh(contact)
    log_audit(db, "create", "authorized_pickup", user_id=current_user.id, resource_id=str(contact.id))
    return _response(contact)


@router.put("/{contact_id}", response_model=AuthorizedPickupResponse)
def update_pickup(
    contact_id: uuid.UUID,
    body: AuthorizedPickupUpdate,
    db: DbSession,
    admin: AdminUser,
) -> AuthorizedPickupResponse:
    contact = db.query(AuthorizedPickupContact).filter(AuthorizedPickupContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    if body.first_name is not None:
        contact.first_name = body.first_name.strip()
    if body.last_name is not None:
        contact.last_name = body.last_name.strip()
    if body.phone is not None:
        contact.phone = body.phone.strip()
    if body.relationship is not None:
        contact.relationship = body.relationship.strip()
    if body.is_primary is not None:
        if body.is_primary:
            db.query(AuthorizedPickupContact).filter(
                AuthorizedPickupContact.child_id == contact.child_id,
                AuthorizedPickupContact.is_primary.is_(True),
                AuthorizedPickupContact.id != contact.id,
            ).update({AuthorizedPickupContact.is_primary: False})
        contact.is_primary = body.is_primary

    db.commit()
    db.refresh(contact)
    return _response(contact)


@router.post("/{contact_id}/photo", response_model=AuthorizedPickupResponse)
async def upload_pickup_photo(
    contact_id: uuid.UUID,
    db: DbSession,
    current_user: VerifiedUser,
    photo: UploadFile = File(...),
) -> AuthorizedPickupResponse:
    contact = db.query(AuthorizedPickupContact).filter(AuthorizedPickupContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    content = await photo.read()
    try:
        photo_data, photo_content_type = process_upload_photo(content, photo.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    contact.photo_data = photo_data
    contact.photo_content_type = photo_content_type
    db.commit()
    db.refresh(contact)
    return _response(contact)


@router.get("/{contact_id}/photo")
def get_pickup_photo(
    contact_id: uuid.UUID,
    db: DbSession,
    current_user: VerifiedUser,
) -> Response:
    contact = db.query(AuthorizedPickupContact).filter(AuthorizedPickupContact.id == contact_id).first()
    if not contact or not contact.photo_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    return Response(
        content=contact.photo_data,
        media_type=contact.photo_content_type or "image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pickup(contact_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    contact = db.query(AuthorizedPickupContact).filter(AuthorizedPickupContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    if contact.is_primary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the primary authorized contact",
        )
    db.delete(contact)
    db.commit()
