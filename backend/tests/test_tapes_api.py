from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import create_db_and_tables, get_session, make_engine
from app.main import create_app
from app.models import Listener, Recall, Tape, TapeItem
from app.models import Session as StudySession
from app.models import utcnow


@pytest.fixture
def env():
    engine = make_engine("sqlite://")
    create_db_and_tables(engine)
    db = Session(engine)
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db
    lid = uuid4()
    client = TestClient(app, headers={"X-Listener-Id": str(lid)})
    yield client, db, lid
    db.close()


def track(name: str = "Cells", minutes: int = 10, **extra) -> dict:
    return {
        "kind": "track",
        "name": name,
        "minutes": minutes,
        "key_terms": ["alpha", "beta", "gamma"],
        **extra,
    }


def interlude(minutes: int = 5) -> dict:
    return {"kind": "interlude", "minutes": minutes}


def body(**over) -> dict:
    base = {
        "title": "Bio",
        "length": "C60",
        "side_a": [track("One"), interlude(), track("Two")],
        "side_b": [track("Three")],
    }
    return {**base, **over}


def test_create_returns_mint_unrecorded_tape(env) -> None:
    client, _, _ = env
    res = client.post("/api/tapes", json=body())
    assert res.status_code == 201
    data = res.json()
    assert data["condition"] == "Mint"
    assert data["strength"] is None
    assert data["due_count"] == 0
    assert data["ghost"] is False
    assert data["next_review_at"] is None
    assert data["remaining_a"] == 5 and data["remaining_b"] == 20
    first = data["side_a"][0]
    assert first["memory"]["recorded"] is False
    assert first["memory"]["stability_days"] == 1.0
    assert data["side_a"][1]["memory"] is None


@pytest.mark.parametrize("side_a", [[], [interlude()]])
def test_tape_with_no_tracks_is_422(env, side_a) -> None:
    client, _, _ = env
    res = client.post("/api/tapes", json=body(side_a=side_a, side_b=[]))
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert {"rule": "no_tracks", "side": None, "message": "Add at least one track."} in detail
    assert client.get("/api/tapes").json() == []


def test_update_to_a_tape_with_no_tracks_is_422(env) -> None:
    client, _, _ = env
    tape_id = client.post("/api/tapes", json=body()).json()["id"]
    res = client.put(f"/api/tapes/{tape_id}", json=body(side_a=[], side_b=[]))
    assert res.status_code == 422
    assert any(v["rule"] == "no_tracks" for v in res.json()["detail"])


def test_rule_violations_are_422_with_rule_side_message(env) -> None:
    client, _, _ = env
    res = client.post(
        "/api/tapes",
        json=body(side_a=[track("A", 30), track("B", 20)], side_b=[track("X", 5)]),
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert all(set(v) == {"rule", "side", "message"} for v in detail)
    rules = {(v["rule"], v["side"]) for v in detail}
    assert ("capacity", "A") in rules
    assert ("adjacent_tracks", "A") in rules
    assert ("track_minutes", "B") in rules


def test_demo_mode_allows_short_tracks(env) -> None:
    client, db, lid = env
    short = body(side_a=[track("Short", 1)], side_b=[])
    assert client.post("/api/tapes", json=short).status_code == 422
    client.get("/api/tapes")  # creates the listener
    listener = db.get(Listener, lid)
    listener.demo_mode = True
    db.add(listener)
    db.commit()
    assert client.post("/api/tapes", json=short).status_code == 201


def test_get_list_and_listener_scoping(env) -> None:
    client, _, _ = env
    tape_id = client.post("/api/tapes", json=body()).json()["id"]
    assert [t["id"] for t in client.get("/api/tapes").json()] == [tape_id]
    assert client.get(f"/api/tapes/{tape_id}").status_code == 200
    other = {"X-Listener-Id": str(uuid4())}
    assert client.get("/api/tapes", headers=other).json() == []
    assert client.get(f"/api/tapes/{tape_id}", headers=other).status_code == 404
    assert client.put(f"/api/tapes/{tape_id}", json=body(), headers=other).status_code == 404
    assert client.delete(f"/api/tapes/{tape_id}", headers=other).status_code == 404


def record(db: Session, item_id: str, base: int, stability: float, age_days: float) -> None:
    item = db.get(TapeItem, UUID(item_id))
    item.base_strength = base
    item.stability_days = stability
    item.last_reviewed_at = utcnow() - timedelta(days=age_days)
    item.review_count = 1
    db.add(item)
    db.commit()


def test_memory_strength_condition_due_and_ghost(env) -> None:
    client, db, _ = env
    data = client.post("/api/tapes", json=body()).json()
    one, two, three = data["side_a"][0], data["side_a"][2], data["side_b"][0]
    record(db, one["id"], 100, 10.0, 1.0)  # ~90, Mint, not due
    record(db, two["id"], 100, 3.0, 1.2)  # ~67, Worn, due
    out = client.get(f"/api/tapes/{data['id']}").json()
    m1, m2 = out["side_a"][0]["memory"], out["side_a"][2]["memory"]
    assert (m1["strength"], m1["condition"], m1["due"]) == (90, "Mint", False)
    assert (m2["strength"], m2["condition"], m2["due"]) == (67, "Worn", True)
    assert out["due_count"] == 1
    assert out["strength"] == 79  # mean of 90 and 67 = 78.5
    assert out["condition"] == "Worn"
    assert out["next_review_at"] == m2["next_review_at"] or out["next_review_at"] is not None
    assert out["ghost"] is False

    for item_id in (one["id"], two["id"], three["id"]):
        record(db, item_id, 100, 0.25, 30.0)
    ghost = client.get(f"/api/tapes/{data['id']}").json()
    assert ghost["ghost"] is True and ghost["condition"] == "Dead" and ghost["strength"] == 0


def test_put_resets_only_tracks_whose_key_terms_change(env) -> None:
    client, db, _ = env
    data = client.post("/api/tapes", json=body()).json()
    ids = [data["side_a"][0]["id"], data["side_a"][2]["id"]]
    for item_id in ids:
        record(db, item_id, 100, 5.0, 0.1)
    changed = {**track("One"), "id": ids[0], "key_terms": ["alpha", "beta", "delta"]}
    kept = {**track("Two"), "id": ids[1]}
    res = client.put(
        f"/api/tapes/{data['id']}",
        json=body(title="Renamed", side_a=[changed, interlude(), kept], side_b=[]),
    )
    assert res.status_code == 200
    out = res.json()
    assert out["title"] == "Renamed"
    assert out["side_a"][0]["id"] == ids[0]
    assert out["side_a"][0]["memory"]["recorded"] is False
    assert out["side_a"][0]["memory"]["stability_days"] == 1.0
    assert out["side_a"][2]["memory"]["recorded"] is True
    assert out["side_a"][2]["memory"]["stability_days"] == 5.0
    assert out["side_b"] == []


def test_put_rule_violation_is_422(env) -> None:
    client, _, _ = env
    tape_id = client.post("/api/tapes", json=body()).json()["id"]
    res = client.put(f"/api/tapes/{tape_id}", json=body(title=""))
    assert res.status_code == 422
    assert res.json()["detail"][0]["rule"] == "title"


def test_put_during_active_session_returns_409(env) -> None:
    client, db, _ = env
    tape_id = client.post("/api/tapes", json=body()).json()["id"]
    study = StudySession(tape_id=UUID(tape_id))
    db.add(study)
    db.commit()
    assert client.put(f"/api/tapes/{tape_id}", json=body(title="New")).status_code == 409
    study.ended_at = utcnow()
    db.add(study)
    db.commit()
    assert client.put(f"/api/tapes/{tape_id}", json=body(title="New")).status_code == 200


def test_demo_tape_edit_keeps_unchanged_short_tracks_valid_after_demo_off(env) -> None:
    client, db, lid = env
    client.get("/api/tapes")
    listener = db.get(Listener, lid)
    listener.demo_mode = True
    db.add(listener)
    db.commit()
    created = client.post(
        "/api/tapes", json=body(side_a=[track("Short", 1)], side_b=[])
    ).json()
    short = created["side_a"][0]
    listener.demo_mode = False
    db.add(listener)
    db.commit()

    unchanged = {**track("Short renamed", 1), "id": short["id"]}
    res = client.put(f"/api/tapes/{created['id']}", json=body(side_a=[unchanged], side_b=[]))
    assert res.status_code == 200

    # A changed duration, or a brand new track, still needs 10 minutes.
    changed = {**track("Short", 2), "id": short["id"]}
    res = client.put(f"/api/tapes/{created['id']}", json=body(side_a=[changed], side_b=[]))
    assert res.status_code == 422
    res = client.put(
        f"/api/tapes/{created['id']}",
        json=body(side_a=[unchanged, interlude(), track("New", 3)], side_b=[]),
    )
    assert res.status_code == 422


def test_delete_removes_tape_sessions_and_recalls(env) -> None:
    client, db, _ = env
    data = client.post("/api/tapes", json=body()).json()
    track_id = UUID(data["side_a"][0]["id"])
    db.add(StudySession(tape_id=UUID(data["id"]), ended_at=utcnow()))
    db.add(
        Recall(
            track_id=track_id,
            client_event_id=uuid4(),
            at=utcnow(),
            source="typed",
            score=0.5,
            strength_after=50,
            stability_before=1.0,
            stability_after=1.0,
        )
    )
    db.commit()
    assert client.delete(f"/api/tapes/{data['id']}").status_code == 204
    assert client.get(f"/api/tapes/{data['id']}").status_code == 404
    db.expire_all()
    assert db.exec(select(Tape)).all() == []
    assert db.exec(select(TapeItem)).all() == []
    assert db.exec(select(StudySession)).all() == []
    assert db.exec(select(Recall)).all() == []


def test_sample_tape_seeds_memory_and_recalls(env) -> None:
    client, db, _ = env
    res = client.post("/api/tapes/sample")
    assert res.status_code == 201
    data = res.json()
    assert data["is_sample"] is True
    assert data["title"] == "Sample: Biology Basics" and data["length"] == "C60"
    assert [i["kind"] for i in data["side_a"]] == ["track", "interlude", "track"]
    assert [i["kind"] for i in data["side_b"]] == ["track", "interlude", "track"]
    tracks = [i for i in data["side_a"] + data["side_b"] if i["kind"] == "track"]
    assert [t["name"] for t in tracks] == [
        "Photosynthesis",
        "Cell respiration",
        "Enzymes",
        "DNA replication",
    ]
    assert [len(t["key_terms"]) for t in tracks] == [4, 4, 4, 5]
    memory = [(t["memory"]["strength"], t["memory"]["condition"], t["memory"]["due"]) for t in tracks]
    assert memory == [
        (90, "Mint", False),
        (67, "Worn", True),
        (29, "Warped", True),
        (8, "Haunted", True),
    ]
    assert data["strength"] == 49 and data["condition"] == "Warped"
    assert data["due_count"] == 3 and data["ghost"] is False

    recalls = db.exec(select(Recall)).all()
    assert len(recalls) == 4
    assert sorted(r.score for r in recalls) == [0.4, 0.75, 0.75, 0.75]
    assert {r.track_id for r in recalls} == {UUID(t["id"]) for t in tracks}
    assert db.get(Tape, UUID(data["id"])).is_sample is True


def test_sample_tape_is_scoped_and_listed_only_for_its_listener(env) -> None:
    client, _, _ = env
    tape_id = client.post("/api/tapes/sample").json()["id"]
    assert [t["id"] for t in client.get("/api/tapes").json()] == [tape_id]
    other = {"X-Listener-Id": str(uuid4())}
    assert client.get("/api/tapes", headers=other).json() == []
    assert client.get(f"/api/tapes/{tape_id}", headers=other).status_code == 404


def test_sample_tape_requires_listener_header(env) -> None:
    client, _, _ = env
    res = client.post("/api/tapes/sample", headers={"X-Listener-Id": "nope"})
    assert res.status_code == 400
