from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from uuid import UUID

import requests
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from database.supabase_client import get_supabase_client
from models.schemas import NotificationCategory, NotificationRequest, NotificationResponse

router = APIRouter(tags=["notifications"])

_CATEGORY_URGENCY: dict[NotificationCategory, float] = {
	NotificationCategory.work: 1.0,
	NotificationCategory.system: 0.8,
	NotificationCategory.social: 0.5,
	NotificationCategory.promo: 0.2,
}


class RankedNotificationResponse(NotificationResponse):
	ranking_score: float


class GmailSyncRequest(BaseModel):
	access_token: str
	max_results: int = 20


class GmailSyncResponse(BaseModel):
	imported_count: int
	skipped_count: int
	fetched_count: int


def _build_gmail_api_error_detail(response: requests.Response) -> str:
	default_message = "Unable to sync Gmail right now. Please try again later."

	try:
		payload = response.json() or {}
	except Exception:
		return default_message

	error = payload.get("error") if isinstance(payload, dict) else None
	if not isinstance(error, dict):
		return default_message

	message = str(error.get("message") or "").strip()
	status = str(error.get("status") or "").upper()

	if response.status_code == 403 and ("SERVICE_DISABLED" in status or "has not been used" in message.lower()):
		return (
			"Gmail API is disabled for your Google project. "
			"Enable it in Google Cloud Console and retry in a few minutes."
		)

	if response.status_code == 403 and "insufficient" in message.lower():
		return "Missing Gmail permission. Log out and sign in again, then grant Gmail access."

	if response.status_code == 401:
		return "Google session expired. Please sign in again to sync Gmail."

	return message or default_message


def _is_missing_keyword_rules_column(exc: Exception) -> bool:
	message = str(exc).lower()
	return "keyword_rules" in message and ("column" in message or "schema cache" in message)


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
	keyword_boost: float,
) -> float:
	recency = _recency_score(_parse_received_at(notification["received_at"]))
	return (app_weight * 0.4) + (recency * 0.3) + (category_urgency * 0.2) + (keyword_boost * 0.1)


def _normalize_app_key(value: str) -> str:
	normalized = value.strip().lower()
	if normalized in {"calendar", "google calendar", "gcal", "google_calendar"}:
		return "google calendar"
	if normalized in {"gmail", "google mail"}:
		return "gmail"
	return normalized


def _keyword_boost_for_notification(
	app_name: str,
	content: str,
	keyword_rules: dict[str, dict[str, int]],
) -> float:
	normalized_rules: dict[str, dict[str, int]] = {}
	for raw_app, rules in keyword_rules.items():
		app_key = _normalize_app_key(raw_app)
		normalized_rules[app_key] = {}
		for raw_keyword, raw_level in (rules or {}).items():
			keyword = str(raw_keyword).strip().lower()
			level = int(raw_level) if str(raw_level).strip() else 0
			if keyword:
				normalized_rules[app_key][keyword] = max(1, min(5, level))

	app_key = _normalize_app_key(app_name)
	rules_for_app = normalized_rules.get(app_key, {})
	if not rules_for_app:
		return 0.0

	content_lower = (content or "").lower()
	matched_levels = [level for keyword, level in rules_for_app.items() if keyword in content_lower]
	if not matched_levels:
		return 0.0

	return max(matched_levels) / 5.0


def _extract_header(headers: list[dict], key: str) -> str:
	key_lower = key.lower()
	for item in headers or []:
		name = str(item.get("name", "")).lower()
		if name == key_lower:
			return str(item.get("value", "")).strip()
	return ""


def _safe_received_at(payload: dict) -> datetime:
	internal_ms = payload.get("internalDate")
	if internal_ms:
		try:
			seconds = int(internal_ms) / 1000.0
			return datetime.fromtimestamp(seconds, tz=timezone.utc)
		except Exception:
			pass

	headers = (payload.get("payload") or {}).get("headers") or []
	date_header = _extract_header(headers, "Date")
	if date_header:
		try:
			dt = parsedate_to_datetime(date_header)
			return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
		except Exception:
			pass

	return datetime.now(timezone.utc)


def _infer_category(subject: str, sender: str, snippet: str) -> NotificationCategory:
	text = f"{subject} {sender} {snippet}".lower()
	if any(token in text for token in ["urgent", "asap", "deadline", "interview", "meeting", "offer", "invoice", "payment"]):
		return NotificationCategory.work
	if any(token in text for token in ["security", "verification", "reset", "alert", "warning"]):
		return NotificationCategory.system
	if any(token in text for token in ["sale", "promo", "offer ends", "discount", "coupon"]):
		return NotificationCategory.promo
	return NotificationCategory.social


def _get_user_priority_maps(user_id: UUID) -> tuple[dict[str, float], dict[str, float], dict[str, dict[str, int]]]:
	supabase = get_supabase_client()
	try:
		priority_result = (
			supabase.table("priority")
			.select("priority_apps, ranking_weights, keyword_rules")
			.eq("user_id", str(user_id))
			.order("updated_at", desc=True)
			.limit(1)
			.execute()
		)
	except Exception as exc:
		if not _is_missing_keyword_rules_column(exc):
			raise
		priority_result = (
			supabase.table("priority")
			.select("priority_apps, ranking_weights")
			.eq("user_id", str(user_id))
			.order("updated_at", desc=True)
			.limit(1)
			.execute()
		)

	if not priority_result.data:
		return {}, {}, {}

	priority_row = priority_result.data[0]
	priority_apps = priority_row.get("priority_apps") or {}
	ranking_weights = priority_row.get("ranking_weights") or {}
	keyword_rules = priority_row.get("keyword_rules") or {}
	return priority_apps, ranking_weights, keyword_rules


@router.post(
	"/{user_id}/sync-gmail",
	response_model=GmailSyncResponse,
	status_code=status.HTTP_200_OK,
)
def sync_gmail_notifications(user_id: UUID, payload: GmailSyncRequest) -> GmailSyncResponse:
	supabase = get_supabase_client()
	max_results = max(1, min(payload.max_results, 50))

	headers = {"Authorization": f"Bearer {payload.access_token}"}
	list_resp = requests.get(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages",
		headers=headers,
		params={"maxResults": max_results},
		timeout=12,
	)

	if list_resp.status_code == 401:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Google session expired. Please sign in again to sync Gmail.",
		)
	if not list_resp.ok:
		raise HTTPException(
			status_code=status.HTTP_502_BAD_GATEWAY,
			detail=_build_gmail_api_error_detail(list_resp),
		)

	message_refs = (list_resp.json() or {}).get("messages") or []
	if not message_refs:
		return GmailSyncResponse(imported_count=0, skipped_count=0, fetched_count=0)

	existing_result = (
		supabase.table("notifications")
		.select("content, received_at")
		.eq("user_id", str(user_id))
		.eq("app_name", "Gmail")
		.order("received_at", desc=True)
		.limit(500)
		.execute()
	)

	existing_keys = {
		(f"{row.get('content','')}|{row.get('received_at','')}")
		for row in (existing_result.data or [])
	}

	rows_to_insert: list[dict] = []
	skipped_count = 0

	for ref in message_refs:
		msg_id = ref.get("id")
		if not msg_id:
			skipped_count += 1
			continue

		msg_resp = requests.get(
			f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
			headers=headers,
			params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]},
			timeout=12,
		)

		if not msg_resp.ok:
			skipped_count += 1
			continue

		msg_payload = msg_resp.json() or {}
		headers_meta = (msg_payload.get("payload") or {}).get("headers") or []
		subject = _extract_header(headers_meta, "Subject") or "(No Subject)"
		sender = _extract_header(headers_meta, "From") or "Unknown Sender"
		snippet = str(msg_payload.get("snippet") or "").strip()
		received_at = _safe_received_at(msg_payload).isoformat()
		content = f"{subject} | {sender} | {snippet}".strip(" |")

		key = f"{content}|{received_at}"
		if key in existing_keys:
			skipped_count += 1
			continue

		category = _infer_category(subject, sender, snippet)
		rows_to_insert.append(
			{
				"user_id": str(user_id),
				"app_name": "Gmail",
				"content": content,
				"category": category.value,
				"is_seen": False,
				"received_at": received_at,
			}
		)
		existing_keys.add(key)

	if rows_to_insert:
		try:
			supabase.table("notifications").insert(rows_to_insert).execute()
		except Exception as exc:
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail=f"Failed to store synced Gmail notifications: {exc}",
			) from exc

	return GmailSyncResponse(
		imported_count=len(rows_to_insert),
		skipped_count=skipped_count,
		fetched_count=len(message_refs),
	)


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

	priority_apps, _, keyword_rules = _get_user_priority_maps(user_id)

	ranked: list[RankedNotificationResponse] = []
	for notif in notifications:
		category = NotificationCategory(notif["category"])
		app_weight = float(priority_apps.get(notif["app_name"], 1.0))
		category_urgency = _CATEGORY_URGENCY.get(category, 0.5)
		keyword_boost = _keyword_boost_for_notification(
			app_name=notif.get("app_name", ""),
			content=notif.get("content", ""),
			keyword_rules=keyword_rules,
		)
		score = _score_notification(
			notif,
			app_weight=app_weight,
			category_urgency=category_urgency,
			keyword_boost=keyword_boost,
		)

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
