import { useEffect, useMemo, useState } from "react";

import client from "../api/client";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

const actionBadgeClasses = {
  clicked: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  dismissed: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  forwarded: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
};

function formatTimestamp(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Analytics() {
  const { user_id: userId } = useUser();
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchAnalytics = async () => {
      if (!userId) {
        return;
      }

      setIsLoading(true);
      setLoadError("");

      try {
        const [reportRes, notifRes] = await Promise.all([
          client.get(`/report/${userId}`),
          client.get(`/notifications/${userId}`),
        ]);

        const reportData = Array.isArray(reportRes.data) ? reportRes.data : [];
        const notifData = Array.isArray(notifRes.data) ? notifRes.data : [];

        if (isMounted) {
          setReports(reportData);
          setNotifications(notifData);
          if (!reportData.length) {
            setLoadError("No report logs yet. Interact with notifications to generate analytics.");
          }
        }
      } catch (_error) {
        if (isMounted) {
          setReports([]);
          setNotifications([]);
          setLoadError("Unable to load analytics data right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalytics();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const notificationsById = useMemo(() => {
    return notifications.reduce((acc, item) => {
      acc[item.notif_id] = item;
      return acc;
    }, {});
  }, [notifications]);

  const reportRows = useMemo(() => {
    return reports.map((report) => ({
      ...report,
      app_name: notificationsById[report.notif_id]?.app_name || "Unmapped Notification",
    }));
  }, [notificationsById, reports]);

  const chartRows = useMemo(() => {
    const grouped = reportRows.reduce((acc, item) => {
      if (item.app_name === "Unmapped Notification") {
        return acc;
      }
      const app = item.app_name || "Unknown";
      if (!acc[app]) {
        acc[app] = { app_name: app, clicks: 0, dismissals: 0 };
      }
      if (item.action_taken === "clicked") {
        acc[app].clicks += 1;
      }
      if (item.action_taken === "dismissed") {
        acc[app].dismissals += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.clicks + b.dismissals - (a.clicks + a.dismissals));
  }, [reportRows]);

  const maxCount = useMemo(() => {
    const counts = chartRows.flatMap((row) => [row.clicks, row.dismissals]);
    return Math.max(...counts, 1);
  }, [chartRows]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] transition-colors duration-300">
      <Navbar />

      <main className="pt-28 px-6 lg:px-12 pb-12 max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Review report actions and ranking performance by app.</p>
          {loadError && (
            <p className="mt-3 rounded-xl border border-[#f1d6c5] bg-[#fff6ef] px-3 py-2 text-sm text-[#915d30]">
              {loadError}
            </p>
          )}
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Report History Table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-white/5 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">App</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => {
                      const badgeClass = actionBadgeClasses[row.action_taken] || "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300";
                      return (
                        <tr key={row.report_id} className="border-t border-gray-100 dark:border-white/10">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.app_name}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                              {row.action_taken}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{Number(row.ranking_score || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatTimestamp(row.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Clicks vs Dismissals by App</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Rows without a matching notification are kept in table history but excluded from this chart.
              </p>

              <svg viewBox={`0 0 700 ${Math.max(160, chartRows.length * 56 + 40)}`} className="w-full mt-4">
                {chartRows.map((row, index) => {
                  const y = 20 + index * 56;
                  const clickWidth = (row.clicks / maxCount) * 220;
                  const dismissWidth = (row.dismissals / maxCount) * 220;

                  return (
                    <g key={row.app_name}>
                      <text x="0" y={y + 18} fill="currentColor" className="text-xs" style={{ fontSize: 12 }}>
                        {row.app_name}
                      </text>

                      {row.clicks > 0 && (
                        <>
                          <rect x="190" y={y + 2} width={clickWidth} height="14" rx="7" fill="#4F46E5" />
                          <text x={190 + clickWidth + 8} y={y + 13} fill="#4F46E5" style={{ fontSize: 12, fontWeight: 700 }}>
                            {row.clicks}
                          </text>
                        </>
                      )}

                      {row.dismissals > 0 && (
                        <>
                          <rect x="190" y={y + 24} width={dismissWidth} height="14" rx="7" fill="#E11D48" />
                          <text x={190 + dismissWidth + 8} y={y + 35} fill="#E11D48" style={{ fontSize: 12, fontWeight: 700 }}>
                            {row.dismissals}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  Clicks
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger" />
                  Dismissals
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
