from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from main import app


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTableQuery:
    def __init__(self, table_name: str, store: dict[str, list[dict]]):
        self.table_name = table_name
        self.store = store
        self._action = "select"
        self._filters: list[tuple[str, str, object]] = []
        self._insert_payload = None
        self._update_payload = None
        self._limit = None

    def select(self, _fields: str):
        self._action = "select"
        return self

    def eq(self, key: str, value: str):
        self._filters.append(("eq", key, value))
        return self

    def gte(self, key: str, value: str):
        self._filters.append(("gte", key, value))
        return self

    def order(self, _field: str, desc: bool = False):
        _ = desc
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def insert(self, payload):
        self._action = "insert"
        self._insert_payload = payload
        return self

    def update(self, payload: dict):
        self._action = "update"
        self._update_payload = payload
        return self

    def _match(self, row: dict, kind: str, key: str, value: object) -> bool:
        current = row.get(key)
        if kind == "eq":
            return str(current) == str(value)
        if kind == "gte":
            return str(current) >= str(value)
        return True

    def _filtered_rows(self) -> list[dict]:
        rows = list(self.store.get(self.table_name, []))
        for kind, key, value in self._filters:
            rows = [r for r in rows if self._match(r, kind, key, value)]
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self):
        if self._action == "select":
            return FakeResult(self._filtered_rows())

        if self._action == "insert":
            payload = self._insert_payload
            rows = payload if isinstance(payload, list) else [payload]
            inserted_rows: list[dict] = []
            now_iso = datetime.now(timezone.utc).isoformat()

            for item in rows:
                inserted = dict(item)
                if self.table_name == "notifications":
                    inserted.setdefault("notif_id", str(uuid4()))
                    inserted.setdefault("is_seen", False)
                    inserted.setdefault("received_at", now_iso)
                self.store.setdefault(self.table_name, []).append(inserted)
                inserted_rows.append(inserted)

            return FakeResult(inserted_rows)

        if self._action == "update":
            updated_rows: list[dict] = []
            for row in self.store.get(self.table_name, []):
                if all(self._match(row, kind, key, value) for kind, key, value in self._filters):
                    row.update(self._update_payload)
                    updated_rows.append(dict(row))
            return FakeResult(updated_rows)

        return FakeResult([])


class FakeSupabaseClient:
    def __init__(self, store: dict[str, list[dict]]):
        self.store = store

    def table(self, table_name: str) -> FakeTableQuery:
        return FakeTableQuery(table_name, self.store)


@pytest.fixture
def client():
    return TestClient(app)
