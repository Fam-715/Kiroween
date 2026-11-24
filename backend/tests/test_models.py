from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from app.db import create_db_and_tables, make_engine
from app.models import Recall, Session as StudySession, SessionEvent, Tape, TapeItem


@pytest.fixture()
def db():
    engine = make_engine("sqlite://")
    create_db_and_tables(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


def _tape_with_track(db: Session) -> tuple[Tape, TapeItem]:
    tape = Tape(listener_id=uuid4(), title="T", length="C60")
    db.add(tape)
    db.commit()
    track = TapeItem(
        tape_id=tape.id, side="A", position=0, kind="track", name="X",
        minutes=10, key_terms=["a", "b", "c"],
    )
    db.add(track)
    db.commit()
    return tape, track


def test_defaults(db: Session) -> None:
    tape, track = _tape_with_track(db)
    db.refresh(track)
    assert tape.is_sample is False
    assert track.stability_days == 1.0
    assert track.base_strength is None
    assert track.last_reviewed_at is None
    assert track.review_count == 0
    assert track.key_terms == ["a", "b", "c"]
    db.refresh(tape)
    assert tape.created_at.tzinfo is not None


def test_duplicate_recall_client_event_id_rejected(db: Session) -> None:
    _, track = _tape_with_track(db)
    cid = uuid4()

    def make() -> Recall:
        return Recall(
            track_id=track.id, client_event_id=cid, at=datetime(2026, 1, 1, tzinfo=UTC),
            source="typed", score=0.5, matched_terms=["a"], missed_terms=["b"],
            strength_after=80, stability_before=1.0, stability_after=1.5,
        )

    db.add(make())
    db.commit()
    db.add(make())
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_session_event_rejected(db: Session) -> None:
    tape, _ = _tape_with_track(db)
    s = StudySession(tape_id=tape.id)
    db.add(s)
    db.commit()
    cid = uuid4()
    db.add(SessionEvent(session_id=s.id, client_event_id=cid, type="skip"))
    db.commit()
    db.add(SessionEvent(session_id=s.id, client_event_id=cid, type="skip"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_deleting_tape_cascades(db: Session) -> None:
    tape, track = _tape_with_track(db)
    s = StudySession(tape_id=tape.id)
    db.add(s)
    db.commit()
    db.add(SessionEvent(session_id=s.id, item_id=track.id, client_event_id=uuid4(), type="complete"))
    db.add(Recall(
        track_id=track.id, client_event_id=uuid4(), at=datetime(2026, 1, 1, tzinfo=UTC), source="speech",
        score=1.0, strength_after=100, stability_before=1.0, stability_after=2.0,
    ))
    db.commit()

    db.delete(db.get(Tape, tape.id))
    db.commit()
    db.expire_all()

    for model in (TapeItem, StudySession, Recall, SessionEvent):
        assert db.exec(select(model)).all() == []
