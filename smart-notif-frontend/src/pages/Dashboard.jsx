import { useCallback, useEffect, useMemo, useState } from "react";

import client from "../api/client";
import Navbar from "../components/Navbar";
import NotificationCard from "../components/NotificationCard";
import { useUser } from "../context/UserContext";

const mockNotifications = [
  {
    notif_id: "mock-1",
    app_name: "Gmail",
    content: "Quarterly review deck pending approval.",
    category: "work",
    ranking_score: 0.94,
    is_seen: false,
    received_at: "2026-04-10T09:20:00Z",
  },
  {
    notif_id: "mock-2",
    app_name: "WhatsApp",
    content: "Friends weekend plan updated.",
    category: "social",
    ranking_score: 0.58,
    is_seen: false,
    received_at: "2026-04-10T08:50:00Z",
  },
  {
    notif_id: "mock-3",
    app_name: "Flipkart",
    content: "Flash sale ends in 2 hours.",
    category: "promo",
    ranking_score: 0.31,
    is_seen: false,
    received_at: "2026-04-10T07:45:00Z",
  },
  {
    notif_id: "mock-4",
    app_name: "System",
    content: "Device security patch available.",
    category: "system",
    ranking_score: 0.72,
    is_seen: false,
    received_at: "2026-04-10T06:40:00Z",
  },
  {
    notif_id: "mock-5",
    app_name: "Calendar",
    content: "Project sync in 30 minutes.",
    category: "work",
    ranking_score: 0.88,
    is_seen: true,
    received_at: "2026-04-10T10:05:00Z",
  },
  {
    notif_id: "mock-6",
    app_name: "Instagram",
    content: "You were tagged in a new post.",
    category: "social",
    ranking_score: 0.49,
    is_seen: false,
    received_at: "2026-04-10T09:55:00Z",
  },
];

const sortByReceivedAt = (items) =>
  [...items].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

const sortByRankingScore = (items) =>
  [...items].sort((a, b) => Number(b.ranking_score || 0) - Number(a.ranking_score || 0));

export default function Dashboard() {
  const { user_id: userId } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await client.get(`/notifications/${userId}`);
      const data = Array.isArray(response.data) ? response.data : [];

      if (!data.length) {
        setNotifications(mockNotifications);
        return;
      }

      setNotifications(data);
    } catch (_error) {
      setNotifications(mockNotifications);
      setErrorMessage("Using demo notifications because API data is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    fetchNotifications();
  }, [fetchNotifications, userId]);

  const handleMarkSeen = async (notifId) => {
    try {
      await client.patch(`/notifications/${notifId}/seen`);
    } catch (_error) {
      // Keep UX responsive even if backend update fails.
    }

    setNotifications((prev) =>
      prev.map((item) => (item.notif_id === notifId ? { ...item, is_seen: true } : item)),
    );
  };

  const unrankedFeed = useMemo(() => sortByReceivedAt(notifications), [notifications]);
  const rankedFeed = useMemo(() => sortByRankingScore(notifications), [notifications]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Notification Dashboard</h1>
          <button
            type="button"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Refreshing..." : "Re-Rank"}
          </button>
          {errorMessage && <p className="text-sm text-amber-300">{errorMessage}</p>}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-cyan-400" />
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">Unranked Feed</h2>
              <div className="space-y-3">
                {unrankedFeed.map((item) => (
                  <NotificationCard key={`unranked-${item.notif_id}`} {...item} onMarkSeen={handleMarkSeen} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">Ranked Feed</h2>
              <div className="space-y-3">
                {rankedFeed.map((item) => (
                  <NotificationCard key={`ranked-${item.notif_id}`} {...item} onMarkSeen={handleMarkSeen} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
