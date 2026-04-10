const badgeClassByPriority = {
  low: "bg-gray-500/20 text-gray-300",
  mid: "bg-yellow-500/20 text-yellow-300",
  high: "bg-cyan-500/20 text-cyan-300",
};

function getPriorityBadgeClass(priority) {
  if (priority <= 2) {
    return badgeClassByPriority.low;
  }
  if (priority === 3) {
    return badgeClassByPriority.mid;
  }
  return badgeClassByPriority.high;
}

export default function AppToggle({ appName, priority, onChange }) {
  const badgeClass = getPriorityBadgeClass(priority);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-white">{appName}</p>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            value={priority}
            onChange={(event) => onChange(appName, Number(event.target.value))}
            className="h-2 w-40 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-cyan-400"
          />
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
            {priority}
          </span>
        </div>
      </div>
    </div>
  );
}
