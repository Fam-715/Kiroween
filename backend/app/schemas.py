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
