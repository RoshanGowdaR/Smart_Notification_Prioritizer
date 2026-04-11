from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from groq import Groq

from database.supabase_client import get_supabase_client
from services.forward_service import send_sms, send_whatsapp

_groq_client: Groq | None = None


def _safe_text(value: Any) -> str:
	return str(value).strip() if value is not None else ""


def _normalize_phone(value: str) -> str:
	raw = _safe_text(value).replace("whatsapp:", "")
	digits = "".join(ch for ch in raw if ch.isdigit())
	if not digits:
		return ""
	return f"+{digits}"


def _get_groq_client() -> Groq | None:
	global _groq_client
	if _groq_client is not None:
		return _groq_client

	api_key = os.getenv("GROQ_API_KEY")
	if not api_key:
		return None

	_groq_client = Groq(api_key=api_key)
	return _groq_client


def _latest_priority_id(user_id: str) -> str | None:
	supabase = get_supabase_client()
	result = (
		supabase.table("priority")
		.select("priority_id")
		.eq("user_id", user_id)
		.order("updated_at", desc=True)
		.limit(1)
		.execute()
	)
	row = (result.data or [None])[0]
	return row.get("priority_id") if row else None


def _insert_automation_record(user_id: str, notif_id: str, channel: str, summary: str) -> None:
	supabase = get_supabase_client()
	priority_id = _latest_priority_id(user_id)
	if not priority_id:
		return

	payload = {
		"user_id": user_id,
		"notif_id": notif_id,
		"priority_id": priority_id,
		"channel": channel,
		"reply_template": summary,
		"triggered_at": datetime.now(timezone.utc).isoformat(),
		"reply_received": False,
	}

	try:
		supabase.table("automation").insert(payload).execute()
	except Exception as exc:
		if "reply_received" not in str(exc):
			raise
		payload.pop("reply_received", None)
		supabase.table("automation").insert(payload).execute()


def _insert_report_record(user_id: str, notif_id: str, ranking_score: float = 1.0) -> None:
	supabase = get_supabase_client()
	supabase.table("report").insert(
		{
			"user_id": user_id,
			"notif_id": notif_id,
			"action_taken": "forwarded",
			"ranking_score": ranking_score,
			"timestamp": datetime.now(timezone.utc).isoformat(),
		}
	).execute()


def _has_recent_whatsapp_reply(user_id: str, window_minutes: int = 10) -> bool:
	supabase = get_supabase_client()
	cutoff = (datetime.now(timezone.utc) - timedelta(minutes=window_minutes)).isoformat()
	try:
		result = (
			supabase.table("automation")
			.select("auto_id")
			.eq("user_id", user_id)
			.eq("channel", "whatsapp")
			.eq("reply_received", True)
			.gte("triggered_at", cutoff)
			.limit(1)
			.execute()
		)
		return bool(result.data)
	except Exception:
		return False


def _has_recent_duplicate_whatsapp(user_id: str, summary: str, window_seconds: int = 180) -> bool:
	supabase = get_supabase_client()
	cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
	try:
		result = (
			supabase.table("automation")
			.select("auto_id")
			.eq("user_id", user_id)
			.eq("channel", "whatsapp")
			.eq("reply_template", summary)
			.gte("triggered_at", cutoff)
			.limit(1)
			.execute()
		)
		return bool(result.data)
	except Exception:
		return False


def summarize_with_groq(app_name: str, content: str) -> str:
	fallback = f"{app_name}: {_safe_text(content)[:140]}"
	client = _get_groq_client()
	if client is None:
		return fallback

	try:
		response = client.chat.completions.create(
			model="llama3-8b-8192",
			messages=[
				{
					"role": "user",
					"content": (
						"Summarize this notification in one urgent sentence under 20 words for WhatsApp. "
						f"App: {app_name}. Message: {content}"
					),
				}
			],
			max_tokens=60,
		)
		summary = _safe_text(response.choices[0].message.content)
		return summary or fallback
	except Exception:
		return fallback


async def check_and_escalate(
	notif_id: UUID | str,
	user_id: UUID | str,
	app_name: str,
	content: str,
	delay_seconds: int = 30,
) -> None:
	notif_id_str = str(notif_id)
	user_id_str = str(user_id)
	supabase = get_supabase_client()

	await asyncio.sleep(max(1, int(delay_seconds)))

	first_check = (
		supabase.table("notifications")
		.select("is_seen")
		.eq("notif_id", notif_id_str)
		.single()
		.execute()
	)
	if first_check.data and bool(first_check.data.get("is_seen")):
		return

	user_result = (
		supabase.table("users")
		.select("ph_num")
		.eq("user_id", user_id_str)
		.single()
		.execute()
	)
	phone = _normalize_phone((user_result.data or {}).get("ph_num"))
	if not phone:
		return

	# If the user replied recently, suppress further escalation noise.
	if _has_recent_whatsapp_reply(user_id_str):
		return

	summary = summarize_with_groq(app_name, content)

	# Avoid duplicate WhatsApp alerts for near-identical notifications.
	if _has_recent_duplicate_whatsapp(user_id_str, summary):
		return

	try:
		send_whatsapp(phone, f"[NotifyAI Alert] {summary}")
	except Exception as exc:
		print(f"[escalation] WhatsApp send failed for {user_id_str}: {exc}")
		return

	try:
		_insert_automation_record(user_id_str, notif_id_str, "whatsapp", summary)
	except Exception:
		pass

	try:
		_insert_report_record(user_id_str, notif_id_str)
	except Exception:
		pass

	await asyncio.sleep(30)

	second_check = (
		supabase.table("notifications")
		.select("is_seen")
		.eq("notif_id", notif_id_str)
		.single()
		.execute()
	)
	if second_check.data and bool(second_check.data.get("is_seen")):
		return

	if _has_recent_whatsapp_reply(user_id_str):
		return

	whatsapp_reply_received = False
	try:
		reply_result = (
			supabase.table("automation")
			.select("reply_received")
			.eq("notif_id", notif_id_str)
			.eq("channel", "whatsapp")
			.order("triggered_at", desc=True)
			.limit(1)
			.execute()
		)
		reply_row = (reply_result.data or [None])[0]
		whatsapp_reply_received = bool(reply_row and reply_row.get("reply_received"))
	except Exception:
		whatsapp_reply_received = False

	if whatsapp_reply_received:
		return

	try:
		send_sms(phone, f"[NotifyAI SMS] {summary}")
	except Exception as exc:
		print(f"[escalation] SMS send failed for {user_id_str}: {exc}")
		return

	try:
		_insert_automation_record(user_id_str, notif_id_str, "sms", summary)
	except Exception:
		pass

	try:
		_insert_report_record(user_id_str, notif_id_str)
	except Exception:
		pass
