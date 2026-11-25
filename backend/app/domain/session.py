"""Session rules: which penalty a skip earns and when a stop counts as abandoning.

Pure functions only, no I/O. Penalty factors live in `strength.PENALTY`.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from app.domain.strength import PenaltyKind, apply_penalty


@dataclass(frozen=True)
class PenaltyRecord:
    track_id: str
    stability_before: float
    stability_after: float


def skip_penalty_kind(item_kind: str) -> PenaltyKind:
    """Penalty for skipping an item: a skipped interlude hurts more than a skipped track."""
    return "skip_interlude" if item_kind == "interlude" else "skip_track"


def is_abandoned(planned_minutes: int, played_minutes: int) -> bool:
    """A stop abandons the session when MORE than half of the planned time remains."""
    remaining = planned_minutes - played_minutes
    return remaining * 2 > planned_minutes


def apply_penalty_to_tracks(
    stabilities: Mapping[str, float], track_ids: list[str], kind: PenaltyKind
) -> list[PenaltyRecord]:
    """Penalise the listed tracks (once each, in order). Other tracks are never touched."""
    records: list[PenaltyRecord] = []
    seen: set[str] = set()
    for track_id in track_ids:
        if track_id in seen or track_id not in stabilities:
            continue
        seen.add(track_id)
        before = stabilities[track_id]
        after = min(before, apply_penalty(before, kind))  # never raise stability
        records.append(PenaltyRecord(track_id, before, after))
    return records
