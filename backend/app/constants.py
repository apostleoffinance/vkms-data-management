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

DEFAULT_SERVICE_NAME = "Sunday Service"

PRESET_SERVICE_TYPES: list[str] = [
    DEFAULT_SERVICE_NAME,
    "Midweek Service",
    "Special Program",
]
