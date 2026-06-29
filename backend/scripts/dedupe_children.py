"""Find and merge duplicate children under the same parent.

Matches:
  - Exact: same normalized first + last name
  - Fuzzy: same last name and one first name is a prefix of the other (e.g. Triumph / Triumph Oghenemairo)

Keeps the row with the most attendance; ties by pickup contacts, then lower child_code.
"""

from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from uuid import UUID

_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _root_env.exists() and not os.environ.get("DATABASE_URL"):
    for line in _root_env.read_text().splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1]
            break

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import models  # noqa: F401
from app.database import SessionLocal
from app.models.attendance import Attendance
from app.models.authorized_pickup_contact import AuthorizedPickupContact
from app.models.child import Child


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _score(db, child: Child) -> tuple[int, int, str]:
    att = db.query(Attendance).filter(Attendance.child_id == child.id).count()
    pickups = (
        db.query(AuthorizedPickupContact)
        .filter(AuthorizedPickupContact.child_id == child.id)
        .count()
    )
    return (att, pickups, child.child_code)


def _first_names_overlap(a: str, b: str) -> bool:
    na, nb = _norm(a), _norm(b)
    if na == nb:
        return True
    return na.startswith(nb + " ") or nb.startswith(na + " ")


def find_duplicate_groups(db) -> list[list[Child]]:
    active = db.query(Child).filter(Child.is_active.is_(True)).order_by(Child.child_code).all()
    by_parent_last: dict[tuple[UUID, str], list[Child]] = defaultdict(list)
    for child in active:
        by_parent_last[(child.parent_id, _norm(child.last_name))].append(child)

    groups: list[list[Child]] = []
    seen_ids: set[UUID] = set()

    for children in by_parent_last.values():
        if len(children) < 2:
            continue
        used: set[UUID] = set()
        for i, c1 in enumerate(children):
            if c1.id in used:
                continue
            cluster = [c1]
            for c2 in children[i + 1 :]:
                if c2.id in used:
                    continue
                if any(_first_names_overlap(c2.first_name, m.first_name) for m in cluster):
                    cluster.append(c2)
            if len(cluster) > 1:
                for c in cluster:
                    used.add(c.id)
                if not any(c.id in seen_ids for c in cluster):
                    groups.append(cluster)
                    seen_ids.update(c.id for c in cluster)
    return groups


def merge_group(db, group: list[Child]) -> dict:
    keeper = max(group, key=lambda c: _score(db, c))
    removed: list[str] = []
    longest_first = max(group, key=lambda c: len(c.first_name))
    keeper.first_name = longest_first.first_name

    for dup in group:
        if dup.id == keeper.id:
            continue
        for att in list(db.query(Attendance).filter(Attendance.child_id == dup.id).all()):
            conflict = (
                db.query(Attendance)
                .filter(
                    Attendance.child_id == keeper.id,
                    Attendance.service_date == att.service_date,
                )
                .first()
            )
            if conflict:
                db.delete(att)
            else:
                att.child_id = keeper.id
        for contact in (
            db.query(AuthorizedPickupContact)
            .filter(AuthorizedPickupContact.child_id == dup.id)
            .all()
        ):
            contact.child_id = keeper.id
        removed.append(dup.child_code)
        db.delete(dup)

    return {
        "keeper": keeper.child_code,
        "removed": removed,
        "name": f"{keeper.first_name} {keeper.last_name}",
    }


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    db = SessionLocal()
    try:
        groups = find_duplicate_groups(db)
        if not groups:
            print("No duplicate children found.")
            return
        to_remove = sum(len(g) - 1 for g in groups)
        print(f"Found {len(groups)} group(s), {to_remove} duplicate row(s) to remove.\n")
        results = []
        for group in sorted(groups, key=lambda g: (g[0].last_name, g[0].first_name)):
            keeper = max(group, key=lambda c: _score(db, c))
            preview = {
                "keeper": keeper.child_code,
                "removed": [c.child_code for c in group if c.id != keeper.id],
                "name": f"{group[0].first_name} {group[0].last_name}",
            }
            print(f"  {preview['name']}: keep {preview['keeper']}, remove {', '.join(preview['removed'])}")
            if not dry_run:
                results.append(merge_group(db, group))
        if dry_run:
            print("\n(dry run — no changes written)")
            db.rollback()
        else:
            db.commit()
            print(f"\nDone. Removed {to_remove} duplicate(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
