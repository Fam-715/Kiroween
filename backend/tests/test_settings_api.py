from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import create_db_and_tables, get_session, make_engine
from app.main import create_app


@pytest.fixture
def env():
    engine = make_engine("sqlite://")
    create_db_and_tables(engine)
    db = Session(engine)
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db
    client = TestClient(app)
    yield client, str(uuid4())
    db.close()


def one_minute_tape() -> dict:
    return {
        "title": "Quick",
        "length": "C60",
        "side_a": [
            {"kind": "track", "name": "T", "minutes": 1, "key_terms": ["a", "b", "c"]}
        ],
        "side_b": [],
    }


def demo_mode_of(client: TestClient, headers: dict) -> bool:
    return client.get("/api/settings", headers=headers).json()["demo_mode"]


def test_default_is_off(env, monkeypatch) -> None:
    monkeypatch.delenv("ALLOW_TIME_WARP", raising=False)
    client, lid = env
    before = datetime.now(UTC)
    res = client.get("/api/settings", headers={"X-Listener-Id": lid})
    after = datetime.now(UTC)
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {
        "demo_mode",
        "time_warp_allowed",
        "time_warp_enabled",
        "time_scale",
        "real_now",
        "virtual_now",
    }
    assert body["demo_mode"] is False
    assert body["time_warp_allowed"] is False
    assert body["time_warp_enabled"] is False
    assert body["time_scale"] == 1
    real_now = datetime.fromisoformat(body["real_now"])
    virtual_now = datetime.fromisoformat(body["virtual_now"])
    assert before <= real_now.replace(tzinfo=real_now.tzinfo or UTC) <= after
    # Clock scale is 1 and anchors were set together, so virtual time tracks real time.
    assert abs((virtual_now.replace(tzinfo=virtual_now.tzinfo or UTC) - before).total_seconds()) < 5


@pytest.mark.parametrize(
    ("value", "expected"), [("true", True), ("TRUE", True), ("false", False), ("", False)]
)
def test_time_warp_allowed_follows_env(env, monkeypatch, value, expected) -> None:
    monkeypatch.setenv("ALLOW_TIME_WARP", value)
    client, lid = env
    body = client.get("/api/settings", headers={"X-Listener-Id": lid}).json()
    assert body["time_warp_allowed"] is expected
    assert body["time_warp_enabled"] is False
    assert body["time_scale"] == 1


def test_put_toggles_and_persists(env) -> None:
    client, lid = env
    h = {"X-Listener-Id": lid}
    res = client.put("/api/settings", json={"demo_mode": True}, headers=h)
    assert res.status_code == 200 and res.json()["demo_mode"] is True
    assert res.json()["time_warp_enabled"] is False
    assert demo_mode_of(client, h) is True
    client.put("/api/settings", json={"demo_mode": False}, headers=h)
    assert demo_mode_of(client, h) is False


def test_settings_are_scoped_per_listener(env) -> None:
    client, lid = env
    other = str(uuid4())
    client.put("/api/settings", json={"demo_mode": True}, headers={"X-Listener-Id": lid})
    assert demo_mode_of(client, {"X-Listener-Id": other}) is False


@pytest.mark.parametrize("header", [{}, {"X-Listener-Id": "nope"}])
def test_bad_listener_id_is_400(env, header) -> None:
    client, _ = env
    assert client.get("/api/settings", headers=header).status_code == 400
    assert client.put("/api/settings", json={"demo_mode": True}, headers=header).status_code == 400


def test_put_rejects_invalid_body(env) -> None:
    client, lid = env
    res = client.put("/api/settings", json={}, headers={"X-Listener-Id": lid})
    assert res.status_code == 422


def test_one_minute_track_needs_demo_mode(env) -> None:
    client, lid = env
    h = {"X-Listener-Id": lid}
    assert client.post("/api/tapes", json=one_minute_tape(), headers=h).status_code == 422
    client.put("/api/settings", json={"demo_mode": True}, headers=h)
    assert client.post("/api/tapes", json=one_minute_tape(), headers=h).status_code == 201


def test_time_warp_forbidden_when_not_allowed(env, monkeypatch) -> None:
    monkeypatch.delenv("ALLOW_TIME_WARP", raising=False)
    client, lid = env
    h = {"X-Listener-Id": lid}
    assert client.put("/api/settings", json={"time_warp": True}, headers=h).status_code == 403
    body = client.get("/api/settings", headers=h).json()
    assert body["time_warp_enabled"] is False and body["time_scale"] == 1
    # turning it off is always fine
    assert client.put("/api/settings", json={"time_warp": False}, headers=h).status_code == 200


def test_time_warp_toggle_is_continuous(env, monkeypatch) -> None:
    monkeypatch.setenv("ALLOW_TIME_WARP", "true")
    client, lid = env
    h = {"X-Listener-Id": lid}

    def vnow(body: dict) -> datetime:
        return datetime.fromisoformat(body["virtual_now"])

    before = client.get("/api/settings", headers=h).json()
    on = client.put("/api/settings", json={"time_warp": True}, headers=h).json()
    assert on["time_warp_enabled"] is True and on["time_scale"] == 1440
    assert on["time_warp_allowed"] is True
    # virtual time did not jump at the toggle (well under a minute of drift)
    assert 0 <= (vnow(on) - vnow(before)).total_seconds() < 3600
    off = client.put("/api/settings", json={"time_warp": False}, headers=h).json()
    assert off["time_warp_enabled"] is False and off["time_scale"] == 1
    assert 0 <= (vnow(off) - vnow(on)).total_seconds() < 3600
    # demo_mode untouched by a time_warp-only PUT
    assert off["demo_mode"] is False


def test_time_warp_put_keeps_demo_mode_and_vice_versa(env, monkeypatch) -> None:
    monkeypatch.setenv("ALLOW_TIME_WARP", "true")
    client, lid = env
    h = {"X-Listener-Id": lid}
    client.put("/api/settings", json={"demo_mode": True}, headers=h)
    res = client.put("/api/settings", json={"time_warp": True}, headers=h).json()
    assert res["demo_mode"] is True and res["time_warp_enabled"] is True
    res = client.put("/api/settings", json={"demo_mode": False}, headers=h).json()
    assert res["time_warp_enabled"] is True


def test_time_warp_runs_faster_than_real(env, monkeypatch) -> None:
    import time

    monkeypatch.setenv("ALLOW_TIME_WARP", "true")
    client, lid = env
    h = {"X-Listener-Id": lid}
    a = client.put("/api/settings", json={"time_warp": True}, headers=h).json()
    time.sleep(0.05)
    b = client.get("/api/settings", headers=h).json()
    dv = (datetime.fromisoformat(b["virtual_now"]) - datetime.fromisoformat(a["virtual_now"])).total_seconds()
    dr = (datetime.fromisoformat(b["real_now"]) - datetime.fromisoformat(a["real_now"])).total_seconds()
    assert dv == pytest.approx(dr * 1440, rel=1e-6)
