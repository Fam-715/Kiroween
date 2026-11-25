"""Recall API: score a recall, update the track's memory, store the result (not the text).

Idempotent on `client_event_id`: a duplicate returns the original score and applies
nothing again.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session as DbSession
from sqlmodel import select

from app.api.tapes import _aware, _memory, _virtual_now
from app.db import get_session
from app.deps import get_listener
from app.domain import recall as recall_rules
from app.domain import strength
from app.models import Listener, Recall, Tape, TapeItem
from app.schemas import RecallIn, RecallOut

router = APIRouter(tags=["recalls"])

Db = Annotated[DbSession, Depends(get_session)]
CurrentListener = Annotated[Listener, Depends(get_listener)]


def _get_track(db: DbSession, listener: Listener, track_id: UUID) -> TapeItem:
    item = db.exec(
        select(TapeItem)
        .join(Tape, Tape.id == TapeItem.tape_id)  # type: ignore[arg-type]
        .where(TapeItem.id == track_id, Tape.listener_id == listener.listener_id)
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Track not found")
    if item.kind != "track":
        raise HTTPException(status_code=422, detail="Interludes cannot be recalled")
    return item


def _find(db: DbSession, track_id: UUID, client_event_id: UUID) -> Recall | None:
    return db.exec(
        select(Recall).where(
            Recall.track_id == track_id, Recall.client_event_id == client_event_id
        )
    ).first()


def _out(rec: Recall, item: TapeItem, listener: Listener) -> RecallOut:
    return RecallOut(
        score=rec.score,
        matched=list(rec.matched_terms),
        missed=list(rec.missed_terms),
        memory=_memory(item, _virtual_now(listener)),
    )


@router.post("/tracks/{track_id}/recalls", response_model=RecallOut)
def post_recall(
    track_id: UUID, body: RecallIn, db: Db, listener: CurrentListener
) -> RecallOut:
    item = _get_track(db, listener, track_id)
    existing = _find(db, item.id, body.client_event_id)
    if existing is not None:  # duplicate delivery: nothing is applied again
        return _out(existing, item, listener)

    now = _virtual_now(listener)
    result = recall_rules.score(item.key_terms or [], body.text)
    before_strength: int | None = None
    if item.base_strength is not None and item.last_reviewed_at is not None:
        elapsed = (now - _aware(item.last_reviewed_at)).total_seconds() / 86400
        before_strength = strength.strength_at(item.base_strength, item.stability_days, elapsed)

    memory = strength.TrackMemory(
        base_strength=item.base_strength if item.base_strength is not None else 0,
        stability_days=item.stability_days,
        last_reviewed_at=_aware(item.last_reviewed_at) if item.last_reviewed_at else None,
        review_count=item.review_count,
    )
    updated = strength.review(memory, result.score, now)

    rec = Recall(
        track_id=item.id,
        client_event_id=body.client_event_id,
        at=now,
        source=body.source,
        score=result.score,
        matched_terms=list(result.matched),
        missed_terms=list(result.missed),
        strength_before=before_strength,
        strength_after=updated.base_strength,
        stability_before=item.stability_days,
        stability_after=updated.stability_days,
    )
    item.base_strength = updated.base_strength
    item.stability_days = updated.stability_days
    item.last_reviewed_at = updated.last_reviewed_at
    item.review_count = updated.review_count
    db.add(item)
    db.add(rec)
    try:
        db.commit()
    except IntegrityError:  # a concurrent duplicate won the race
        db.rollback()
        winner = _find(db, track_id, body.client_event_id)
        if winner is None:
            raise
        return _out(winner, _get_track(db, listener, track_id), listener)
    db.refresh(item)
    db.refresh(rec)
    return _out(rec, item, listener)
