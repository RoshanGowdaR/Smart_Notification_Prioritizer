-- Smart Notification Prioritizer schema for Supabase (public)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.users (
  user_id uuid primary key default gen_random_uuid(),
  username text not null,
  email_id text not null unique,
  ph_num text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  notif_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  app_name text not null,
  content text not null,
  category text not null check (category in ('work', 'social', 'promo', 'system')),
  is_seen boolean not null default false,
  received_at timestamptz not null default now()
);

create table if not exists public.priority (
  priority_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  priority_apps jsonb not null default '{}'::jsonb,
  keyword_rules jsonb not null default '{}'::jsonb,
  ranking_weights jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation (
  auto_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  notif_id uuid not null references public.notifications(notif_id) on delete cascade,
  priority_id uuid not null references public.priority(priority_id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms')),
  reply_template text not null,
  reply_received boolean not null default false,
  triggered_at timestamptz not null default now()
);

alter table if exists public.automation
add column if not exists reply_received boolean not null default false;

create table if not exists public.report (
  report_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  notif_id uuid not null references public.notifications(notif_id) on delete cascade,
  action_taken text not null check (action_taken in ('clicked', 'dismissed', 'forwarded')),
  ranking_score double precision not null,
  timestamp timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_priority_user_id on public.priority(user_id);
create index if not exists idx_automation_user_id on public.automation(user_id);
create index if not exists idx_report_user_id on public.report(user_id);
