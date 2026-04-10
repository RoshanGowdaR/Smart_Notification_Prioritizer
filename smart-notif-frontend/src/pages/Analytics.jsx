import { useEffect, useMemo, useState } from "react";

import client from "../api/client";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

const actionBadgeClasses = {
  clicked: "border border-[#b8d9c8] bg-[#edf9f2] text-[#1f6b46]",
  dismissed: "border border-[#f2d3ba] bg-[#fff4e9] text-[#9a6118]",
  forwarded: "border border-[#c7d8f2] bg-[#eff5ff] text-[#1a4b97]",
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
      if (!userId) {
        return;
      }

      setIsLoading(true);
      setLoadError("");

      try {
        const response = await client.get(`/report/${userId}`);
        const data = Array.isArray(response.data) ? response.data : [];

        const normalized = data.map((item) => ({
          ...item,
          app_name: item.app_name || "Unknown",
        }));

        if (isMounted) {
          setReports(normalized);
          if (!normalized.length) {
            setLoadError("No report logs yet. Interact with notifications to generate analytics.");
          }
        }
      } catch (_error) {
        if (isMounted) {
          setReports([]);
          setLoadError("Unable to load analytics data right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchReports();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const chartRows = useMemo(() => {
    const grouped = reports.reduce((acc, item) => {
      const app = item.app_name || "Unknown";
      if (!acc[app]) {
        acc[app] = { app_name: app, clicks: 0, dismissals: 0, forwarded: 0 };
      }
      if (item.action_taken === "clicked") {
        acc[app].clicks += 1;
      }
      if (item.action_taken === "dismissed") {
        acc[app].dismissals += 1;
      }
      if (item.action_taken === "forwarded") {
        acc[app].forwarded += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => (b.clicks + b.dismissals + b.forwarded) - (a.clicks + a.dismissals + a.forwarded));
  }, [reports]);

  const maxCount = useMemo(() => {
    const counts = chartRows.flatMap((row) => [row.clicks, row.dismissals, row.forwarded]);
    return Math.max(...counts, 1);
  }, [chartRows]);

  const clickedTotal = reports.filter((r) => r.action_taken === "clicked").length;
  const dismissedTotal = reports.filter((r) => r.action_taken === "dismissed").length;

  return (
    <div className="shell">
      <Navbar />

      <main className="section-wrap py-8">
        <header className="panel mb-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="kicker">Model Insight</p>
              <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.04em] text-[#102447]">Analytics</h1>
              <p className="mt-2 text-sm text-[#4f648c]">Track user actions and optimize your ranking strategy.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="metric-pill">Clicks: {clickedTotal}</span>
              <span className="metric-pill">Dismissed: {dismissedTotal}</span>
            </div>
          </div>
          {loadError && <p className="mt-3 rounded-xl border border-[#f0dbbe] bg-[#fff5e9] px-3 py-2 text-sm text-[#8c5928]">{loadError}</p>}
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b9cbe8] border-t-[#0B3D91]" />
          </div>
        ) : (
          <div className="space-y-8">
            <section className="panel overflow-hidden">
              <div className="border-b border-[#d8e2f3] px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#143161]">Report History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f4f8ff] text-xs uppercase tracking-wide text-[#6078a3]">
                    <tr>
                      <th className="px-4 py-3">App</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((row) => {
                      const badgeClass = actionBadgeClasses[row.action_taken] || "border border-[#c7d8f2] bg-[#eff5ff] text-[#1a4b97]";
                      return (
                        <tr key={row.report_id} className="border-t border-[#e0e8f6]">
                          <td className="px-4 py-3 font-semibold text-[#143161]">{row.app_name || "Unknown"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                              {row.action_taken}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#264672]">{Number(row.ranking_score || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-[#6279a1]">{formatTimestamp(row.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-[#143161]">Actions by App</h2>

              <svg viewBox={`0 0 900 ${Math.max(140, chartRows.length * 64 + 24)}`} className="w-full">
                {chartRows.map((row, index) => {
                  const y = 20 + index * 64;
                  const clickWidth = Math.max((row.clicks / maxCount) * 230, row.clicks > 0 ? 8 : 0);
                  const dismissWidth = Math.max((row.dismissals / maxCount) * 230, row.dismissals > 0 ? 8 : 0);
                  const forwardedWidth = Math.max((row.forwarded / maxCount) * 230, row.forwarded > 0 ? 8 : 0);

                  return (
                    <g key={row.app_name}>
                      <text x="0" y={y + 20} fill="#123463" fontSize="13" fontWeight="700">
                        {row.app_name}
                      </text>

                      <rect x="200" y={y} width={clickWidth} height="12" rx="6" fill="#1f6b46" opacity="0.92" />
                      <text x={200 + clickWidth + 8} y={y + 10} fill="#1f6b46" fontSize="12" fontWeight="700">{row.clicks}</text>

                      <rect x="200" y={y + 18} width={dismissWidth} height="12" rx="6" fill="#c7782f" opacity="0.85" />
                      <text x={200 + dismissWidth + 8} y={y + 28} fill="#9a6118" fontSize="12" fontWeight="700">{row.dismissals}</text>

                      <rect x="200" y={y + 36} width={forwardedWidth} height="12" rx="6" fill="#1a4b97" opacity="0.9" />
                      <text x={200 + forwardedWidth + 8} y={y + 46} fill="#1a4b97" fontSize="12" fontWeight="700">{row.forwarded}</text>
                    </g>
                  );
                })}
              </svg>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#5f789f]">
                <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1f6b46]" /> Clicked</span>
                <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c7782f]" /> Dismissed</span>
                <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1a4b97]" /> Forwarded</span>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
