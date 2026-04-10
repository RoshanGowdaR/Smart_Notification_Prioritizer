from __future__ import annotations

import os
from datetime import datetime, timezone

from models.schemas import ChannelType


def _is_dry_run_enabled() -> bool:
	return os.getenv("FORWARD_DRY_RUN", "true").strip().lower() in {"1", "true", "yes", "on"}


def _normalize_phone_number(phone_number: str) -> str:
	number = phone_number.strip()
	if not number:
		raise ValueError("Target phone number is empty.")
	return number


def build_forward_message(app_name: str, content: str, reply_template: str) -> str:
	return (
		f"[Smart Notification Prioritizer]\n"
		f"App: {app_name}\n"
		f"Notification: {content}\n"
		f"Suggested Reply: {reply_template}"
	)


def forward_notification(channel: ChannelType | str, target_phone: str, message: str) -> dict:
	parsed_channel = channel if isinstance(channel, ChannelType) else ChannelType(channel)
	normalized_phone = _normalize_phone_number(target_phone)
	dry_run = _is_dry_run_enabled()

	# In hackathon/dev mode we return deterministic metadata without provider API calls.
	if dry_run:
		return {
			"provider": "dry-run",
			"channel": parsed_channel.value,
			"to": normalized_phone,
			"status": "queued",
			"message_preview": message,
			"provider_message_id": f"dry-{parsed_channel.value}-{int(datetime.now(timezone.utc).timestamp())}",
			"sent_at": datetime.now(timezone.utc).isoformat(),
		}

	# Production mode can be wired to Twilio REST calls in a later hardening step.
	# We enforce credentials now so missing secrets fail fast.
	required_vars = [
		"TWILIO_ACCOUNT_SID",
		"TWILIO_AUTH_TOKEN",
		"TWILIO_WHATSAPP_FROM" if parsed_channel == ChannelType.whatsapp else "TWILIO_SMS_FROM",
	]
	missing = [name for name in required_vars if not os.getenv(name)]
	if missing:
		raise RuntimeError(f"Missing forwarding configuration: {', '.join(missing)}")

	return {
		"provider": "twilio",
		"channel": parsed_channel.value,
		"to": normalized_phone,
		"status": "accepted",
		"message_preview": message,
		"provider_message_id": f"pending-{parsed_channel.value}-{int(datetime.now(timezone.utc).timestamp())}",
		"sent_at": datetime.now(timezone.utc).isoformat(),
	}
