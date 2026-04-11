from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from conftest import FakeSupabaseClient
from routes import notifications as notifications_route


def test_is_today_utc_true_for_today_timestamp():
    now_iso = datetime.now(timezone.utc).isoformat()
    assert notifications_route._is_today_utc(now_iso) is True


def test_is_today_utc_false_for_old_timestamp():
    old_iso = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert notifications_route._is_today_utc(old_iso) is False


def test_should_schedule_escalation_today_gmail_only():
    now_iso = datetime.now(timezone.utc).isoformat()
    old_iso = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    today_gmail = {
        "notif_id": str(uuid4()),
        "app_name": "Gmail",
        "is_seen": False,
        "received_at": now_iso,
    }
    old_gmail = {
        "notif_id": str(uuid4()),
        "app_name": "Gmail",
        "is_seen": False,
        "received_at": old_iso,
    }
    today_calendar = {
        "notif_id": str(uuid4()),
        "app_name": "Google Calendar",
        "is_seen": False,
        "received_at": now_iso,
    }

    assert notifications_route._should_schedule_escalation(today_gmail) is True
    assert notifications_route._should_schedule_escalation(old_gmail) is False
    assert notifications_route._should_schedule_escalation(today_calendar) is True


def test_ranked_notifications_returns_only_today_gmail(client, monkeypatch):
    user_id = str(uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    old_iso = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    store = {
        "notifications": [
            {
                "notif_id": str(uuid4()),
                "user_id": user_id,
                "app_name": "Gmail",
                "content": "Today mail",
                "category": "work",
                "is_seen": False,
                "received_at": now_iso,
            },
            {
                "notif_id": str(uuid4()),
                "user_id": user_id,
                "app_name": "Gmail",
                "content": "Yesterday mail",
                "category": "work",
                "is_seen": False,
                "received_at": old_iso,
            },
            {
                "notif_id": str(uuid4()),
                "user_id": user_id,
                "app_name": "Google Calendar",
                "content": "Today calendar",
                "category": "work",
                "is_seen": False,
                "received_at": now_iso,
            },
        ],
        "priority": [],
    }

    fake = FakeSupabaseClient(store)
    monkeypatch.setattr("routes.notifications.get_supabase_client", lambda: fake)

    response = client.get(f"/notifications/{user_id}")
    assert response.status_code == 200

    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["app_name"] == "Gmail"
    assert "Today mail" in rows[0]["content"]
