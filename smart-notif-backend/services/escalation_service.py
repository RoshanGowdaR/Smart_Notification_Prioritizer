from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from groq import Groq

from database.supabase_client import get_supabase_client
from services.forward_service import send_sms, send_whatsapp

_groq_client: Groq | None = None


def _get_groq_client() -> Groq | None:
	global _groq_client
	if _groq_client is not None:
		return _groq_client

	api_key = os.getenv("GROQ_API_KEY")
	if not api_key:
		return None

	_groq_client = Groq(api_key=api_key)
	return _groq_client


def _to_text(value: Any) -> str:
	return str(value).strip() if value is not None else ""


def _normalize_phone(value: str) -> str:
	raw = value.replace("whatsapp:", "").strip()
	digits = "".join(ch for ch in raw if ch.isdigit())
	if raw.startswith("+") and digits:
		return f"+{digits}"
	return f"+{digits}" if digits else raw


def _latest_priority_id_for_user(user_id: str) -> str | None:
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


def _log_automation_event(*, user_id: str, notif_id: str, channel: str, summary: str) -> None:
	supabase = get_supabase_client()
	priority_id = _latest_priority_id_for_user(user_id)
	if not priority_id:
		return

	supabase.table("automation").insert(
		{
			"user_id": user_id,
			"notif_id": notif_id,
			"priority_id": priority_id,
			"channel": channel,
			"reply_template": summary,
			"triggered_at": datetime.now(timezone.utc).isoformat(),
		}
	).execute()


def _log_report_event(*, user_id: str, notif_id: str, ranking_score: float = 1.0) -> None:
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


def summarize_with_groq(app_name: str, content: str) -> str:
	client = _get_groq_client()
	fallback = f"{app_name}: {_to_text(content)[:100]}"
	if client is None:
		return fallback

	try:
		response = client.chat.completions.create(
			model="llama3-8b-8192",
			messages=[
				{
					"role": "user",
					"content": (
						"You are a notification assistant. Summarize this in ONE urgent "
						"sentence under 20 words for WhatsApp forwarding. "
						f"App: {app_name}. Message: {content}"
					),
				}
			],
			max_tokens=60,
		)
		summary = _to_text(response.choices[0].message.content)
		return summary or fallback
	except Exception:
		return fallback


async def check_and_escalate(
	notif_id: UUID | str,
	user_id: UUID | str,
	app_name: str,
	content: str,
	delay_seconds: int = 300,
) -> None:
	notif_id_str = str(notif_id)
	user_id_str = str(user_id)
	supabase = get_supabase_client()

	await asyncio.sleep(max(1, int(delay_seconds)))

	check_result = (
		supabase.table("notifications")
		.select("is_seen")
		.eq("notif_id", notif_id_str)
		.single()
		.execute()
	)
	if check_result.data and bool(check_result.data.get("is_seen")):
		return

	summary = summarize_with_groq(app_name, content)

	user_result = (
		supabase.table("users")
		.select("ph_num")
		.eq("user_id", user_id_str)
		.single()
		.execute()
	)
	phone_raw = _to_text((user_result.data or {}).get("ph_num"))
	phone = _normalize_phone(phone_raw)
	if not phone:
		return

	try:
		send_whatsapp(phone, f"[NotifyAI Alert] {summary}")
	except Exception:
		return

	try:
		_log_automation_event(user_id=user_id_str, notif_id=notif_id_str, channel="whatsapp", summary=summary)
	except Exception:
		pass

	try:
		_log_report_event(user_id=user_id_str, notif_id=notif_id_str)
	except Exception:
		pass

	await asyncio.sleep(30)

	reply_check = (
		supabase.table("automation")
		.select("reply_received")
		.eq("notif_id", notif_id_str)
		.eq("channel", "whatsapp")
		.order("triggered_at", desc=True)
		.limit(1)
		.execute()
	)
	reply_row = (reply_check.data or [None])[0]
	if reply_row and bool(reply_row.get("reply_received")):
		return

	try:
		send_sms(phone, f"[NotifyAI SMS] {summary}")
	except Exception:
		return

	try:
		_log_automation_event(user_id=user_id_str, notif_id=notif_id_str, channel="sms", summary=summary)
	except Exception:
		pass

	try:
		_log_report_event(user_id=user_id_str, notif_id=notif_id_str)
	except Exception:
		pass
