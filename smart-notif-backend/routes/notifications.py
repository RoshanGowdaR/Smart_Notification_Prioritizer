from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from uuid import UUID

import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from database.supabase_client import get_supabase_client
from models.schemas import NotificationCategory, NotificationRequest, NotificationResponse
from services.escalation_service import check_and_escalate

router = APIRouter(tags=["notifications"])

_CATEGORY_URGENCY: dict[NotificationCategory, float] = {
	NotificationCategory.work: 1.0,
	NotificationCategory.system: 0.8,
	NotificationCategory.social: 0.5,
	NotificationCategory.promo: 0.2,
}


class RankedNotificationResponse(NotificationResponse):
	ranking_score: float
	matched_keyword: str | None = None
	matched_priority: int | None = None


class GmailSyncRequest(BaseModel):
	access_token: str
	max_results: int = 20
	gmail_window_days: int = 7
	calendar_window_days: int = 7


class GmailSyncResponse(BaseModel):
	imported_count: int
	skipped_count: int
	fetched_count: int


class CalendarSyncResponse(BaseModel):
	imported_count: int
	skipped_count: int
	fetched_count: int


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
) -> tuple[float, str | None, int | None]:
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
		return 0.0, None, None

	content_lower = (content or "").lower()
	matched_entries = [(keyword, level) for keyword, level in rules_for_app.items() if keyword in content_lower]
	if not matched_entries:
		return 0.0, None, None

	best_keyword, best_level = max(matched_entries, key=lambda item: item[1])
	return best_level / 5.0, best_keyword, best_level


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
			return datetime.fromtimestamp(int(internal_ms) / 1000.0, tz=timezone.utc)
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
	status_name = str(error.get("status") or "").upper()

	if response.status_code == 403 and ("SERVICE_DISABLED" in status_name or "has not been used" in message.lower()):
		return "Gmail API is disabled for your Google project. Enable it in Google Cloud Console and retry in a few minutes."
	if response.status_code == 403 and "insufficient" in message.lower():
		return "Missing Gmail permission. Log out and sign in again, then grant Gmail access."
	if response.status_code == 401:
		return "Google session expired. Please sign in again to sync Gmail."

	return message or default_message


def _build_calendar_api_error_detail(response: requests.Response) -> str:
	default_message = "Unable to sync Google Calendar right now. Please try again later."
	try:
		payload = response.json() or {}
	except Exception:
		return default_message

	error = payload.get("error") if isinstance(payload, dict) else None
	if isinstance(error, dict):
		message = str(error.get("message") or "").strip()
		if response.status_code == 401:
			return "Google session expired. Please sign in again to sync Calendar."
		if response.status_code == 403 and "insufficient" in message.lower():
			return "Missing Calendar permission. Log out and sign in again, then grant Calendar access."
		return message or default_message

	return default_message


def _calendar_event_time(event: dict) -> datetime:
	start = (event.get("start") or {}).get("dateTime") or (event.get("start") or {}).get("date")
	if not start:
		return datetime.now(timezone.utc)

	if isinstance(start, str) and len(start) == 10:
		start = f"{start}T00:00:00+00:00"
	try:
		return _parse_received_at(start)
	except Exception:
		return datetime.now(timezone.utc)


def _is_today_utc(value: str | datetime | None) -> bool:
	if not value:
		return False

	try:
		received_at = _parse_received_at(value)
	except Exception:
		return False

	return received_at.astimezone(timezone.utc).date() == datetime.now(timezone.utc).date()


def _should_schedule_escalation(row: dict) -> bool:
	if not row.get("notif_id") or bool(row.get("is_seen", False)):
		return False

	app_name = str(row.get("app_name", "")).strip().lower()
	if app_name in {"gmail", "google mail"}:
		# Prevent automation spam from historical inbox imports.
		return _is_today_utc(row.get("received_at"))

	return True


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
		if "keyword_rules" not in str(exc):
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
def sync_gmail_notifications(
	user_id: UUID,
	payload: GmailSyncRequest,
	background_tasks: BackgroundTasks,
) -> GmailSyncResponse:
	supabase = get_supabase_client()
	max_results = max(1, min(payload.max_results, 50))
	gmail_window_days = max(1, min(payload.gmail_window_days, 30))
	headers = {"Authorization": f"Bearer {payload.access_token}"}

	list_resp = requests.get(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages",
		headers=headers,
		params={
			"maxResults": max_results,
			"q": f"newer_than:{gmail_window_days}d",
		},
		timeout=12,
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
	existing_content_keys = {
		str(row.get("content", "")).strip().lower()
		for row in (existing_result.data or [])
		if str(row.get("content", "")).strip()
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

		content_key = content.strip().lower()
		if content_key in existing_content_keys:
			skipped_count += 1
			continue

		rows_to_insert.append(
			{
				"user_id": str(user_id),
				"app_name": "Gmail",
				"content": content,
				"category": _infer_category(subject, sender, snippet).value,
				"is_seen": False,
				"received_at": received_at,
			}
		)
		existing_content_keys.add(content_key)

	if rows_to_insert:
		try:
			insert_result = supabase.table("notifications").insert(rows_to_insert).execute()
			inserted_rows = insert_result.data or []
		except Exception as exc:
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail=f"Failed to store synced Gmail notifications: {exc}",
			) from exc

		for row in inserted_rows:
			if _should_schedule_escalation(row):
				background_tasks.add_task(
					check_and_escalate,
					row["notif_id"],
					str(user_id),
					row.get("app_name", "Gmail"),
					row.get("content", ""),
				)

	return GmailSyncResponse(
		imported_count=len(rows_to_insert),
		skipped_count=skipped_count,
		fetched_count=len(message_refs),
	)


@router.post(
	"/{user_id}/sync-calendar",
	response_model=CalendarSyncResponse,
	status_code=status.HTTP_200_OK,
)
def sync_calendar_notifications(
	user_id: UUID,
	payload: GmailSyncRequest,
	background_tasks: BackgroundTasks,
) -> CalendarSyncResponse:
	supabase = get_supabase_client()
	max_results = max(1, min(payload.max_results, 50))
	calendar_window_days = max(1, min(payload.calendar_window_days, 30))
	headers = {"Authorization": f"Bearer {payload.access_token}"}
	now = datetime.now(timezone.utc)
	time_max = (now + timedelta(days=calendar_window_days)).isoformat().replace("+00:00", "Z")
	time_min = (now - timedelta(days=1)).isoformat().replace("+00:00", "Z")

	calendar_resp = requests.get(
		"https://www.googleapis.com/calendar/v3/calendars/primary/events",
		headers=headers,
		params={
			"maxResults": max_results,
			"singleEvents": "true",
			"orderBy": "startTime",
			"timeMin": time_min,
			"timeMax": time_max,
		},
		timeout=12,
	)

	if not calendar_resp.ok:
		raise HTTPException(
			status_code=status.HTTP_502_BAD_GATEWAY,
			detail=_build_calendar_api_error_detail(calendar_resp),
		)

	events = (calendar_resp.json() or {}).get("items") or []
	if not events:
		return CalendarSyncResponse(imported_count=0, skipped_count=0, fetched_count=0)

	existing_result = (
		supabase.table("notifications")
		.select("content")
		.eq("user_id", str(user_id))
		.eq("app_name", "Google Calendar")
		.order("received_at", desc=True)
		.limit(500)
		.execute()
	)
	existing_content_keys = {
		str(row.get("content", "")).strip().lower()
		for row in (existing_result.data or [])
		if str(row.get("content", "")).strip()
	}

	rows_to_insert: list[dict] = []
	skipped_count = 0

	for event in events:
		summary = str(event.get("summary") or "(No Title)").strip()
		location = str(event.get("location") or "").strip()
		description = str(event.get("description") or "").strip()
		event_time = _calendar_event_time(event)
		start_text = event_time.strftime("%Y-%m-%d %H:%M")

		content_parts = [summary, f"Starts: {start_text}"]
		if location:
			content_parts.append(f"Location: {location}")
		if description:
			content_parts.append(description[:160])
		content = " | ".join(content_parts)

		content_key = content.strip().lower()
		if not content_key or content_key in existing_content_keys:
			skipped_count += 1
			continue

		rows_to_insert.append(
			{
				"user_id": str(user_id),
				"app_name": "Google Calendar",
				"content": content,
				"category": _infer_category(summary, "Google Calendar", description).value,
				"is_seen": False,
				"received_at": event_time.isoformat(),
			}
		)
		existing_content_keys.add(content_key)

	if rows_to_insert:
		try:
			insert_result = supabase.table("notifications").insert(rows_to_insert).execute()
			inserted_rows = insert_result.data or []
		except Exception as exc:
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail=f"Failed to store synced Calendar notifications: {exc}",
			) from exc

		for row in inserted_rows:
			if _should_schedule_escalation(row):
				background_tasks.add_task(
					check_and_escalate,
					row["notif_id"],
					str(user_id),
					row.get("app_name", "Google Calendar"),
					row.get("content", ""),
				)

	return CalendarSyncResponse(
		imported_count=len(rows_to_insert),
		skipped_count=skipped_count,
		fetched_count=len(events),
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

	# Dashboard ranking/prioritization should only consider today's Gmail messages.
	notifications = [
		notif
		for notif in notifications
		if str(notif.get("app_name", "")).strip().lower() in {"gmail", "google mail"}
		and _is_today_utc(notif.get("received_at"))
	]
	if not notifications:
		return []

	deduped_notifications: list[dict] = []
	seen_content: set[str] = set()
	for notif in sorted(notifications, key=lambda item: item.get("received_at", ""), reverse=True):
		content_key = f"{str(notif.get('app_name', '')).strip().lower()}|{str(notif.get('content', '')).strip().lower()}"
		if not content_key or content_key in seen_content:
			continue
		seen_content.add(content_key)
		deduped_notifications.append(notif)

	priority_apps, _, keyword_rules = _get_user_priority_maps(user_id)

	ranked: list[RankedNotificationResponse] = []
	for notif in deduped_notifications:
		category = NotificationCategory(notif["category"])
		app_weight = float(priority_apps.get(notif["app_name"], 1.0))
		category_urgency = _CATEGORY_URGENCY.get(category, 0.5)
		keyword_boost, matched_keyword, matched_priority = _keyword_boost_for_notification(
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
				matched_keyword=matched_keyword,
				matched_priority=matched_priority,
			)
		)

	ranked.sort(key=lambda item: item.ranking_score, reverse=True)
	return ranked


@router.post(
	"/add",
	response_model=NotificationResponse,
	status_code=status.HTTP_201_CREATED,
)
def add_notification(
	payload: NotificationRequest,
	background_tasks: BackgroundTasks,
) -> NotificationResponse:
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

	if _should_schedule_escalation(inserted):
		background_tasks.add_task(
			check_and_escalate,
			inserted["notif_id"],
			inserted["user_id"],
			inserted.get("app_name", "Gmail"),
			inserted.get("content", ""),
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
