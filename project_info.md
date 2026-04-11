# Smart Notification Prioritizer - Project Information

## 1. Project Idea
Smart Notification Prioritizer is a student-focused productivity platform that reduces notification overload by collecting incoming updates (currently Gmail), ranking them by urgency, and escalating important unseen alerts through WhatsApp and SMS.

The core goal is simple:
- Show users only what matters first.
- Explain why a notification is important.
- Ensure critical messages are not missed.

## 2. Problem We Are Solving
Users often miss important updates because:
- They receive too many low-value notifications.
- Important messages are mixed with promotional/noise content.
- There is no proactive follow-up mechanism for unseen critical messages.

Our platform addresses this by combining prioritization + explainability + escalation.

## 3. Key Features
- Gmail notification ingestion and sync.
- Priority ranking based on multiple weighted factors.
- Keyword-based urgency boosting with user-defined priorities.
- Clean dashboard with score and reason indicators.
- Personalization panel for app-level and keyword-level preferences.
- Profile management including phone number for escalation.
- Report logging for analytics and action tracking.
- Automated escalation flow:
  - Wait window for user attention.
  - WhatsApp alert for unseen high-priority notifications.
  - SMS fallback when user does not respond.
- WhatsApp reply webhook support to stop further escalation after acknowledgment.

## 4. Product Flow (High Level)
1. User signs in (Google/Supabase Auth).
2. Gmail data is synced into notifications storage.
3. Notifications are scored and ordered by urgency.
4. User sees ranked feed and can mark items as seen.
5. For unseen critical notifications, automation pipeline runs.
6. If user replies on WhatsApp, escalation is acknowledged and suppression logic prevents further noise.

## 5. Tools and Platforms Used
- VS Code for development.
- Git + GitHub for version control and branch-based delivery.
- Supabase Dashboard for DB, auth, and SQL operations.
- Twilio Console + WhatsApp Sandbox for messaging.
- ngrok for exposing local FastAPI webhook endpoints to Twilio.

## 6. Tech Stack
### Frontend
- React (Vite)
- Tailwind CSS
- Framer Motion
- Lucide Icons

### Backend
- FastAPI (Python)
- Uvicorn ASGI server

### Database and Auth
- Supabase (PostgreSQL + Auth)

### External Integrations
- Gmail API (data source)
- Groq API (urgent summary generation)
- Twilio API (WhatsApp + SMS delivery)
- ngrok (public webhook tunnel)

## 7. Why These Technologies Were Chosen
- React + Vite:
  - Fast developer experience and modern component architecture.
  - Good fit for dynamic dashboard and preference-heavy UI.
- Tailwind:
  - Rapid, consistent UI implementation and easy visual iteration.
- FastAPI:
  - High performance, clear route structure, and strong typing with Pydantic.
  - Excellent for API-first backend and async workflows.
- Supabase:
  - Combines PostgreSQL + auth with low setup overhead.
  - Easy REST access and dashboard operations for rapid iteration.
- Twilio:
  - Reliable WhatsApp/SMS APIs and sandbox support for testing.
- Groq:
  - Fast LLM summarization for compact, urgent forwarding messages.
- ngrok:
  - Quick, secure local-to-public webhook exposure during development.

## 8. Ranking Logic (How Prioritization Works)
Each notification is scored using combined signals such as:
- App-level user preference weight.
- Recency score (newer is higher).
- Category urgency (work/system/social/promo levels).
- Keyword boost from user-defined keyword priority rules.

The ranked output is sorted by final score and shown with explainability hints (for example matched keyword and priority level).

## 9. Automation Design
The automation is implemented in backend services and routes.

Main behavior:
- Trigger condition: unseen notification created/synced.
- Delay window: short wait to let user check naturally.
- Step 1: send WhatsApp alert with compact urgent summary.
- Step 2: wait again for user action/reply.
- Step 3: if no acknowledgment, send SMS fallback.

Safety and noise-control behavior includes:
- Skip escalation when user has no phone.
- Skip when notification is already seen.
- Suppress duplicate recent WhatsApp alerts.
- Suppress escalation when recent WhatsApp reply exists.
- Mark related pending notifications as seen on reply webhook.

## 10. Automation Procedure We Used (Implementation Procedure)
1. Data ingestion:
- Gmail notifications are stored in backend DB.

2. Queueing escalation tasks:
- On notification insert/sync, backend schedules async escalation checks.

3. WhatsApp message generation:
- Notification content is summarized with Groq to produce a concise urgent sentence.

4. WhatsApp dispatch:
- Twilio WhatsApp API sends alert to user phone.

5. Reply capture:
- Twilio inbound webhook calls backend endpoint.
- Backend marks WhatsApp automation entries as reply_received.

6. Fallback decision:
- If still unseen and no valid acknowledgment within window, backend sends SMS via Twilio.

7. Reporting:
- Automation and user action events are written to report/automation tables for observability.

## 11. Current Outcome
The system now provides:
- Priority-first notification consumption.
- Real-time escalation for critical unseen alerts.
- Reply-aware suppression to reduce spam/duplicate alerts.
- Practical end-to-end workflow suitable for student productivity and hackathon demonstration.

## 12. Future Enhancements
- Multi-source ingestion beyond Gmail (Calendar, Slack, etc.).
- Better anti-duplication with content hashing and cooldown policy tuning.
- User-configurable escalation timing windows.
- Rich analytics dashboard for response latency and alert effectiveness.
- Production deployment with persistent domains and secure secrets management.
