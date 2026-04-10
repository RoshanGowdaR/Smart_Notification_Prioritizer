const categoryBadgeStyles = {
  work: "border border-[#b9d2ff] bg-[#edf4ff] text-[#1d4f9f]",
  social: "border border-[#d0d6ff] bg-[#f1f4ff] text-[#4253a8]",
  promo: "border border-[#f5ddb8] bg-[#fff5e8] text-[#9a6118]",
  system: "border border-[#cce8e7] bg-[#ecf8f7] text-[#17706a]",
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
  const badgeStyle = categoryBadgeStyles[category] || "border border-[#222222] bg-[#000000] text-[#888888]";

  return (
    <article className="panel-soft p-4 transition hover:-translate-y-[1px] hover:border-[#bdd1ee]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[#153466]">{app_name}</p>
          <p className="mt-2 text-sm text-[#475f87]">{content}</p>
        </div>
        <span className="rounded-full border border-[#b7c9e7] bg-[#f2f7ff] px-2.5 py-1 text-xs font-semibold text-[#18427f]">
          Score {Number(ranking_score || 0).toFixed(2)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyle}`}>
          {category}
        </span>

        {is_seen ? (
          <span className="rounded-full border border-[#c8d8f0] bg-[#f8fbff] px-2.5 py-1 text-xs font-semibold text-[#1e4c93]">
            ✓ Seen
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMarkSeen(notif_id)}
            className="btn-ink h-8 px-3 text-xs"
          >
            Mark Seen
          </button>
        )}
      </div>
    </article>
  );
}
