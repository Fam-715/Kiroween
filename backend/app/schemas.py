"""Pydantic request/response models."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ConditionName = Literal["Mint", "Worn", "Warped", "Haunted", "Dead"]


class HealthResponse(BaseModel):
    status: str


class RuleViolationOut(BaseModel):
    rule: str
    side: str | None = None
    message: str


class RuleViolationsResponse(BaseModel):
    """Body of a 422 from the tape API: `detail` is a list of rule violations."""

    detail: list[RuleViolationOut]


# --- Tape requests ---------------------------------------------------------------
# Limits (title length, minutes, key terms...) are deliberately NOT enforced here. They
# are checked by `domain.schedule` so every violation comes back as {rule, side, message}.
class TapeItemIn(BaseModel):
    id: UUID | None = None  # PUT only: an existing item id keeps that item (and its memory)
    kind: Literal["track", "interlude"]
    minutes: int
    name: str | None = None
    key_terms: list[str] | None = None


class TapeIn(BaseModel):
    title: str
    length: str
    side_a: list[TapeItemIn] = Field(default_factory=list)
    side_b: list[TapeItemIn] = Field(default_factory=list)


# --- Tape responses --------------------------------------------------------------
class TrackMemoryOut(BaseModel):
    recorded: bool
    strength: int | None
    condition: ConditionName | None
    stability_days: float
    review_count: int
    last_reviewed_at: datetime | None
    next_review_at: datetime | None
    due: bool


class TapeItemOut(BaseModel):
    id: UUID
    side: Literal["A", "B"]
    position: int
    kind: Literal["track", "interlude"]
    name: str | None
    minutes: int
    key_terms: list[str] | None
    memory: TrackMemoryOut | None  # tracks only


class TapeStatsOut(BaseModel):
    """Liner-note stats computed from the tape's sessions."""

    sessions: int = 0
    focus_minutes: int = 0  # sum of completed track durations
    tracks_completed: int = 0
    tracks_skipped: int = 0


class TapeOut(BaseModel):
    id: UUID
    title: str
    length: str
    created_at: datetime
    is_sample: bool
    virtual_now: datetime
    side_a: list[TapeItemOut]
    side_b: list[TapeItemOut]
    remaining_a: int
    remaining_b: int
    strength: int | None
    condition: ConditionName
    due_count: int
    next_review_at: datetime | None
    ghost: bool
    stats: TapeStatsOut = Field(default_factory=TapeStatsOut)


# --- Sessions ----------------------------------------------------------------------
class PenaltyOut(BaseModel):
    track_id: UUID
    stability_before: float
    stability_after: float


class SessionStartOut(BaseModel):
    id: UUID
    tape_id: UUID
    started_at: datetime
    ended_at: datetime | None


class SessionEventIn(BaseModel):
    client_event_id: UUID
    type: Literal["complete", "skip"]
    item_id: UUID


class SessionEventOut(BaseModel):
    client_event_id: UUID
    type: Literal["complete", "skip"]
    item_id: UUID | None
    penalty: list[PenaltyOut]
    session_ended: bool


class SessionSummaryOut(BaseModel):
    id: UUID
    tape_id: UUID
    started_at: datetime
    ended_at: datetime
    abandoned: bool
    penalty: list[PenaltyOut]
    tracks_completed: int
    tracks_skipped: int
    focus_minutes: int


# --- Settings ----------------------------------------------------------------------
class SettingsIn(BaseModel):
    """Body of PUT /api/settings."""

    demo_mode: bool


class SettingsOut(BaseModel):
    demo_mode: bool
    time_warp_allowed: bool
    time_warp_enabled: bool
    time_scale: int
    real_now: datetime
    virtual_now: datetime
