import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import client from "../api/client";
import Navbar from "../components/Navbar";
import NotificationCard from "../components/NotificationCard";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";

const GOOGLE_PROVIDER_TOKEN_KEY = "notifyai_google_provider_token";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const sortByReceivedAt = (items) =>
  [...items].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

const sortByRankingScore = (items) =>
  [...items].sort((a, b) => Number(b.ranking_score || 0) - Number(a.ranking_score || 0));

const dedupeByContent = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.app_name || ""}|${item.content || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

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

  const loadRankedNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
      setErrorMessage("");
    }

    try {
      const response = await client.get(`/notifications/${userId}`);
      const data = dedupeByContent(Array.isArray(response.data) ? response.data : []);
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
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }

    setSyncWarning("");

    // Start sync in background so UI is responsive with current data.
    void syncGmailToBackend()
      .then(() => loadRankedNotifications({ silent: true }))
      .catch((_syncError) => {
        const syncDetail = _syncError?.response?.data?.detail;
        if (typeof syncDetail === "string" && syncDetail) {
          setSyncWarning(syncDetail);
        } else {
          setSyncWarning("Gmail sync is temporarily unavailable. Showing existing notifications.");
        }
      });

    await loadRankedNotifications();
  }, [loadRankedNotifications, syncGmailToBackend, userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkSeen = async (notifId) => {
    const target = notifications.find((item) => item.notif_id === notifId);

    try {
      await client.patch(`/notifications/${notifId}/seen`);

      if (target && userId) {
        await client.post("/report/log", {
          user_id: userId,
          notif_id: notifId,
          action_taken: "clicked",
          ranking_score: Number(target.ranking_score || 0),
        });
      }
    } catch (_error) {
      // Keep UX responsive even when backend mark-seen fails.
    }

    setNotifications((prev) =>
      prev.map((item) => (item.notif_id === notifId ? { ...item, is_seen: true } : item)),
    );
  };

  const unrankedFeed = useMemo(() => sortByReceivedAt(dedupeByContent(notifications)), [notifications]);
  const rankedFeed = useMemo(() => sortByRankingScore(dedupeByContent(notifications)), [notifications]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] transition-colors duration-300">
      <Navbar />

      <main className="pt-28 px-6 lg:px-12 pb-12 max-w-7xl mx-auto">
        <section className="sticky top-[72px] z-40 glass rounded-2xl p-4 md:p-5 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Dashboard</h1>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                {userId === DEMO_USER_ID ? "Demo mode · Connect account to sync" : "Connected account · Gmail sync enabled"}
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <button
                type="button"
                onClick={fetchNotifications}
                disabled={isLoading}
                className="px-5 py-2 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Refreshing..." : "Re-Rank"}
              </button>

              <div className="text-xs text-gray-500 dark:text-gray-500 flex gap-4 flex-wrap">
                <span className="text-indigo-500">● 0.8+ Critical</span>
                <span className="text-cyan-500">● 0.6+ High</span>
                <span className="text-gray-500">● 0.4+ Medium</span>
                <span className="text-gray-400">● below Low</span>
              </div>
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
              <Link to="/personalize" className="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Configure priorities
              </Link>
              <Link to="/analytics" className="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Open analytics
              </Link>
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                Unranked Feed
              </h2>
              <div className="space-y-3">
                {unrankedFeed.length ? (
                  unrankedFeed.map((item) => (
                    <NotificationCard key={`unranked-${item.notif_id}`} {...item} onMarkSeen={handleMarkSeen} />
                  ))
                ) : (
                  <div className="glass-card rounded-2xl p-4 text-sm text-gray-500 dark:text-gray-400">
                    No notifications available.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                Ranked Feed
              </h2>
              <div className="space-y-3">
                {rankedFeed.length ? (
                  rankedFeed.map((item) => (
                    <NotificationCard key={`ranked-${item.notif_id}`} {...item} onMarkSeen={handleMarkSeen} />
                  ))
                ) : (
                  <div className="glass-card rounded-2xl p-4 text-sm text-gray-500 dark:text-gray-400">
                    No ranked notifications yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
