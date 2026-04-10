import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import client from "../api/client";
import Navbar from "../components/Navbar";
import NotificationCard from "../components/NotificationCard";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";

const GOOGLE_PROVIDER_TOKEN_KEY = "notifyai_google_provider_token";

const sortByReceivedAt = (items) =>
  [...items].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

const sortByRankingScore = (items) =>
  [...items].sort((a, b) => Number(b.ranking_score || 0) - Number(a.ranking_score || 0));

export default function Dashboard() {
  const { user_id: userId } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [syncWarning, setSyncWarning] = useState("");

  const syncGmailToBackend = useCallback(async () => {
    if (!userId) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const providerToken = session?.provider_token || localStorage.getItem(GOOGLE_PROVIDER_TOKEN_KEY);
    if (!providerToken) {
      return;
    }

    await client.post(`/notifications/${userId}/sync-gmail`, {
      access_token: providerToken,
      max_results: 25,
    });
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSyncWarning("");

    try {
      try {
        await syncGmailToBackend();
      } catch (_syncError) {
        const syncDetail = _syncError?.response?.data?.detail;
        if (typeof syncDetail === "string" && syncDetail) {
          setSyncWarning(syncDetail);
        } else {
          setSyncWarning("Gmail sync is temporarily unavailable. Showing existing notifications.");
        }
      }

      const response = await client.get(`/notifications/${userId}`);
      const data = Array.isArray(response.data) ? response.data : [];
      setNotifications(data);

      if (!data.length) {
        setErrorMessage("No notifications available yet. Add priorities and incoming events to begin ranking.");
      }
    } catch (_error) {
      setNotifications([]);
      const backendDetail = _error?.response?.data?.detail;
      if (typeof backendDetail === "string" && backendDetail) {
        setErrorMessage(backendDetail);
      } else {
        setErrorMessage("Could not load ranked notifications from backend. Please retry.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [syncGmailToBackend, userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkSeen = async (notifId) => {
    try {
      await client.patch(`/notifications/${notifId}/seen`);
    } catch (_error) {
      // Keep UX responsive even when backend mark-seen fails.
    }

    setNotifications((prev) =>
      prev.map((item) => (item.notif_id === notifId ? { ...item, is_seen: true } : item)),
    );
  };

  const unrankedFeed = useMemo(() => sortByReceivedAt(notifications), [notifications]);
  const rankedFeed = useMemo(() => sortByRankingScore(notifications), [notifications]);

  const seenCount = notifications.filter((n) => n.is_seen).length;

  return (
    <div className="shell">
      <Navbar />

      <main className="section-wrap py-8">
        <section className="panel mb-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="kicker">Live Ranking Engine</p>
              <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.04em] text-[#102447]">Notification Dashboard</h1>
              <p className="mt-2 text-sm text-[#4f648c]">Monitor incoming notifications and your real-time ranked feed in one place.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="metric-pill">Total: {notifications.length}</span>
              <span className="metric-pill">Seen: {seenCount}</span>
              <button
                type="button"
                onClick={fetchNotifications}
                disabled={isLoading}
                className="btn-ink disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Refreshing..." : "Re-Rank"}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-[#f1d6c5] bg-[#fff6ef] px-3 py-2 text-sm text-[#915d30]">
              {errorMessage}
            </div>
          )}

            {syncWarning && (
              <div className="mt-3 rounded-xl border border-[#f5dcb1] bg-[#fff9ec] px-3 py-2 text-sm text-[#8b640f]">
                {syncWarning}
              </div>
            )}

          {!notifications.length && !isLoading && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to="/personalize" className="btn-ghost inline-flex items-center">
                Configure priorities
              </Link>
              <Link to="/analytics" className="btn-ghost inline-flex items-center">
                Open analytics
              </Link>
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b9cbe8] border-t-[#0B3D91]" />
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-[#143161]">Unranked Feed (By Time)</h2>
              <div className="space-y-3">
                {unrankedFeed.length ? (
                  unrankedFeed.map((item) => (
                    <NotificationCard key={`unranked-${item.notif_id}`} {...item} onMarkSeen={handleMarkSeen} />
                  ))
                ) : (
                  <div className="panel-soft p-5 text-sm text-[#58709a]">No notifications available.</div>
                )}
              </div>
            </div>

            <div className="panel p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-[#143161]">Ranked Feed (By Score)</h2>
              <div className="space-y-3">
                {rankedFeed.length ? (
                  rankedFeed.map((item) => (
                    <NotificationCard key={`ranked-${item.notif_id}`} {...item} onMarkSeen={handleMarkSeen} />
                  ))
                ) : (
                  <div className="panel-soft p-5 text-sm text-[#58709a]">No ranked notifications yet.</div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
