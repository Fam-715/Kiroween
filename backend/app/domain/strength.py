"""Memory strength, decay, stability updates and tape condition.

Pure functions only, no I/O. Strength follows R(t) = exp(-t / S), where S is the
stability in days.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Literal

# --- Named constants -----------------------------------------------------------
S_INITIAL = 1.0
S_MIN = 0.25
S_MAX = 60.0  # days
PASS_SCORE = 0.6
DUE_STRENGTH = 70.0  # unrounded strength at or below this is due
ELIGIBLE_RATIO = 0.9  # stability may rise only if decay ratio <= this
PENALTY: dict[str, float] = {"skip_interlude": 0.9, "skip_track": 0.95, "abandon": 0.8}

Condition = Literal["Mint", "Worn", "Warped", "Haunted", "Dead"]
PenaltyKind = Literal["skip_interlude", "skip_track", "abandon"]


@dataclass(frozen=True)
class TrackMemory:
    base_strength: int
    stability_days: float
    last_reviewed_at: datetime | None
    review_count: int


def _round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def _clamp_s(s: float) -> float:
    return min(S_MAX, max(S_MIN, s))


def decay_ratio(elapsed_days: float, s: float) -> float:
    return math.exp(-max(0.0, elapsed_days) / s)


def strength_at(base: int, s: float, elapsed_days: float) -> int:
    value = _round_half_up(base * decay_ratio(elapsed_days, s))
    return min(100, max(0, value))


def condition(strength: int) -> Condition:
    if strength >= 80:
        return "Mint"
    if strength >= 50:
        return "Worn"
    if strength >= 20:
        return "Warped"
    if strength >= 1:
        return "Haunted"
    return "Dead"


def stability_factor(score: float) -> float:
    if score < PASS_SCORE:
        return 0.5 + 0.45 * (score / PASS_SCORE)
    return 1.2 + 1.3 * (score - PASS_SCORE) / (1.0 - PASS_SCORE)


def review(mem: TrackMemory, score: float, now: datetime) -> TrackMemory:
    factor = stability_factor(score)
    if factor > 1 and mem.last_reviewed_at is not None:
        elapsed = (now - mem.last_reviewed_at).total_seconds() / 86400
        if decay_ratio(elapsed, mem.stability_days) > ELIGIBLE_RATIO:
            factor = 1.0
    base = 100 if score >= PASS_SCORE else _round_half_up(score * 100)
    return replace(
        mem,
        base_strength=base,
        stability_days=_clamp_s(mem.stability_days * factor),
        last_reviewed_at=now,
        review_count=mem.review_count + 1,
    )


def apply_penalty(s: float, kind: PenaltyKind) -> float:
    return _clamp_s(s * PENALTY[kind])


def is_due(base: int, s: float, elapsed_days: float) -> bool:
    return base * decay_ratio(elapsed_days, s) <= DUE_STRENGTH


def next_review_at(last_reviewed_at: datetime, base: int, s: float) -> datetime:
    if base <= DUE_STRENGTH:
        return last_reviewed_at
    return last_reviewed_at + timedelta(days=s * math.log(base / DUE_STRENGTH))


def is_ghost(strengths: Sequence[int]) -> bool:
    return len(strengths) > 0 and all(v == 0 for v in strengths)


def tape_strength(strengths: Sequence[int]) -> int | None:
    if not strengths:
        return None
    mean = _round_half_up(sum(strengths) / len(strengths))
    if not is_ghost(strengths):
        mean = max(1, mean)
    return mean


def tape_condition(strengths: Sequence[int]) -> Condition:
    if not strengths:
        return "Mint"
    if is_ghost(strengths):
        return "Dead"
    value = tape_strength(strengths)
    assert value is not None
    return condition(value)
