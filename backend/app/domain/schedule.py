"""Tape scheduling rules: side capacity, durations, adjacency and key terms.

Pure functions only, no I/O. All limits are named constants defined here.
"""

from __future__ import annotations

from collections.abc import Collection, Sequence
from dataclasses import dataclass
from typing import Literal

# --- Named constants (single source of truth) ---------------------------------
SIDE_CAPACITY_MINUTES: dict[str, int] = {"C60": 30, "C90": 45, "C120": 60}
TAPE_LENGTHS: tuple[str, ...] = tuple(SIDE_CAPACITY_MINUTES)

TITLE_MIN_CHARS = 1
TITLE_MAX_CHARS = 60
NAME_MIN_CHARS = 1
NAME_MAX_CHARS = 40
KEY_TERM_MIN_CHARS = 1
KEY_TERM_MAX_CHARS = 40
KEY_TERMS_MIN = 3
KEY_TERMS_MAX = 5

TRACK_MIN_MINUTES = 10
TRACK_MIN_MINUTES_DEMO = 1
TRACK_MAX_MINUTES = 50
INTERLUDE_MIN_MINUTES = 3
INTERLUDE_MAX_MINUTES = 15

SIDES: tuple[str, ...] = ("A", "B")

ItemKind = Literal["track", "interlude"]


@dataclass(frozen=True)
class RuleViolation:
    rule: str
    side: str | None
    message: str


@dataclass(frozen=True)
class Item:
    kind: ItemKind
    minutes: int
    id: str | None = None
    name: str | None = None
    key_terms: tuple[str, ...] | None = None


@dataclass(frozen=True)
class Tape:
    title: str
    length: str
    side_a: Sequence[Item]
    side_b: Sequence[Item]


# --- Helpers ------------------------------------------------------------------
def side_capacity(length: str) -> int:
    """Minutes available on one side of a tape. Raises KeyError for unknown lengths."""
    return SIDE_CAPACITY_MINUTES[length]


def min_track_minutes(demo_mode: bool) -> int:
    return TRACK_MIN_MINUTES_DEMO if demo_mode else TRACK_MIN_MINUTES


def side_total(items: Sequence[Item]) -> int:
    return sum(i.minutes for i in items)


def remaining_minutes(items: Sequence[Item], length: str) -> int:
    """Side capacity minus the sum of the item durations (negative when over)."""
    return side_capacity(length) - side_total(items)


def _key_term_violations(item: Item, side: str | None, label: str) -> list[RuleViolation]:
    terms = item.key_terms or ()
    out: list[RuleViolation] = []
    if not KEY_TERMS_MIN <= len(terms) <= KEY_TERMS_MAX:
        out.append(
            RuleViolation(
                "key_terms_count",
                side,
                f"{label} needs {KEY_TERMS_MIN} to {KEY_TERMS_MAX} key terms "
                f"(has {len(terms)}).",
            )
        )
    for t in terms:
        if len(t) > KEY_TERM_MAX_CHARS or len(t.strip()) < KEY_TERM_MIN_CHARS:
            out.append(
                RuleViolation(
                    "key_term_length",
                    side,
                    f"{label}: key terms must be {KEY_TERM_MIN_CHARS} to "
                    f"{KEY_TERM_MAX_CHARS} characters.",
                )
            )
    folded = [t.strip().casefold() for t in terms]
    if len(set(folded)) != len(folded):
        out.append(
            RuleViolation(
                "key_terms_unique", side, f"{label}: key terms must be unique (ignoring case)."
            )
        )
    return out


def validate_side(
    items: Sequence[Item],
    demo_mode: bool,
    unchanged_ids: Collection[str] = frozenset(),
    *,
    length: str,
    side: str | None = None,
) -> list[RuleViolation]:
    """Validate one side. ``length`` (tape length) is needed for the capacity rule.

    A track whose id is in ``unchanged_ids`` is exempt from the 10-minute minimum.
    """
    out: list[RuleViolation] = []
    if length in SIDE_CAPACITY_MINUTES:
        left = remaining_minutes(items, length)
        if left < 0:
            out.append(
                RuleViolation(
                    "capacity",
                    side,
                    f"Side is over capacity by {-left} minutes "
                    f"({side_capacity(length)} minutes available).",
                )
            )

    prev_kind: str | None = None
    for n, item in enumerate(items, start=1):
        label = f"Item {n}"
        if item.kind == "track":
            label = f"Track {n}"
            if prev_kind == "track":
                out.append(
                    RuleViolation(
                        "adjacent_tracks",
                        side,
                        f"{label} follows another track. Put an interlude between "
                        "tracks on the same side.",
                    )
                )
            name = item.name or ""
            if not NAME_MIN_CHARS <= len(name.strip()) or len(name) > NAME_MAX_CHARS:
                out.append(
                    RuleViolation(
                        "track_name",
                        side,
                        f"{label}: topic name must be {NAME_MIN_CHARS} to "
                        f"{NAME_MAX_CHARS} characters.",
                    )
                )
            exempt = item.id is not None and item.id in unchanged_ids
            lo = TRACK_MIN_MINUTES_DEMO if exempt else min_track_minutes(demo_mode)
            if not lo <= item.minutes <= TRACK_MAX_MINUTES:
                out.append(
                    RuleViolation(
                        "track_minutes",
                        side,
                        f"{label}: duration must be {lo} to {TRACK_MAX_MINUTES} minutes.",
                    )
                )
            out.extend(_key_term_violations(item, side, label))
        else:
            if not INTERLUDE_MIN_MINUTES <= item.minutes <= INTERLUDE_MAX_MINUTES:
                out.append(
                    RuleViolation(
                        "interlude_minutes",
                        side,
                        f"{label}: interlude must be {INTERLUDE_MIN_MINUTES} to "
                        f"{INTERLUDE_MAX_MINUTES} minutes.",
                    )
                )
        prev_kind = item.kind
    return out


def validate_tape(
    tape: Tape,
    demo_mode: bool,
    unchanged_ids: Collection[str] = frozenset(),
) -> list[RuleViolation]:
    """Validate title, length and both sides. Sides are checked independently, so the
    last track on Side A and the first on Side B are never adjacent."""
    out: list[RuleViolation] = []
    if not TITLE_MIN_CHARS <= len(tape.title.strip()) or len(tape.title) > TITLE_MAX_CHARS:
        out.append(
            RuleViolation(
                "title",
                None,
                f"Title must be {TITLE_MIN_CHARS} to {TITLE_MAX_CHARS} characters.",
            )
        )
    if tape.length not in SIDE_CAPACITY_MINUTES:
        out.append(
            RuleViolation("length", None, f"Length must be one of {', '.join(TAPE_LENGTHS)}.")
        )
    for side, items in (("A", tape.side_a), ("B", tape.side_b)):
        out.extend(
            validate_side(items, demo_mode, unchanged_ids, length=tape.length, side=side)
        )
    return out
