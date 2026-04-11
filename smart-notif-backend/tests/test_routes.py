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
		self._filters: list[tuple[str, str]] = []
		self._insert_payload = None
		self._update_payload = None
		self._limit = None

	def select(self, _fields: str):
		self._action = "select"
		return self

	def eq(self, key: str, value: str):
		self._filters.append((key, value))
		return self

	def order(self, _field: str, desc: bool = False):
		_ = desc
		return self

	def limit(self, count: int):
		self._limit = count
		return self

	def insert(self, payload: dict):
		self._action = "insert"
		self._insert_payload = payload
		return self

	def update(self, payload: dict):
		self._action = "update"
		self._update_payload = payload
		return self

	def _filtered_rows(self) -> list[dict]:
		rows = list(self.store.get(self.table_name, []))
		for key, value in self._filters:
			rows = [r for r in rows if str(r.get(key)) == str(value)]
		if self._limit is not None:
			rows = rows[: self._limit]
		return rows

	def execute(self):
		if self._action == "select":
			return FakeResult(self._filtered_rows())

		if self._action == "insert":
			inserted = dict(self._insert_payload)
			now_iso = datetime.now(timezone.utc).isoformat()

			if self.table_name == "notifications":
				inserted.setdefault("notif_id", str(uuid4()))
				inserted.setdefault("is_seen", False)
				inserted.setdefault("received_at", now_iso)
			if self.table_name == "priority":
				inserted.setdefault("priority_id", str(uuid4()))
				inserted.setdefault("updated_at", now_iso)
			if self.table_name == "automation":
				inserted.setdefault("auto_id", str(uuid4()))
				inserted.setdefault("triggered_at", now_iso)
			if self.table_name == "report":
				inserted.setdefault("report_id", str(uuid4()))
				inserted.setdefault("timestamp", now_iso)

			self.store.setdefault(self.table_name, []).append(inserted)
			return FakeResult([inserted])

		if self._action == "update":
			updated_rows: list[dict] = []
			for row in self.store.get(self.table_name, []):
				if all(str(row.get(k)) == str(v) for k, v in self._filters):
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


def test_health_check(client: TestClient):
	response = client.get("/health")
	assert response.status_code == 200
	assert response.json() == {"status": "ok"}


def test_auth_google_returns_url(client: TestClient, monkeypatch: pytest.MonkeyPatch):
	class DummyAuth:
		def sign_in_with_oauth(self, _payload):
			return {"url": "https://accounts.google.com/o/oauth2/auth?test=1"}

	class DummySupabase:
		auth = DummyAuth()

	monkeypatch.setattr("routes.auth.get_supabase_client", lambda: DummySupabase())

	response = client.post("/auth/google", json={"redirect_to": "http://localhost:8000/callback"})
	assert response.status_code == 200
	body = response.json()
	assert "google.com" in body["auth_url"]
	assert body["oauth_url"] == body["auth_url"]


def test_add_notification_created(client: TestClient, monkeypatch: pytest.MonkeyPatch):
	store = {"notifications": []}
	fake = FakeSupabaseClient(store)
	monkeypatch.setattr("routes.notifications.get_supabase_client", lambda: fake)
	monkeypatch.setattr("routes.notifications.check_and_escalate", lambda *_args, **_kwargs: None)

	user_id = str(uuid4())
	response = client.post(
		"/notifications/add",
		json={
			"user_id": user_id,
			"app_name": "Gmail",
			"content": "Team sync at 5 PM",
			"category": "work",
			"is_seen": False,
			"received_at": datetime.now(timezone.utc).isoformat(),
		},
	)

	assert response.status_code == 201
	body = response.json()
	assert body["app_name"] == "Gmail"
	assert body["category"] == "work"
	assert body["user_id"] == user_id


def test_mark_notification_seen_not_found(client: TestClient, monkeypatch: pytest.MonkeyPatch):
	store = {"notifications": []}
	fake = FakeSupabaseClient(store)
	monkeypatch.setattr("routes.notifications.get_supabase_client", lambda: fake)

	response = client.patch(f"/notifications/{uuid4()}/seen")
	assert response.status_code == 404
	assert "not found" in response.json()["detail"].lower()


def test_priority_set_insert_returns_201(client: TestClient, monkeypatch: pytest.MonkeyPatch):
	store = {"priority": []}
	fake = FakeSupabaseClient(store)
	monkeypatch.setattr("routes.priority.get_supabase_client", lambda: fake)

	user_id = str(uuid4())
	response = client.post(
		"/priority/set",
		json={
			"user_id": user_id,
			"priority_apps": {"Gmail": 5},
			"ranking_weights": {"urgency": 0.4, "recency": 0.3},
		},
	)

	assert response.status_code == 201
	body = response.json()
	assert body["user_id"] == user_id
	assert body["priority_apps"]["Gmail"] == 5


def test_automation_trigger_seen_notification_conflict(client: TestClient, monkeypatch: pytest.MonkeyPatch):
	user_id = str(uuid4())
	notif_id = str(uuid4())
	priority_id = str(uuid4())

	store = {
		"notifications": [
			{
				"notif_id": notif_id,
				"user_id": user_id,
				"app_name": "WhatsApp",
				"content": "Hello",
				"category": "social",
				"is_seen": True,
				"received_at": datetime.now(timezone.utc).isoformat(),
			}
		],
		"users": [{"user_id": user_id, "ph_num": "+1234567890"}],
		"priority": [
			{
				"priority_id": priority_id,
				"user_id": user_id,
				"priority_apps": {"WhatsApp": 3},
				"ranking_weights": {"urgency": 0.4, "recency": 0.3, "app_weight": 0.4},
				"updated_at": datetime.now(timezone.utc).isoformat(),
			}
		],
		"automation": [],
	}

	fake = FakeSupabaseClient(store)
	monkeypatch.setattr("routes.automation.get_supabase_client", lambda: fake)

	response = client.post(
		"/automation/trigger",
		json={
			"user_id": user_id,
			"notif_id": notif_id,
			"priority_id": priority_id,
			"channel": "sms",
			"reply_template": "On it",
		},
	)

	assert response.status_code == 409
	assert "unseen" in response.json()["detail"].lower()


def test_report_log_returns_201_and_weights(client: TestClient, monkeypatch: pytest.MonkeyPatch):
	user_id = str(uuid4())
	notif_id = str(uuid4())

	store = {
		"notifications": [{"notif_id": notif_id, "app_name": "Gmail", "user_id": user_id}],
		"report": [],
	}
	fake = FakeSupabaseClient(store)

	monkeypatch.setattr("routes.report.get_supabase_client", lambda: fake)
	monkeypatch.setattr("routes.report.update_bandit_after_report", lambda **_kwargs: {"Gmail": 0.75})

	response = client.post(
		"/report/log",
		json={
			"user_id": user_id,
			"notif_id": notif_id,
			"action_taken": "clicked",
			"ranking_score": 0.87,
		},
	)

	assert response.status_code == 201
	body = response.json()
	assert body["report"]["action_taken"] == "clicked"
	assert body["updated_app_weights"]["Gmail"] == 0.75
