import { useEffect, useMemo, useState } from "react";

import client from "../api/client";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

const mockReportData = [
  {
    report_id: "r1",
    app_name: "Gmail",
    action_taken: "clicked",
    ranking_score: 0.94,
    timestamp: "2026-04-10T09:20:00Z",
  },
  {
    report_id: "r2",
    app_name: "WhatsApp",
    action_taken: "clicked",
    ranking_score: 0.58,
    timestamp: "2026-04-10T08:50:00Z",
  },
  {
    report_id: "r3",
    app_name: "Flipkart",
    action_taken: "dismissed",
    ranking_score: 0.31,
    timestamp: "2026-04-10T07:45:00Z",
  },
  {
    report_id: "r4",
    app_name: "Gmail",
    action_taken: "clicked",
    ranking_score: 0.88,
    timestamp: "2026-04-10T10:05:00Z",
  },
  {
    report_id: "r5",
    app_name: "Swiggy",
    action_taken: "dismissed",
    ranking_score: 0.28,
    timestamp: "2026-04-10T06:30:00Z",
  },
  {
    report_id: "r6",
    app_name: "Calendar",
    action_taken: "forwarded",
    ranking_score: 0.72,
    timestamp: "2026-04-10T11:00:00Z",
  },
];

const actionBadgeClasses = {
  clicked: "bg-green-500/20 text-green-300",
  dismissed: "bg-red-500/20 text-red-300",
  forwarded: "bg-blue-500/20 text-blue-300",
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await client.get(`/report/${userId}`);
        const data = Array.isArray(response.data) ? response.data : [];

        if (!data.length) {
          if (isMounted) {
            setReports(mockReportData);
          }
          return;
        }

        const normalized = data.map((item) => ({
          ...item,
          app_name: item.app_name || "Unknown",
        }));

        if (isMounted) {
          setReports(normalized);
        }
      } catch (_error) {
        if (isMounted) {
          setReports(mockReportData);
          setLoadError("Using demo analytics because API data is unavailable.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (userId) {
      fetchReports();
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const chartRows = useMemo(() => {
    const grouped = reports.reduce((acc, item) => {
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

    return Object.values(grouped).sort((a, b) => (b.clicks + b.dismissals) - (a.clicks + a.dismissals));
  }, [reports]);

  const maxCount = useMemo(() => {
    const counts = chartRows.flatMap((row) => [row.clicks, row.dismissals]);
    return Math.max(...counts, 1);
  }, [chartRows]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-2 text-sm text-gray-300">Track interaction outcomes and model behavior signals.</p>
          {loadError && <p className="mt-2 text-sm text-amber-300">{loadError}</p>}
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-cyan-400" />
          </div>
        ) : (
          <div className="space-y-8">
            <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
              <div className="border-b border-gray-800 px-4 py-3">
                <h2 className="text-lg font-semibold text-white">Report History Table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-4 py-3">App</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((row) => {
                      const badgeClass = actionBadgeClasses[row.action_taken] || "bg-gray-500/20 text-gray-300";
                      return (
                        <tr key={row.report_id} className="border-t border-gray-800/70">
                          <td className="px-4 py-3 font-medium text-white">{row.app_name || "Unknown"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                              {row.action_taken}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-cyan-300">{Number(row.ranking_score || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-300">{formatTimestamp(row.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">Clicks vs Dismissals by App</h2>

              <svg viewBox={`0 0 860 ${Math.max(140, chartRows.length * 56 + 24)}`} className="w-full">
                {chartRows.map((row, index) => {
                  const y = 20 + index * 56;
                  const clickWidth = Math.max((row.clicks / maxCount) * 260, row.clicks > 0 ? 8 : 0);
                  const dismissWidth = Math.max((row.dismissals / maxCount) * 260, row.dismissals > 0 ? 8 : 0);

                  return (
                    <g key={row.app_name}>
                      <text x="0" y={y + 18} fill="#E5E7EB" fontSize="13" fontWeight="600">
                        {row.app_name}
                      </text>

                      <rect x="170" y={y} width={clickWidth} height="14" rx="7" fill="#22D3EE" opacity="0.9" />
                      <text x={170 + clickWidth + 8} y={y + 11} fill="#67E8F9" fontSize="12" fontWeight="700">
                        {row.clicks}
                      </text>

                      <rect x="170" y={y + 22} width={dismissWidth} height="14" rx="7" fill="#EF4444" opacity="0.85" />
                      <text x={170 + dismissWidth + 8} y={y + 33} fill="#FCA5A5" fontSize="12" fontWeight="700">
                        {row.dismissals}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-300">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" /> Clicks
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Dismissals
                </span>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
