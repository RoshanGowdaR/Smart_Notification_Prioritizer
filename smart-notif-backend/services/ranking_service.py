from __future__ import annotations

import os
import random
from datetime import datetime, timezone
from uuid import UUID

from database.supabase_client import get_supabase_client
from models.schemas import NotificationCategory, ReportAction

DEFAULT_EPSILON = float(os.getenv("BANDIT_EPSILON", "0.1"))
DEFAULT_SCORING_WEIGHTS = {"app_weight": 0.4, "recency": 0.3, "urgency": 0.3}
_BANDIT_COUNTS_KEY = "_bandit_counts"

_CATEGORY_URGENCY: dict[NotificationCategory, float] = {
	NotificationCategory.work: 1.0,
	NotificationCategory.system: 0.8,
	NotificationCategory.social: 0.5,
	NotificationCategory.promo: 0.2,
}


def _parse_datetime(value: str | datetime) -> datetime:
	if isinstance(value, datetime):
		return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
	normalized = value.replace("Z", "+00:00")
	dt = datetime.fromisoformat(normalized)
	return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def recency_score(received_at: str | datetime) -> float:
	received = _parse_datetime(received_at)
	now = datetime.now(timezone.utc)
	age_seconds = max((now - received).total_seconds(), 0.0)
	one_day_seconds = 24 * 60 * 60
	return max(0.0, 1.0 - min(age_seconds / one_day_seconds, 1.0))


def category_urgency_score(category: NotificationCategory | str) -> float:
	parsed = category if isinstance(category, NotificationCategory) else NotificationCategory(category)
	return _CATEGORY_URGENCY.get(parsed, 0.5)


def compute_notification_score(
	app_weight: float,
	received_at: str | datetime,
	category: NotificationCategory | str,
	ranking_weights: dict[str, float] | None = None,
) -> float:
	weights = DEFAULT_SCORING_WEIGHTS.copy()
	if ranking_weights:
		# Keep default formula but allow user-level tuning if provided.
		weights["app_weight"] = float(ranking_weights.get("app_weight", weights["app_weight"]))
		weights["recency"] = float(ranking_weights.get("recency", weights["recency"]))
		weights["urgency"] = float(ranking_weights.get("urgency", weights["urgency"]))

	return (
		float(app_weight) * weights["app_weight"]
		+ recency_score(received_at) * weights["recency"]
		+ category_urgency_score(category) * weights["urgency"]
	)


def select_app_arm(
	app_names: list[str],
	app_weights: dict[str, float],
	epsilon: float = DEFAULT_EPSILON,
) -> str:
	if not app_names:
		raise ValueError("app_names cannot be empty")

	if random.random() < epsilon:
		return random.choice(app_names)

	return max(app_names, key=lambda app: float(app_weights.get(app, 1.0)))


def rank_notifications(
	notifications: list[dict],
	app_weights: dict[str, float] | None = None,
	ranking_weights: dict[str, float] | None = None,
) -> list[dict]:
	app_weights = app_weights or {}

	ranked: list[dict] = []
	for notif in notifications:
		score = compute_notification_score(
			app_weight=float(app_weights.get(notif["app_name"], 1.0)),
			received_at=notif["received_at"],
			category=notif["category"],
			ranking_weights=ranking_weights,
		)
		enriched = {**notif, "ranking_score": round(score, 4)}
		ranked.append(enriched)

	ranked.sort(key=lambda item: item["ranking_score"], reverse=True)
	return ranked


def _get_latest_priority_row(user_id: UUID) -> dict | None:
	supabase = get_supabase_client()
	result = (
		supabase.table("priority")
		.select("*")
		.eq("user_id", str(user_id))
		.order("updated_at", desc=True)
		.limit(1)
		.execute()
	)
	return (result.data or [None])[0]


def _reward_from_action(action_taken: ReportAction | str) -> int:
	parsed = action_taken if isinstance(action_taken, ReportAction) else ReportAction(action_taken)
	return 1 if parsed == ReportAction.clicked else 0


def update_bandit_after_report(
	user_id: UUID,
	app_name: str,
	action_taken: ReportAction | str,
) -> dict[str, float]:
	"""
	Update epsilon-greedy arm value for an app using incremental average:
	Q_new = Q_old + (reward - Q_old) / N
	"""
	supabase = get_supabase_client()
	reward = _reward_from_action(action_taken)
	now_iso = datetime.now(timezone.utc).isoformat()

	row = _get_latest_priority_row(user_id)

	if row is None:
		priority_apps: dict[str, float] = {app_name: float(reward)}
		ranking_weights: dict = {
			"app_weight": 0.4,
			"recency": 0.3,
			"urgency": 0.3,
			_BANDIT_COUNTS_KEY: {app_name: 1},
		}

		supabase.table("priority").insert(
			{
				"user_id": str(user_id),
				"priority_apps": priority_apps,
				"ranking_weights": ranking_weights,
				"updated_at": now_iso,
			}
		).execute()
		return priority_apps

	priority_id = row["priority_id"]
	priority_apps = row.get("priority_apps") or {}
	ranking_weights = row.get("ranking_weights") or {}

	counts = ranking_weights.get(_BANDIT_COUNTS_KEY) or {}
	previous_q = float(priority_apps.get(app_name, 1.0))
	new_count = int(counts.get(app_name, 0)) + 1
	new_q = previous_q + (float(reward) - previous_q) / float(new_count)

	priority_apps[app_name] = round(new_q, 6)
	counts[app_name] = new_count
	ranking_weights[_BANDIT_COUNTS_KEY] = counts
	ranking_weights.setdefault("app_weight", 0.4)
	ranking_weights.setdefault("recency", 0.3)
	ranking_weights.setdefault("urgency", 0.3)

	supabase.table("priority").update(
		{
			"priority_apps": priority_apps,
			"ranking_weights": ranking_weights,
			"updated_at": now_iso,
		}
	).eq("priority_id", priority_id).execute()

	return {k: float(v) for k, v in priority_apps.items()}
