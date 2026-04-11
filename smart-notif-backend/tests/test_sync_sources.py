from __future__ import annotations

from uuid import uuid4


class DummyResponse:
    def __init__(self, payload: dict, ok: bool = True, status_code: int = 200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._payload


def test_sync_gmail_uses_window_query(client, monkeypatch):
    captured = {}

    def fake_get(url, headers=None, params=None, timeout=0):
        if "gmail/v1/users/me/messages" in url:
            captured["url"] = url
            captured["params"] = params or {}
            return DummyResponse({"messages": []}, ok=True)
        return DummyResponse({}, ok=False, status_code=500)

    monkeypatch.setattr("routes.notifications.requests.get", fake_get)

    user_id = str(uuid4())
    response = client.post(
        f"/notifications/{user_id}/sync-gmail",
        json={"access_token": "token", "max_results": 25, "gmail_window_days": 7},
    )

    assert response.status_code == 200
    assert captured["params"]["q"] == "newer_than:7d"


def test_sync_calendar_returns_empty_counts(client, monkeypatch):
    def fake_get(url, headers=None, params=None, timeout=0):
        if "calendar/v3/calendars/primary/events" in url:
            return DummyResponse({"items": []}, ok=True)
        return DummyResponse({}, ok=False, status_code=500)

    monkeypatch.setattr("routes.notifications.requests.get", fake_get)

    user_id = str(uuid4())
    response = client.post(
        f"/notifications/{user_id}/sync-calendar",
        json={"access_token": "token", "max_results": 20, "calendar_window_days": 7},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["imported_count"] == 0
    assert body["fetched_count"] == 0
