"""Parse Excel bulk-import rows using header names and normalize messy form data."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime

from app.services.child_service import (
    cell_to_optional_str,
    cell_to_required_str,
    is_empty_placeholder,
    normalize_phone,
)


@dataclass
class ImportColumnMap:
    child_first_name: int | None = 0
    child_last_name: int | None = 1
    gender: int | None = 2
    date_of_birth: int | None = 3
    class_name: int | None = 4
    parent_first_name: int | None = 5
    parent_last_name: int | None = 6
    parent_name: int | None = None
    phone: int | None = 7
    alt_phone: int | None = 8
    email: int | None = 9
    address: int | None = 10
    medical_notes: int | None = 11
    skip_columns: set[int] = field(default_factory=set)


@dataclass
class ParsedParentContact:
    first_name: str
    last_name: str
    phone: str
    alternative_phone: str | None
    email: str | None
    address: str | None
    extra_notes: str | None = None


@dataclass
class ParsedImportRow:
    child_first_name: str
    child_last_name: str
    gender: str
    date_of_birth: date
    class_name: str | None
    parent: ParsedParentContact
    medical_notes: str | None


def _normalize_header(value: object | None) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    text = re.sub(r"[^\w\s/]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _header_matches(header: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in header for keyword in keywords)


def looks_like_header_row(headers: tuple[object, ...]) -> bool:
    normalized = [_normalize_header(h) for h in headers if not is_empty_placeholder(h)]
    if not normalized:
        return False
    joined = " ".join(normalized)
    markers = ("first", "last", "name", "gender", "dob", "birth", "class", "phone", "parent", "child")
    return sum(1 for marker in markers if marker in joined) >= 2


def build_column_map(headers: tuple[object, ...]) -> ImportColumnMap:
    col_map = ImportColumnMap(
        child_first_name=None,
        child_last_name=None,
        gender=None,
        date_of_birth=None,
        class_name=None,
        parent_first_name=None,
        parent_last_name=None,
        parent_name=None,
        phone=None,
        alt_phone=None,
        email=None,
        address=None,
        medical_notes=None,
    )

    for index, header_value in enumerate(headers):
        header = _normalize_header(header_value)
        if not header:
            continue

        if _header_matches(header, ("timestamp", "submitted", "submission time", "date time")):
            col_map.skip_columns.add(index)
            continue

        if _header_matches(
            header,
            ("child first", "childs first", "child s first", "first name", "given name"),
        ) and "parent" not in header and "guardian" not in header:
            col_map.child_first_name = index
        elif _header_matches(
            header,
            ("child last", "childs last", "child s last", "last name", "surname", "family name"),
        ) and "parent" not in header and "guardian" not in header:
            col_map.child_last_name = index
        elif header in {"first name", "firstname"} and col_map.child_first_name is None:
            col_map.child_first_name = index
        elif header in {"last name", "lastname", "surname"} and col_map.child_last_name is None:
            col_map.child_last_name = index
        elif _header_matches(header, ("gender", "sex")):
            col_map.gender = index
        elif _header_matches(
            header,
            ("date of birth", "dob", "birth date", "birthday", "birthdate", "child date of birth"),
        ):
            col_map.date_of_birth = index
        elif _header_matches(header, ("class", "age group", "age class", "age range", "department")):
            col_map.class_name = index
        elif _header_matches(header, ("parent first", "guardian first", "mother first", "father first")):
            col_map.parent_first_name = index
        elif _header_matches(header, ("parent last", "guardian last", "mother last", "father last")):
            col_map.parent_last_name = index
        elif _header_matches(
            header,
            (
                "parent name",
                "guardian name",
                "parent guardian",
                "parent/guardian",
                "parents name",
                "mother name",
                "father name",
                "name of parent",
            ),
        ):
            col_map.parent_name = index
        elif _header_matches(
            header,
            ("alt phone", "alternative phone", "second phone", "other phone", "phone 2", "alternate phone"),
        ):
            col_map.alt_phone = index
        elif _header_matches(header, ("email", "e mail")):
            col_map.email = index
        elif _header_matches(header, ("address", "home address", "residential address", "location")):
            col_map.address = index
        elif _header_matches(
            header,
            ("medical", "allergy", "allergies", "health", "medical note", "health note", "special need"),
        ):
            col_map.medical_notes = index
        elif _header_matches(
            header,
            ("phone", "mobile", "telephone", "contact number", "phone number", "whatsapp"),
        ):
            if col_map.phone is None:
                col_map.phone = index
            elif col_map.alt_phone is None:
                col_map.alt_phone = index

    if col_map.child_first_name is None:
        col_map = ImportColumnMap()
    return col_map


def _cell(row: tuple[object, ...], index: int | None) -> object | None:
    if index is None or index < 0 or index >= len(row):
        return None
    return row[index]


def split_parent_name(full_name: str) -> tuple[str, str]:
    text = full_name.strip()
    if not text:
        raise ValueError("Parent name is required")

    parts = text.split(None, 1)
    if len(parts) == 1:
        return parts[0], "-"
    return parts[0], parts[1]


def looks_like_email(value: str) -> bool:
    text = value.strip()
    return "@" in text and "." in text.split("@")[-1]


def looks_like_phone(value: str) -> bool:
    if looks_like_email(value):
        return False
    digits = normalize_phone(value)
    return len(digits) >= 7


def looks_like_address(value: str) -> bool:
    lowered = value.lower()
    if looks_like_email(value) or looks_like_phone(value):
        return False
    if len(value) < 12:
        return False
    address_markers = (
        "street",
        "road",
        "avenue",
        "lane",
        "close",
        "estate",
        "city",
        "community",
        "off ",
        "no ",
        "number",
        "gra",
        "quarter",
    )
    return any(marker in lowered for marker in address_markers) or len(value.split()) >= 4


def clean_phone_value(raw: str) -> str:
    match = re.search(r"[\d\s+\-()]{7,}", raw)
    candidate = match.group().strip() if match else raw.strip()
    return candidate[:20]


def parse_date_of_birth(value: object) -> date:
    if hasattr(value, "date"):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if " " in text:
        text = text.split(" ", 1)[0]
    try:
        return date.fromisoformat(text)
    except ValueError:
        pass
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date of birth: {value}")


def normalize_parent_contacts(
    *,
    parent_first: str | None,
    parent_last: str | None,
    parent_full: str | None,
    phone: str | None,
    alt_phone: str | None,
    email: str | None,
    address: str | None,
    extras: list[str | None] | None = None,
) -> ParsedParentContact:
    phones: list[str] = []
    emails: list[str] = []
    addresses: list[str] = []
    notes: list[str] = []

    if parent_full and not parent_first:
        parent_first, parent_last = split_parent_name(parent_full)

    first = cell_to_optional_str(parent_first)
    last = cell_to_optional_str(parent_last)

    for value in (first, last):
        if not value:
            continue
        if looks_like_phone(value):
            phones.append(clean_phone_value(value))
        elif looks_like_email(value):
            emails.append(value)

    if first and looks_like_phone(first):
        first = None
    if last and looks_like_phone(last):
        last = None

    if not first and not last and parent_full:
        first, last = split_parent_name(parent_full)

    if first and (not last or last == "-") and " " in first:
        first, last = split_parent_name(first)

    for raw in [phone, alt_phone, email, address, *(extras or [])]:
        text = cell_to_optional_str(raw)
        if not text:
            continue
        if looks_like_email(text):
            emails.append(text)
        elif looks_like_phone(text):
            phones.append(clean_phone_value(text))
        elif looks_like_address(text):
            addresses.append(text)
        else:
            notes.append(text)

    if not first and not last:
        raise ValueError("Parent name is required")

    if not first:
        first, last = split_parent_name(last or "-")
    if not last:
        last = "-"

    if not phones:
        raise ValueError("Parent phone is required")

    primary_phone = phones[0]
    alternative_phone = phones[1] if len(phones) > 1 else None

    return ParsedParentContact(
        first_name=first,
        last_name=last,
        phone=primary_phone,
        alternative_phone=alternative_phone,
        email=emails[0] if emails else None,
        address=addresses[0] if addresses else None,
        extra_notes="; ".join(notes) if notes else None,
    )


def parse_import_row(row: tuple[object, ...], col_map: ImportColumnMap) -> ParsedImportRow:
    child_first_name = cell_to_required_str(
        _cell(row, col_map.child_first_name),
        "First name",
    )
    child_last_name = cell_to_required_str(
        _cell(row, col_map.child_last_name),
        "Last name",
    )
    gender = cell_to_required_str(_cell(row, col_map.gender), "Gender")

    dob_raw = _cell(row, col_map.date_of_birth)
    if is_empty_placeholder(dob_raw):
        raise ValueError("Date of birth is required")

    parent = normalize_parent_contacts(
        parent_first=cell_to_optional_str(_cell(row, col_map.parent_first_name)),
        parent_last=cell_to_optional_str(_cell(row, col_map.parent_last_name)),
        parent_full=cell_to_optional_str(_cell(row, col_map.parent_name)),
        phone=cell_to_optional_str(_cell(row, col_map.phone)),
        alt_phone=cell_to_optional_str(_cell(row, col_map.alt_phone)),
        email=cell_to_optional_str(_cell(row, col_map.email)),
        address=cell_to_optional_str(_cell(row, col_map.address)),
    )

    if len(normalize_phone(parent.phone)) < 7:
        raise ValueError("Parent phone is invalid")

    medical_notes = cell_to_optional_str(_cell(row, col_map.medical_notes))
    if not medical_notes and parent.extra_notes:
        medical_notes = parent.extra_notes
    elif medical_notes and parent.extra_notes:
        medical_notes = f"{medical_notes}; {parent.extra_notes}"

    return ParsedImportRow(
        child_first_name=child_first_name,
        child_last_name=child_last_name,
        gender=gender,
        date_of_birth=parse_date_of_birth(dob_raw),
        class_name=cell_to_optional_str(_cell(row, col_map.class_name)),
        parent=parent,
        medical_notes=medical_notes,
    )
