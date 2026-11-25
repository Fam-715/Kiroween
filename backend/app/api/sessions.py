"""Session API: start a play-through, report events, stop.

Events are idempotent on `client_event_id`. `POST /sessions/{id}/stop` is the only way
to stop a session; it applies the abandon rule once and saves the result.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session as DbSession
from sqlmodel import col, select

from app.api.tapes import _aware
from app.db import get_session
from app.deps import get_listener
from app.domain import session as rules
from app.models import Listener, SessionEvent, Tape, TapeItem, utcnow
from app.models import Session as StudySession
from app.schemas import (
    PenaltyOut,
    SessionEventIn,
    SessionEventOut,
    SessionStartOut,
    SessionSummaryOut,
)

router = APIRouter(tags=["sessions"])

Db = Annotated[DbSession, Depends(get_session)]
CurrentListener = Annotated[Listener, Depends(get_listener)]


def _ordered_items(db: DbSession, tape_id: UUID) -> list[TapeItem]:
    items = db.exec(select(TapeItem).where(TapeItem.tape_id == tape_id)).all()
    return sorted(items, key=lambda i: (i.side, i.position))  # Side A, then Side B


def _penalty_dicts(records: list[rules.PenaltyRecord]) -> list[dict[str, Any]]:
    return [
        {
            "track_id": r.track_id,
            "stability_before": r.stability_before,
            "stability_after": r.stability_after,
        }
        for r in records
    ]


def _penalty_out(raw: list[dict[str, Any]] | None) -> list[PenaltyOut]:
    return [PenaltyOut(**p) for p in (raw or [])]


def _events_of(db: DbSession, session_id: UUID) -> list[SessionEvent]:
    return list(
        db.exec(
            select(SessionEvent)
            .where(SessionEvent.session_id == session_id)
            .order_by(col(SessionEvent.at))
        ).all()
    )


def _get_tape(db: DbSession, listener: Listener, tape_id: UUID) -> Tape:
    tape = db.exec(
        select(Tape).where(Tape.id == tape_id, Tape.listener_id == listener.listener_id)
    ).first()
    if tape is None:
        raise HTTPException(status_code=404, detail="Tape not found")
    return tape


def _get_study_session(db: DbSession, listener: Listener, session_id: UUID) -> StudySession:
    found = db.exec(
        select(StudySession)
        .join(Tape, col(Tape.id) == col(StudySession.tape_id))
        .where(StudySession.id == session_id, Tape.listener_id == listener.listener_id)
    ).first()
    if found is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return found


def _event_out(ev: SessionEvent, session: StudySession) -> SessionEventOut:
    return SessionEventOut(
        client_event_id=ev.client_event_id,
        type=ev.type,  # type: ignore[arg-type]
        item_id=ev.item_id,
        penalty=_penalty_out(ev.penalty),
        session_ended=session.ended_at is not None,
    )


def _summary(db: DbSession, session: StudySession) -> SessionSummaryOut:
    assert session.ended_at is not None
    items = {i.id: i for i in _ordered_items(db, session.tape_id)}
    completed = skipped = minutes = 0
    for ev in _events_of(db, session.id):
        item = items.get(ev.item_id) if ev.item_id else None
        if item is None or item.kind != "track":
            continue
        if ev.type == "complete":
            completed += 1
            minutes += item.minutes
        else:
            skipped += 1
    return SessionSummaryOut(
        id=session.id,
        tape_id=session.tape_id,
        started_at=_aware(session.started_at),
        ended_at=_aware(session.ended_at),
        abandoned=session.abandoned,
        penalty=_penalty_out(session.stop_penalty),
        tracks_completed=completed,
        tracks_skipped=skipped,
        focus_minutes=minutes,
    )


def _end_session(db: DbSession, session: StudySession, *, check_abandon: bool) -> None:
    """End the session. With `check_abandon`, apply the abandon rule once."""
    items = _ordered_items(db, session.tape_id)
    by_id = {i.id: i for i in items}
    events = _events_of(db, session.id)
    penalty: list[dict[str, Any]] = []
    abandoned = False
    if check_abandon:
        planned = sum(i.minutes for i in items)
        played = sum(by_id[e.item_id].minutes for e in events if e.item_id in by_id)
        abandoned = rules.is_abandoned(planned, played)
        if abandoned:
            done = [
                str(e.item_id)
                for e in events
                if e.type == "complete" and e.item_id in by_id and by_id[e.item_id].kind == "track"
            ]
            stabilities = {str(i.id): i.stability_days for i in items if i.kind == "track"}
            records = rules.apply_penalty_to_tracks(stabilities, done, "abandon")
            for rec in records:
                by_id[UUID(rec.track_id)].stability_days = rec.stability_after
                db.add(by_id[UUID(rec.track_id)])
            penalty = _penalty_dicts(records)
    session.ended_at = utcnow()
    session.abandoned = abandoned
    session.stop_penalty = penalty
    db.add(session)


@router.post("/tapes/{tape_id}/sessions", response_model=SessionStartOut, status_code=201)
def start_session(tape_id: UUID, db: Db, listener: CurrentListener) -> SessionStartOut:
    tape = _get_tape(db, listener, tape_id)
    items = _ordered_items(db, tape.id)
    if not items:
        raise HTTPException(status_code=422, detail="Tape has no items to play")
    # A session left open (tab closed without STOP) is stopped by the abandon rule.
    stale = db.exec(
        select(StudySession).where(
            StudySession.tape_id == tape.id, col(StudySession.ended_at).is_(None)
        )
    ).all()
    for old in stale:
        _end_session(db, old, check_abandon=True)
    session = StudySession(tape_id=tape.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionStartOut(
        id=session.id,
        tape_id=session.tape_id,
        started_at=_aware(session.started_at),
        ended_at=None,
    )


@router.post("/sessions/{session_id}/events", response_model=SessionEventOut)
def post_event(
    session_id: UUID, body: SessionEventIn, db: Db, listener: CurrentListener
) -> SessionEventOut:
    session = _get_study_session(db, listener, session_id)
    existing = db.exec(
        select(SessionEvent).where(
            SessionEvent.session_id == session.id,
            SessionEvent.client_event_id == body.client_event_id,
        )
    ).first()
    if existing is not None:  # duplicate delivery: nothing is applied again
        return _event_out(existing, session)
    if session.ended_at is not None:
        raise HTTPException(status_code=409, detail="Session has ended")

    items = _ordered_items(db, session.tape_id)
    by_id = {i.id: i for i in items}
    item = by_id.get(body.item_id)
    if item is None:
        raise HTTPException(status_code=422, detail="Item does not belong to this tape")
    events = _events_of(db, session.id)
    if any(e.item_id == item.id for e in events):
        raise HTTPException(status_code=409, detail="Item already has an event in this session")

    penalty: list[dict[str, Any]] = []
    if body.type == "skip":
        done = [
            str(e.item_id)
            for e in events
            if e.type == "complete" and e.item_id in by_id and by_id[e.item_id].kind == "track"
        ]
        stabilities = {str(i.id): i.stability_days for i in items if i.kind == "track"}
        records = rules.apply_penalty_to_tracks(
            stabilities, done, rules.skip_penalty_kind(item.kind)
        )
        for rec in records:
            target = by_id[UUID(rec.track_id)]
            target.stability_days = rec.stability_after
            db.add(target)
        penalty = _penalty_dicts(records)

    event = SessionEvent(
        session_id=session.id,
        item_id=item.id,
        client_event_id=body.client_event_id,
        type=body.type,
        at=utcnow(),
        penalty=penalty,
    )
    db.add(event)
    if item.id == items[-1].id:  # last item on Side B: the session ends by itself
        db.flush()
        _end_session(db, session, check_abandon=False)
    try:
        db.commit()
    except IntegrityError:  # a concurrent duplicate won the race
        db.rollback()
        winner = db.exec(
            select(SessionEvent).where(
                SessionEvent.session_id == session_id,
                SessionEvent.client_event_id == body.client_event_id,
            )
        ).first()
        if winner is None:
            raise
        return _event_out(winner, _get_study_session(db, listener, session_id))
    db.refresh(session)
    db.refresh(event)
    return _event_out(event, session)


@router.post("/sessions/{session_id}/stop", response_model=SessionSummaryOut)
def stop_session(session_id: UUID, db: Db, listener: CurrentListener) -> SessionSummaryOut:
    session = _get_study_session(db, listener, session_id)
    if session.ended_at is None:
        _end_session(db, session, check_abandon=True)
        db.commit()
        db.refresh(session)
    return _summary(db, session)
