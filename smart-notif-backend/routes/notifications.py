from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from database.supabase_client import get_supabase_client
from models.schemas import NotificationCategory, NotificationRequest, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])

_CATEGORY_URGENCY: dict[NotificationCategory, float] = {
	NotificationCategory.work: 1.0,
	NotificationCategory.system: 0.8,
	NotificationCategory.social: 0.5,
	NotificationCategory.promo: 0.2,
}


class RankedNotificationResponse(NotificationResponse):
	ranking_score: float


def _parse_received_at(value: str | datetime) -> datetime:
	if isinstance(value, datetime):
		return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

	normalized = value.replace("Z", "+00:00") if isinstance(value, str) else value
	dt = datetime.fromisoformat(normalized)
	return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _recency_score(received_at: datetime) -> float:
	now = datetime.now(timezone.utc)
	age_seconds = max((now - received_at).total_seconds(), 0.0)
	one_day = 24 * 60 * 60
	return max(0.0, 1.0 - min(age_seconds / one_day, 1.0))


def _score_notification(
	notification: dict,
	app_weight: float,
	category_urgency: float,
) -> float:
	recency = _recency_score(_parse_received_at(notification["received_at"]))
	return (app_weight * 0.4) + (recency * 0.3) + (category_urgency * 0.3)


def _get_user_priority_maps(user_id: UUID) -> tuple[dict[str, float], dict[str, float]]:
	supabase = get_supabase_client()
	priority_result = (
		supabase.table("priority")
		.select("priority_apps, ranking_weights")
		.eq("user_id", str(user_id))
		.order("updated_at", desc=True)
		.limit(1)
		.execute()
	)

	if not priority_result.data:
		return {}, {}

	priority_row = priority_result.data[0]
	priority_apps = priority_row.get("priority_apps") or {}
	ranking_weights = priority_row.get("ranking_weights") or {}
	return priority_apps, ranking_weights


@router.get(
	"/{user_id}",
	response_model=list[RankedNotificationResponse],
	status_code=status.HTTP_200_OK,
)
def get_ranked_notifications(user_id: UUID) -> list[RankedNotificationResponse]:
	supabase = get_supabase_client()

	try:
		notification_result = (
			supabase.table("notifications")
			.select("*")
			.eq("user_id", str(user_id))
			.execute()
		)
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to fetch notifications: {exc}",
		) from exc

	notifications = notification_result.data or []
	if not notifications:
		return []

	priority_apps, _ = _get_user_priority_maps(user_id)

	ranked: list[RankedNotificationResponse] = []
	for notif in notifications:
		category = NotificationCategory(notif["category"])
		app_weight = float(priority_apps.get(notif["app_name"], 1.0))
		category_urgency = _CATEGORY_URGENCY.get(category, 0.5)
		score = _score_notification(notif, app_weight=app_weight, category_urgency=category_urgency)

		ranked.append(
			RankedNotificationResponse(
				notif_id=notif["notif_id"],
				user_id=notif["user_id"],
				app_name=notif["app_name"],
				content=notif["content"],
				category=category,
				is_seen=notif.get("is_seen", False),
				received_at=notif["received_at"],
				ranking_score=round(score, 4),
			)
		)

	ranked.sort(key=lambda item: item.ranking_score, reverse=True)
	return ranked


@router.post(
	"/add",
	response_model=NotificationResponse,
	status_code=status.HTTP_201_CREATED,
)
def add_notification(payload: NotificationRequest) -> NotificationResponse:
	supabase = get_supabase_client()
	payload_dict = payload.model_dump(mode="json")

	try:
		insert_result = supabase.table("notifications").insert(payload_dict).execute()
		inserted = (insert_result.data or [None])[0]
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to add notification: {exc}",
		) from exc

	if not inserted:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Notification insert returned no data.",
		)

	return NotificationResponse(**inserted)


@router.patch(
	"/{notif_id}/seen",
	response_model=NotificationResponse,
	status_code=status.HTTP_200_OK,
)
def mark_notification_seen(notif_id: UUID) -> NotificationResponse:
	supabase = get_supabase_client()

	try:
		update_result = (
			supabase.table("notifications")
			.update({"is_seen": True})
			.eq("notif_id", str(notif_id))
			.execute()
		)
		updated = (update_result.data or [None])[0]
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to update notification: {exc}",
		) from exc

	if not updated:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Notification not found.",
		)

	return NotificationResponse(**updated)
