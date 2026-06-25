"""Seed VKMS database with sample data."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.constants import DEFAULT_CLASSES, LEGACY_CLASS_MAP
from app.core.security import get_password_hash
from app.database import SessionLocal
from app.models.attendance import Attendance
from app.models.child import Child
from app.models.class_model import Class
from app.models.parent import Parent
from app.models.service import Service
from app.models.user import User, UserRole
from app.models.worker import Worker
from app.models.worker_attendance import WorkerAttendance  # noqa: F401

settings = get_settings()


def sync_classes(db) -> dict[str, Class]:
    """Ensure the four standard age-group classes exist."""
    class_map: dict[str, Class] = {}
    for name, min_age, max_age in DEFAULT_CLASSES:
        cls = db.query(Class).filter(Class.name == name).first()
        if cls:
            cls.description = name
            cls.min_age = min_age
            cls.max_age = max_age
        else:
            cls = Class(name=name, description=name, min_age=min_age, max_age=max_age)
            db.add(cls)
        class_map[name] = cls
    db.flush()

    for legacy_name, new_name in LEGACY_CLASS_MAP.items():
        legacy = db.query(Class).filter(Class.name == legacy_name).first()
        if not legacy:
            continue
        target = class_map[new_name]
        db.query(Child).filter(Child.class_id == legacy.id).update(
            {Child.class_id: target.id}, synchronize_session=False
        )
        if legacy.id != target.id:
            db.delete(legacy)

    db.commit()
    for name in class_map:
        db.refresh(class_map[name])
    return class_map


def remove_demo_children(db) -> None:
    """Remove legacy seed demo children (parents with @email.com addresses)."""
    demo_parent_ids = [
        row[0]
        for row in db.query(Parent.id).filter(Parent.email.like("%@email.com")).all()
    ]
    if not demo_parent_ids:
        return

    demo_child_ids = [
        row[0]
        for row in db.query(Child.id).filter(Child.parent_id.in_(demo_parent_ids)).all()
    ]
    if not demo_child_ids:
        return

    db.query(Attendance).filter(Attendance.child_id.in_(demo_child_ids)).delete(
        synchronize_session=False
    )
    removed_children = (
        db.query(Child)
        .filter(Child.id.in_(demo_child_ids))
        .delete(synchronize_session=False)
    )

    for parent_id in demo_parent_ids:
        if db.query(Child).filter(Child.parent_id == parent_id).count() == 0:
            db.query(Parent).filter(Parent.id == parent_id).delete(synchronize_session=False)

    if removed_children:
        db.commit()
        print(f"Removed {removed_children} demo child record(s).")


def sync_workers_roster(db) -> None:
    """Ensure default worker roster entries exist (no login required)."""
    defaults = [
        ("Sarah", "Johnson", "555-0201"),
        ("Michael", "Brown", "555-0202"),
    ]
    added = 0
    for first, last, phone in defaults:
        exists = (
            db.query(Worker)
            .filter(Worker.first_name == first, Worker.last_name == last)
            .first()
        )
        if not exists:
            db.add(Worker(first_name=first, last_name=last, phone=phone))
            added += 1
    if added:
        db.commit()
        print(f"Added {added} worker(s) to roster.")


def seed() -> None:
    db = SessionLocal()
    try:
        sync_classes(db)
        remove_demo_children(db)
        sync_workers_roster(db)

        if db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first():
            print("Database already seeded. Classes synced.")
            return

        admin = User(
            first_name="System",
            last_name="Admin",
            email=settings.DEFAULT_ADMIN_EMAIL,
            password_hash=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.ADMIN,
            must_change_password=True,
        )
        db.add(admin)

        db.commit()
        print("Database seeded successfully!")
        print(f"Admin: {settings.DEFAULT_ADMIN_EMAIL} / {settings.DEFAULT_ADMIN_PASSWORD}")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
