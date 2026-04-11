const categoryBadgeStyles = {
  work: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  social: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  promo: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
  system: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
};

function getScoreBadgeStyle(score) {
  if (score >= 0.8) {
    return "bg-indigo-600 text-white";
  }
  if (score >= 0.6) {
    return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300";
  }
  if (score >= 0.4) {
    return "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400";
  }
  return "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500";
}

export default function NotificationCard({
  app_name,
  content,
  category,
  ranking_score,
  matched_keyword,
  matched_priority,
  received_at,
  notif_id,
  is_seen,
  onMarkSeen,
}) {
  const safeScore = Number(ranking_score || 0);
  const categoryStyle = categoryBadgeStyles[category] || "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400";
  const scoreStyle = getScoreBadgeStyle(safeScore);

  return (
    <article className="glass-card rounded-2xl p-4 hover:-translate-y-1 transition-transform">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{app_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{content}</p>
          {received_at ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Received: {new Date(received_at).toLocaleString()}
            </p>
          ) : null}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${scoreStyle}`}>
          {safeScore.toFixed(2)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle}`}>
            {category}
          </span>

          {matched_keyword ? (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              Keyword: {matched_keyword} {matched_priority ? `(P${matched_priority})` : ""}
            </span>
          ) : null}
        </div>

        {is_seen ? (
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            ✓ Seen
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMarkSeen(notif_id)}
            className="text-xs border rounded-full px-3 py-1 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Mark Seen
          </button>
        )}
      </div>
    </article>
  );
}
