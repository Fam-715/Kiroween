from uuid import uuid4

from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from sqlmodel import Session

from app.db import create_db_and_tables, get_session, make_engine
from app.domain.session import apply_penalty_to_tracks, is_abandoned, skip_penalty_kind
from app.main import create_app

TERMS = ["alpha", "beta", "gamma"]


def make_env():
    engine = make_engine("sqlite://")
    create_db_and_tables(engine)
    db = Session(engine)
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db
    client = TestClient(app, headers={"X-Listener-Id": str(uuid4())})
    return client, db


def make_tape(client: TestClient) -> dict:
    """Side A: t1(10) i(5) t2(10); Side B: t3(10). Returns the tape JSON."""
    t = lambda n: {"kind": "track", "name": n, "minutes": 10, "key_terms": TERMS}  # noqa: E731
    res = client.post(
        "/api/tapes",
        json={
            "title": "Bio",
            "length": "C60",
            "side_a": [t("One"), {"kind": "interlude", "minutes": 5}, t("Two")],
            "side_b": [t("Three")],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def item_ids(tape: dict) -> list[str]:
    return [i["id"] for i in tape["side_a"] + tape["side_b"]]


def start(client: TestClient, tape: dict) -> str:
    res = client.post(f"/api/tapes/{tape['id']}/sessions")
    assert res.status_code == 201, res.text
    return res.json()["id"]


def send(client, sid, item_id, type_, event_id=None):
    return client.post(
        f"/api/sessions/{sid}/events",
        json={"client_event_id": event_id or str(uuid4()), "type": type_, "item_id": item_id},
    )


def stabilities(client, tape_id) -> list[float]:
    t = client.get(f"/api/tapes/{tape_id}").json()
    return [i["memory"]["stability_days"] for i in t["side_a"] + t["side_b"] if i["memory"]]


def test_start_requires_own_tape() -> None:
    client, _ = make_env()
    assert client.post(f"/api/tapes/{uuid4()}/sessions").status_code == 404


def test_skip_interlude_penalises_completed_tracks_only() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    t1, interlude, t2, t3 = item_ids(tape)
    sid = start(client, tape)
    assert send(client, sid, t1, "complete").json()["penalty"] == []
    res = send(client, sid, interlude, "skip").json()
    assert [(p["track_id"], p["stability_before"], p["stability_after"]) for p in res["penalty"]] == [
        (t1, 1.0, 0.9)
    ]
    assert stabilities(client, tape["id"]) == [0.9, 1.0, 1.0]
    # skipping a track hits t1 only (t2 is the skipped one), with the 0.95 factor
    res = send(client, sid, t2, "skip").json()
    assert res["penalty"][0]["stability_after"] == 0.9 * 0.95


def test_duplicate_event_id_applied_once() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    t1, interlude, *_ = item_ids(tape)
    sid = start(client, tape)
    send(client, sid, t1, "complete")
    eid = str(uuid4())
    first = send(client, sid, interlude, "skip", eid).json()
    second = send(client, sid, interlude, "skip", eid)
    assert second.status_code == 200 and second.json() == first
    assert stabilities(client, tape["id"])[0] == 0.9


def test_invalid_event_type_and_foreign_item() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    sid = start(client, tape)
    assert send(client, sid, item_ids(tape)[0], "stop").status_code == 422
    assert send(client, sid, str(uuid4()), "complete").status_code == 422
    assert send(client, str(uuid4()), item_ids(tape)[0], "complete").status_code == 404


def test_session_ends_after_last_item_and_stop_returns_summary() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    ids = item_ids(tape)
    sid = start(client, tape)
    for i in ids[:-1]:
        assert send(client, sid, i, "complete").json()["session_ended"] is False
    assert send(client, sid, ids[-1], "complete").json()["session_ended"] is True
    assert send(client, sid, ids[0], "complete").status_code == 409
    summary = client.post(f"/api/sessions/{sid}/stop").json()
    assert summary["abandoned"] is False and summary["penalty"] == []
    assert summary["tracks_completed"] == 3 and summary["focus_minutes"] == 30


def test_stop_abandon_applies_once() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    t1 = item_ids(tape)[0]
    sid = start(client, tape)
    send(client, sid, t1, "complete")
    first = client.post(f"/api/sessions/{sid}/stop").json()
    assert first["abandoned"] is True
    assert first["penalty"][0]["track_id"] == t1
    assert stabilities(client, tape["id"]) == [0.8, 1.0, 1.0]
    second = client.post(f"/api/sessions/{sid}/stop").json()
    assert second == first
    assert stabilities(client, tape["id"]) == [0.8, 1.0, 1.0]


def test_stop_with_half_or_less_remaining_has_no_penalty() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    t1, interlude, t2, _ = item_ids(tape)
    sid = start(client, tape)
    for i in (t1, interlude, t2):  # 25 of 35 minutes played
        send(client, sid, i, "complete")
    summary = client.post(f"/api/sessions/{sid}/stop").json()
    assert summary["abandoned"] is False and summary["penalty"] == []
    assert stabilities(client, tape["id"]) == [1.0, 1.0, 1.0]


def test_stop_unknown_session_is_404() -> None:
    client, _ = make_env()
    assert client.post(f"/api/sessions/{uuid4()}/stop").status_code == 404


def test_tape_stats_from_sessions() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    t1, interlude, t2, _ = item_ids(tape)
    assert client.get(f"/api/tapes/{tape['id']}").json()["stats"] == {
        "sessions": 0,
        "focus_minutes": 0,
        "tracks_completed": 0,
        "tracks_skipped": 0,
    }
    sid = start(client, tape)
    send(client, sid, t1, "complete")
    send(client, sid, interlude, "skip")
    send(client, sid, t2, "skip")
    client.post(f"/api/sessions/{sid}/stop")
    assert client.get(f"/api/tapes/{tape['id']}").json()["stats"] == {
        "sessions": 1,
        "focus_minutes": 10,
        "tracks_completed": 1,
        "tracks_skipped": 1,
    }


def test_starting_again_stops_open_session() -> None:
    client, _ = make_env()
    tape = make_tape(client)
    old = start(client, tape)
    start(client, tape)
    assert client.post(f"/api/sessions/{old}/stop").json()["abandoned"] is True


# --- property tests -------------------------------------------------------------------
EVENT_PLAN = [(0, "complete"), (1, "skip"), (2, "complete"), (3, "skip")]


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    st.lists(st.integers(min_value=0, max_value=len(EVENT_PLAN) - 1), min_size=0, max_size=12),
)
def test_duplicate_delivery_patterns_give_same_state(extra: list[int]) -> None:
    """Delivering each event once, with any extra duplicates mixed in, ends in the same state."""
    ref_client, _ = make_env()
    ref_tape = make_tape(ref_client)
    ref_sid = start(ref_client, ref_tape)
    ref_ids = item_ids(ref_tape)
    for idx, kind in EVENT_PLAN:
        send(ref_client, ref_sid, ref_ids[idx], kind, f"00000000-0000-4000-8000-00000000000{idx}")

    client, _ = make_env()
    tape = make_tape(client)
    sid = start(client, tape)
    ids = item_ids(tape)
    delivered: list[int] = []
    for n, (idx, kind) in enumerate(EVENT_PLAN):
        for dup in [d for d in extra if d <= n]:  # re-deliver already-sent events
            didx, dkind = EVENT_PLAN[dup]
            send(client, sid, ids[didx], dkind, f"00000000-0000-4000-8000-00000000000{didx}")
            delivered.append(dup)
        send(client, sid, ids[idx], kind, f"00000000-0000-4000-8000-00000000000{idx}")

    assert stabilities(client, tape["id"]) == stabilities(ref_client, ref_tape["id"])
    a = client.post(f"/api/sessions/{sid}/stop").json()
    b = ref_client.post(f"/api/sessions/{ref_sid}/stop").json()
    for key in ("abandoned", "tracks_completed", "tracks_skipped", "focus_minutes"):
        assert a[key] == b[key]
    assert [p["stability_after"] for p in a["penalty"]] == [
        p["stability_after"] for p in b["penalty"]
    ]


@given(
    st.dictionaries(st.uuids().map(str), st.floats(0.25, 60.0), min_size=1, max_size=8),
    st.data(),
    st.sampled_from(["skip_interlude", "skip_track", "abandon"]),
)
def test_penalties_only_affect_listed_tracks_and_never_raise(stab, data, kind) -> None:
    keys = list(stab)
    chosen = data.draw(st.lists(st.sampled_from(keys), max_size=len(keys)))
    records = apply_penalty_to_tracks(stab, chosen, kind)
    assert {r.track_id for r in records} == set(chosen)
    for r in records:
        assert 0.25 <= r.stability_after <= r.stability_before <= 60.0


@given(st.integers(1, 500), st.integers(0, 500))
def test_is_abandoned_matches_half_rule(planned: int, played: int) -> None:
    played = min(played, planned)
    assert is_abandoned(planned, played) == ((planned - played) > planned / 2)


def test_skip_penalty_kind() -> None:
    assert skip_penalty_kind("interlude") == "skip_interlude"
    assert skip_penalty_kind("track") == "skip_track"
