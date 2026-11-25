from datetime import timedelta
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from sqlmodel import select

from app.domain.recall import score as domain_score
from app.models import Recall, TapeItem, utcnow
from tests.test_sessions_api import TERMS, item_ids, make_env, make_tape

FULL = "alpha beta gamma"


def post(client: TestClient, track_id: str, text: str, event_id=None, source="typed"):
    return client.post(
        f"/api/tracks/{track_id}/recalls",
        json={"client_event_id": event_id or str(uuid4()), "text": text, "source": source},
    )


def setup():
    client, db = make_env()
    tape = make_tape(client)
    return client, db, tape, item_ids(tape)


def test_recall_scores_and_updates_memory() -> None:
    client, db, _, (t1, *_rest) = setup()
    res = post(client, t1, "Alpha and BETA")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["score"] == 2 / 3
    assert body["matched"] == ["alpha", "beta"]
    assert body["missed"] == ["gamma"]
    mem = body["memory"]
    assert mem["recorded"] is True
    assert mem["review_count"] == 1
    assert mem["strength"] == 100  # 2/3 >= 0.6 passes: base 100, no time elapsed
    rows = db.exec(select(Recall)).all()
    assert len(rows) == 1
    assert rows[0].source == "typed"
    assert rows[0].strength_before is None
    assert rows[0].strength_after == 100


def test_recall_text_is_never_stored() -> None:
    client, db, _, (t1, *_rest) = setup()
    secret = "zebra-unique-marker alpha"
    assert post(client, t1, secret).status_code == 200
    for rec in db.exec(select(Recall)).all():
        assert "zebra" not in repr(rec.model_dump())
    for item in db.exec(select(TapeItem)).all():
        assert "zebra" not in repr(item.model_dump())
    # Nothing in the database file contains the text (check every table dump)
    raw = db.connection().connection.driver_connection.iterdump()
    assert not any("zebra" in line for line in raw)


def test_duplicate_client_event_id_applies_once() -> None:
    client, db, _, (t1, *_rest) = setup()
    eid = str(uuid4())
    first = post(client, t1, FULL, eid).json()
    again = post(client, t1, "nothing relevant", eid).json()
    assert again["score"] == first["score"] == 1.0
    assert again["matched"] == first["matched"]
    assert len(db.exec(select(Recall)).all()) == 1
    item = db.get(TapeItem, UUID(t1))
    assert item is not None and item.review_count == 1


def test_rerecord_after_long_time_raises_stability() -> None:
    client, db, _, (t1, *_rest) = setup()
    post(client, t1, FULL)
    item = db.get(TapeItem, UUID(t1))
    assert item is not None
    before = item.stability_days
    item.last_reviewed_at = utcnow() - timedelta(days=30)
    db.add(item)
    db.commit()
    second_id = uuid4()
    mem = post(client, t1, FULL, str(second_id)).json()["memory"]
    assert mem["stability_days"] > before
    # Look the row up by its event id: two recalls a moment apart can share a timestamp.
    row = db.exec(select(Recall).where(Recall.client_event_id == second_id)).first()
    assert row is not None and row.stability_after > row.stability_before
    assert row.strength_before == 0


def test_spam_rerecording_does_not_raise_stability() -> None:
    client, _, _, (t1, *_rest) = setup()
    first = post(client, t1, FULL).json()["memory"]["stability_days"]
    second = post(client, t1, FULL).json()["memory"]["stability_days"]
    assert second == first


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(count=st.integers(1, 5), text=st.text(max_size=60))
def test_property_each_distinct_id_applies_once(count: int, text: str) -> None:
    client, db, _, (t1, *_rest) = setup()
    ids = [str(uuid4()) for _ in range(count)]
    for eid in ids + ids:  # every id is delivered twice
        assert post(client, t1, text, eid).status_code == 200
    assert len(db.exec(select(Recall)).all()) == count
    expected = domain_score(TERMS, text).score
    item = db.get(TapeItem, UUID(t1))
    assert item is not None and item.review_count == count
    assert post(client, t1, text, ids[0]).json()["score"] == expected


def test_unknown_track_is_404() -> None:
    client, *_ = setup()
    assert post(client, str(uuid4()), FULL).status_code == 404


def test_other_listeners_track_is_404() -> None:
    client, _, _, (t1, *_rest) = setup()
    res = client.post(
        f"/api/tracks/{t1}/recalls",
        json={"client_event_id": str(uuid4()), "text": FULL, "source": "typed"},
        headers={"X-Listener-Id": str(uuid4())},
    )
    assert res.status_code == 404


def test_interlude_is_rejected() -> None:
    client, _, _, ids = setup()
    assert post(client, ids[1], FULL).status_code in (404, 422)


def test_text_limit_and_source_validation() -> None:
    client, _, _, (t1, *_rest) = setup()
    assert post(client, t1, "a" * 5000).status_code == 200
    assert post(client, t1, "a" * 5001).status_code == 422
    assert post(client, t1, FULL, source="telepathy").status_code == 422
    bad = client.post(f"/api/tracks/{t1}/recalls", json={"text": FULL, "source": "typed"})
    assert bad.status_code == 422


def test_missing_listener_header_is_400() -> None:
    client, *_ = setup()
    res = client.post(
        f"/api/tracks/{uuid4()}/recalls",
        json={"client_event_id": str(uuid4()), "text": "x", "source": "typed"},
        headers={"X-Listener-Id": ""},
    )
    assert res.status_code == 400
