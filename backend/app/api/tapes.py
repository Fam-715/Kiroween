"""Tape API: list, create, read, replace and delete a listener's tapes."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session as DbSession
from sqlmodel import col, delete, select

from app.db import get_session
from app.deps import get_listener
from app.domain import schedule, strength
from app.domain.clock import Clock, virtual_now
from app.models import Listener, Recall, SessionEvent, Tape, TapeItem, utcnow
from app.models import Session as StudySession
from app.schemas import (
    TapeIn,
    TapeItemIn,
    TapeItemOut,
    TapeOut,
    TapeStatsOut,
    TrackMemoryOut,
)

router = APIRouter(tags=["tapes"])

SECONDS_PER_DAY = 86400.0

Db = Annotated[DbSession, Depends(get_session)]
CurrentListener = Annotated[Listener, Depends(get_listener)]


def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes. They are always stored as UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _virtual_now(listener: Listener) -> datetime:
    clock = Clock(
        scale=listener.time_scale,
        anchor_real=_aware(listener.clock_anchor_real),
        anchor_virtual=_aware(listener.clock_anchor_virtual),
    )
    return virtual_now(clock, utcnow())


def _memory(item: TapeItem, now: datetime) -> TrackMemoryOut:
    if item.base_strength is None or item.last_reviewed_at is None:
        return TrackMemoryOut(
            recorded=False,
            strength=None,
            condition=None,
            stability_days=item.stability_days,
            review_count=item.review_count,
            last_reviewed_at=None,
            next_review_at=None,
            due=False,
        )
    last = _aware(item.last_reviewed_at)
    elapsed = max(0.0, (now - last).total_seconds() / SECONDS_PER_DAY)
    value = strength.strength_at(item.base_strength, item.stability_days, elapsed)
    return TrackMemoryOut(
        recorded=True,
        strength=value,
        condition=strength.condition(value),
        stability_days=item.stability_days,
        review_count=item.review_count,
        last_reviewed_at=last,
        next_review_at=strength.next_review_at(last, item.base_strength, item.stability_days),
        due=strength.is_due(item.base_strength, item.stability_days, elapsed),
    )


def _item_out(item: TapeItem, now: datetime) -> TapeItemOut:
    return TapeItemOut(
        id=item.id,
        side=item.side,  # type: ignore[arg-type]
        position=item.position,
        kind=item.kind,  # type: ignore[arg-type]
        name=item.name,
        minutes=item.minutes,
        key_terms=item.key_terms,
        memory=_memory(item, now) if item.kind == "track" else None,
    )


def _stats(db: DbSession, tape_id: UUID, items: list[TapeItem]) -> TapeStatsOut:
    """Liner-note stats from the tape's sessions and their events."""
    session_ids = list(db.exec(select(StudySession.id).where(StudySession.tape_id == tape_id)))
    stats = TapeStatsOut(sessions=len(session_ids))
    if not session_ids:
        return stats
    by_id = {i.id: i for i in items}
    events = db.exec(
        select(SessionEvent).where(col(SessionEvent.session_id).in_(session_ids))
    ).all()
    for ev in events:
        item = by_id.get(ev.item_id) if ev.item_id else None
        if item is None or item.kind != "track":
            continue
        if ev.type == "complete":
            stats.tracks_completed += 1
            stats.focus_minutes += item.minutes
        elif ev.type == "skip":
            stats.tracks_skipped += 1
    return stats


def _tape_out(
    tape: Tape, items: list[TapeItem], now: datetime, stats: TapeStatsOut | None = None
) -> TapeOut:
    ordered = sorted(items, key=lambda i: i.position)
    side_a = [_item_out(i, now) for i in ordered if i.side == "A"]
    side_b = [_item_out(i, now) for i in ordered if i.side == "B"]
    memories = [m for i in side_a + side_b if (m := i.memory) is not None and m.recorded]
    strengths = [m.strength for m in memories if m.strength is not None]
    reviews = [m.next_review_at for m in memories if m.next_review_at is not None]

    def remaining(side_items: list[TapeItemOut]) -> int:
        return schedule.side_capacity(tape.length) - sum(i.minutes for i in side_items)

    return TapeOut(
        id=tape.id,
        title=tape.title,
        length=tape.length,
        created_at=_aware(tape.created_at),
        is_sample=tape.is_sample,
        virtual_now=now,
        side_a=side_a,
        side_b=side_b,
        remaining_a=remaining(side_a),
        remaining_b=remaining(side_b),
        strength=strength.tape_strength(strengths),
        condition=strength.tape_condition(strengths),
        due_count=sum(1 for m in memories if m.due),
        next_review_at=min(reviews) if reviews else None,
        ghost=strength.is_ghost(strengths),
        stats=stats or TapeStatsOut(),
    )


def _get_tape(db: DbSession, listener: Listener, tape_id: UUID) -> Tape:
    tape = db.exec(
        select(Tape).where(Tape.id == tape_id, Tape.listener_id == listener.listener_id)
    ).first()
    if tape is None:
        raise HTTPException(status_code=404, detail="Tape not found")
    return tape


def _items_of(db: DbSession, tape_id: UUID) -> list[TapeItem]:
    return list(db.exec(select(TapeItem).where(TapeItem.tape_id == tape_id)).all())


def _to_domain(items: list[TapeItemIn]) -> list[schedule.Item]:
    return [
        schedule.Item(
            kind=i.kind,
            minutes=i.minutes,
            id=str(i.id) if i.id else None,
            name=i.name if i.kind == "track" else None,
            key_terms=tuple(i.key_terms or ()) if i.kind == "track" else None,
        )
        for i in items
    ]


def _validate(body: TapeIn, demo_mode: bool, unchanged_ids: set[str]) -> None:
    violations = schedule.validate_tape(
        schedule.Tape(body.title, body.length, _to_domain(body.side_a), _to_domain(body.side_b)),
        demo_mode,
        unchanged_ids,
    )
    if violations:
        raise HTTPException(
            status_code=422,
            detail=[{"rule": v.rule, "side": v.side, "message": v.message} for v in violations],
        )


def _new_item(tape_id: UUID, side: str, position: int, src: TapeItemIn) -> TapeItem:
    is_track = src.kind == "track"
    return TapeItem(
        tape_id=tape_id,
        side=side,
        position=position,
        kind=src.kind,
        name=src.name if is_track else None,
        minutes=src.minutes,
        key_terms=list(src.key_terms or []) if is_track else None,
        stability_days=strength.S_INITIAL,
    )


@router.get("/tapes", response_model=list[TapeOut])
def list_tapes(db: Db, listener: CurrentListener) -> list[TapeOut]:
    now = _virtual_now(listener)
    tapes = db.exec(
        select(Tape).where(Tape.listener_id == listener.listener_id).order_by(col(Tape.created_at))
    ).all()
    result = []
    for t in tapes:
        items = _items_of(db, t.id)
        result.append(_tape_out(t, items, now, _stats(db, t.id, items)))
    return result


@router.post("/tapes", response_model=TapeOut, status_code=201)
def create_tape(body: TapeIn, db: Db, listener: CurrentListener) -> TapeOut:
    _validate(body, listener.demo_mode, set())
    tape = Tape(listener_id=listener.listener_id, title=body.title, length=body.length)
    db.add(tape)
    db.flush()
    items = [
        _new_item(tape.id, side, pos, src)
        for side, source in (("A", body.side_a), ("B", body.side_b))
        for pos, src in enumerate(source)
    ]
    db.add_all(items)
    db.commit()
    db.refresh(tape)
    return _tape_out(tape, items, _virtual_now(listener))


@router.get("/tapes/{tape_id}", response_model=TapeOut)
def get_tape(tape_id: UUID, db: Db, listener: CurrentListener) -> TapeOut:
    tape = _get_tape(db, listener, tape_id)
    items = _items_of(db, tape.id)
    return _tape_out(tape, items, _virtual_now(listener), _stats(db, tape.id, items))


@router.put("/tapes/{tape_id}", response_model=TapeOut)
def update_tape(tape_id: UUID, body: TapeIn, db: Db, listener: CurrentListener) -> TapeOut:
    tape = _get_tape(db, listener, tape_id)
    active = db.exec(
        select(StudySession).where(
            StudySession.tape_id == tape.id, col(StudySession.ended_at).is_(None)
        )
    ).first()
    if active is not None:
        raise HTTPException(status_code=409, detail="A session is in progress for this tape")

    existing = {i.id: i for i in _items_of(db, tape.id)}
    # Tracks with an unchanged id and duration keep a Demo-mode duration (Requirement 12.3).
    unchanged: set[str] = set()
    for src in (*body.side_a, *body.side_b):
        old = existing.get(src.id) if src.id else None
        if old is not None and old.kind == "track" == src.kind and old.minutes == src.minutes:
            unchanged.add(str(old.id))
    _validate(body, listener.demo_mode, unchanged)

    kept: set[UUID] = set()
    result: list[TapeItem] = []
    for side, source in (("A", body.side_a), ("B", body.side_b)):
        for pos, src in enumerate(source):
            old = existing.get(src.id) if src.id else None
            if old is None or old.kind != src.kind or old.id in kept:
                item = _new_item(tape.id, side, pos, src)
                db.add(item)
            else:
                item = old
                kept.add(old.id)
                item.side, item.position, item.minutes = side, pos, src.minutes
                if src.kind == "track":
                    new_terms = list(src.key_terms or [])
                    if new_terms != (old.key_terms or []):
                        item.key_terms = new_terms
                        item.base_strength = None
                        item.stability_days = strength.S_INITIAL
                        item.last_reviewed_at = None
                        item.review_count = 0
                        db.exec(delete(Recall).where(col(Recall.track_id) == item.id))
                    item.name = src.name
                db.add(item)
            result.append(item)

    for old_id in set(existing) - kept:
        db.exec(delete(Recall).where(col(Recall.track_id) == old_id))
        db.delete(existing[old_id])
    tape.title = body.title
    tape.length = body.length
    db.add(tape)
    db.commit()
    db.refresh(tape)
    items = _items_of(db, tape.id)
    return _tape_out(tape, items, _virtual_now(listener), _stats(db, tape.id, items))


@router.delete("/tapes/{tape_id}", status_code=204)
def delete_tape(tape_id: UUID, db: Db, listener: CurrentListener) -> Response:
    tape = _get_tape(db, listener, tape_id)
    db.delete(tape)  # sessions, items and recalls go with it (ON DELETE CASCADE)
    db.commit()
    return Response(status_code=204)
