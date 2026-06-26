"""Default VKMS age-group classes."""

DEFAULT_CLASSES: list[tuple[str, int, int]] = [
    ("Ages 1-3", 1, 3),
    ("Ages 4-7", 4, 7),
    ("Ages 8-12", 8, 12),
    ("Ages 13-16", 13, 16),
]

DEFAULT_CLASS_NAME = "Ages 4-7"

LEGACY_CLASS_MAP = {
    "Tiny Tots": "Ages 1-3",
    "Beginners": "Ages 4-7",
    "Juniors": "Ages 8-12",
    "Teens": "Ages 13-16",
}

CLASS_IMPORT_ALIASES: dict[str, str] = {
    key.lower(): value for key, value in LEGACY_CLASS_MAP.items()
}
CLASS_IMPORT_ALIASES.update(
    {
        "age 1-3": "Ages 1-3",
        "ages 1-3": "Ages 1-3",
        "age 1 3": "Ages 1-3",
        "age 4-7": "Ages 4-7",
        "ages 4-7": "Ages 4-7",
        "age 4 7": "Ages 4-7",
        "age 8-12": "Ages 8-12",
        "ages 8-12": "Ages 8-12",
        "age 8 12": "Ages 8-12",
        "age 13-16": "Ages 13-16",
        "ages 13-16": "Ages 13-16",
        "age 13 16": "Ages 13-16",
        "teens class": "Ages 13-16",
        "teen class": "Ages 13-16",
        "teens": "Ages 13-16",
        "teen": "Ages 13-16",
    }
)

DEFAULT_SERVICE_NAME = "Sunday Service"

PRESET_SERVICE_TYPES: list[str] = [
    DEFAULT_SERVICE_NAME,
    "Midweek Service",
    "Special Program",
]
