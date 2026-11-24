import string
from collections.abc import Iterator
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from hypothesis import given, settings, strategies as st
from sqlmodel import Session, select

from app.db import create_db_and_tables, get_session, make_engine
from app.deps import get_listener, parse_listener_id
from app.models import Listener, Tape


def make_client() -> tuple[TestClient, Session]:
    """App with a test-only tape route scoped by listener, on an in-memory DB."""
    engine = make_engine("sqlite://")
    create_db_and_tables(engine)
    db = Session(engine)
    app = FastAPI()

    def _session() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_session] = _session

    @app.get("/probe/tapes/{tape_id}")
    def probe(tape_id: UUID, listener: Listener = Depends(get_listener)) -> dict:
        tape = db.exec(
            select(Tape).where(Tape.id == tape_id, Tape.listener_id == listener.listener_id)
        ).first()
        if tape is None:
            raise HTTPException(status_code=404, detail="Tape not found")
        return {"id": str(tape.id)}

    return TestClient(app), db


def test_missing_header_returns_400() -> None:
    client, _ = make_client()
    assert client.get(f"/probe/tapes/{uuid4()}").status_code == 400


def test_non_v4_uuid_returns_400() -> None:
    client, _ = make_client()
    v1 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    res = client.get(f"/probe/tapes/{uuid4()}", headers={"X-Listener-Id": v1})
    assert res.status_code == 400


@settings(max_examples=100, deadline=None)
@given(
    st.text(alphabet=string.printable.strip(), max_size=60).filter(
        lambda s: parse_listener_id(s) is None
    )
)
def test_malformed_header_returns_400(value: str) -> None:
    """**Validates: Requirements 1.3**"""
    client, _ = make_client()
    res = client.get(f"/probe/tapes/{uuid4()}", headers={"X-Listener-Id": value})
    assert res.status_code == 400


@settings(max_examples=50, deadline=None)
@given(st.uuids(version=4))
def test_valid_v4_is_accepted(listener_id: UUID) -> None:
    """**Validates: Requirements 1.2**"""
    assert parse_listener_id(str(listener_id)) == listener_id


def test_first_use_creates_listener_with_defaults_once() -> None:
    client, db = make_client()
    lid = uuid4()
    for _ in range(2):
        res = client.get(f"/probe/tapes/{uuid4()}", headers={"X-Listener-Id": str(lid)})
        assert res.status_code == 404  # valid listener, no such tape
    rows = db.exec(select(Listener)).all()
    assert len(rows) == 1
    assert rows[0].listener_id == lid
    assert rows[0].demo_mode is False
    assert rows[0].time_scale == 1


def test_other_listeners_tape_returns_404() -> None:
    client, db = make_client()
    owner, other = uuid4(), uuid4()
    tape = Tape(listener_id=owner, title="Mine", length="C60")
    db.add(tape)
    db.commit()
    url = f"/probe/tapes/{tape.id}"
    assert client.get(url, headers={"X-Listener-Id": str(owner)}).status_code == 200
    assert client.get(url, headers={"X-Listener-Id": str(other)}).status_code == 404
