import uuid

from sqlalchemy.orm import Session

from app.models.authorized_pickup_contact import AuthorizedPickupContact
from app.models.child import Child
from app.models.parent import Parent


def list_contacts_for_child(db: Session, child_id: uuid.UUID) -> list[AuthorizedPickupContact]:
    return (
        db.query(AuthorizedPickupContact)
        .filter(AuthorizedPickupContact.child_id == child_id)
        .order_by(AuthorizedPickupContact.is_primary.desc(), AuthorizedPickupContact.first_name)
        .all()
    )


def get_contact_for_child(db: Session, child_id: uuid.UUID, contact_id: uuid.UUID) -> AuthorizedPickupContact | None:
    return (
        db.query(AuthorizedPickupContact)
        .filter(
            AuthorizedPickupContact.id == contact_id,
            AuthorizedPickupContact.child_id == child_id,
        )
        .first()
    )


def ensure_primary_contact_from_parent(db: Session, child: Child) -> AuthorizedPickupContact:
    existing = (
        db.query(AuthorizedPickupContact)
        .filter(AuthorizedPickupContact.child_id == child.id)
        .first()
    )
    if existing:
        return existing

    parent = db.query(Parent).filter(Parent.id == child.parent_id).first()
    if not parent:
        raise ValueError("Parent not found for child")

    contact = AuthorizedPickupContact(
        child_id=child.id,
        first_name=parent.first_name,
        last_name=parent.last_name,
        phone=parent.phone,
        relationship="Parent",
        is_primary=True,
    )
    db.add(contact)
    db.flush()
    return contact


def create_contact(
    db: Session,
    child_id: uuid.UUID,
    first_name: str,
    last_name: str,
    phone: str,
    relationship: str,
    is_primary: bool = False,
    photo_data: bytes | None = None,
    photo_content_type: str | None = None,
) -> AuthorizedPickupContact:
    if is_primary:
        db.query(AuthorizedPickupContact).filter(
            AuthorizedPickupContact.child_id == child_id,
            AuthorizedPickupContact.is_primary.is_(True),
        ).update({AuthorizedPickupContact.is_primary: False})

    contact = AuthorizedPickupContact(
        child_id=child_id,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        phone=phone.strip(),
        relationship=relationship.strip() or "Guardian",
        is_primary=is_primary,
        photo_data=photo_data,
        photo_content_type=photo_content_type,
    )
    db.add(contact)
    db.flush()
    return contact


def contact_to_dict(contact: AuthorizedPickupContact) -> dict:
    return {
        "id": str(contact.id),
        "child_id": str(contact.child_id),
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "full_name": contact.full_name,
        "phone": contact.phone,
        "relationship": contact.relationship,
        "is_primary": contact.is_primary,
        "has_photo": contact.has_photo,
        "created_at": contact.created_at.isoformat(),
        "updated_at": contact.updated_at.isoformat(),
    }
