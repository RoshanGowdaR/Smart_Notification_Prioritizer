const categoryBadgeStyles = {
  work: "bg-blue-500/20 text-blue-300",
  social: "bg-green-500/20 text-green-300",
  promo: "bg-yellow-500/20 text-yellow-300",
  system: "bg-red-500/20 text-red-300",
};

export default function NotificationCard({
  app_name,
  content,
  category,
  ranking_score,
  notif_id,
  is_seen,
  onMarkSeen,
}) {
  const badgeStyle = categoryBadgeStyles[category] || "bg-gray-500/20 text-gray-300";

  return (
    <article className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{app_name}</p>
          <p className="mt-1 text-sm text-gray-300">{content}</p>
        </div>
        <span className="rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-300">
          Score {Number(ranking_score || 0).toFixed(2)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyle}`}>
          {category}
        </span>

        {is_seen ? (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            ✓ Seen
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMarkSeen(notif_id)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Mark Seen
          </button>
        )}
      </div>
    </article>
  );
}
