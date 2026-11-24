from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from sqlmodel import SQLModel

from app import db
from app.main import create_app


def test_lifespan_creates_all_tables(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    test_engine = db.make_engine(f"sqlite:///{(tmp_path / 'lifespan.db').as_posix()}")
    monkeypatch.setattr(db, "engine", test_engine)

    with TestClient(create_app()):
        existing = set(inspect(test_engine).get_table_names())

    assert set(SQLModel.metadata.tables) <= existing
    test_engine.dispose()
