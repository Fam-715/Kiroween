"""SQLModel tables. See design.md, "Data model (SQLModel)".

Memory timestamps (`last_reviewed_at`, `Recall.at`) are virtual time. Session
timestamps are real time. Recall text is never stored.
Deleting a Tape cascades to items, sessions, recalls and events at the database
level (foreign keys with ON DELETE CASCADE; see `db.py` for the SQLite pragma).
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Timezone-aware UTC now. SQLModel requires aware datetimes for storage."""
    return datetime.now(UTC)


class Listener(SQLModel, table=True):
    listener_id: UUID = Field(default_factory=uuid4, primary_key=True)
    demo_mode: bool = False
    time_scale: int = 1  # 1 or 1440
    clock_anchor_real: datetime = Field(default_factory=utcnow)
    clock_anchor_virtual: datetime = Field(default_factory=utcnow)


class Tape(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    listener_id: UUID = Field(index=True)
    title: str
    length: str  # "C60" | "C90" | "C120"
    created_at: datetime = Field(default_factory=utcnow)
    is_sample: bool = False


class TapeItem(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tape_id: UUID = Field(foreign_key="tape.id", ondelete="CASCADE", index=True)
    side: str  # "A" | "B"
    position: int
    kind: str  # "track" | "interlude"
    name: str | None = None
    minutes: int
    key_terms: list[str] | None = Field(default=None, sa_column=Column(JSON))
    base_strength: int | None = None  # None = unrecorded
    stability_days: float = 1.0
    last_reviewed_at: datetime | None = None
    review_count: int = 0


class Recall(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("track_id", "client_event_id"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    track_id: UUID = Field(foreign_key="tapeitem.id", ondelete="CASCADE", index=True)
    client_event_id: UUID
    at: datetime
    source: str  # "speech" | "typed"
    score: float
    matched_terms: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    missed_terms: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    strength_before: int | None = None
    strength_after: int
    stability_before: float
    stability_after: float


class Session(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tape_id: UUID = Field(foreign_key="tape.id", ondelete="CASCADE", index=True)
    started_at: datetime = Field(default_factory=utcnow)
    ended_at: datetime | None = None
    abandoned: bool = False
    # list of {track_id, stability_before, stability_after}
    stop_penalty: list[dict[str, Any]] | None = Field(default=None, sa_column=Column(JSON))


class SessionEvent(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("session_id", "client_event_id"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="session.id", ondelete="CASCADE", index=True)
    item_id: UUID | None = Field(default=None, foreign_key="tapeitem.id", ondelete="SET NULL")
    client_event_id: UUID
    type: str  # "complete" | "skip"
    at: datetime = Field(default_factory=utcnow)
    # list of {track_id, stability_before, stability_after}
    penalty: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
