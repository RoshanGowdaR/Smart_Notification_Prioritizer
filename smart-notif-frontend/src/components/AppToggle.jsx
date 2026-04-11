function getPriorityBadgeClass(level) {
  if (level <= 2) {
    return "rounded-full px-2.5 py-1 text-xs bg-gray-100 dark:bg-white/5 text-gray-400";
  }
  if (level === 3) {
    return "rounded-full px-2.5 py-1 text-xs bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300";
  }
  return "rounded-full px-2.5 py-1 text-xs bg-indigo-600 text-white";
}

export default function AppToggle({ appName, priorityLevel = 3, onLevelChange }) {
  const level = Number(priorityLevel || 3);
  const badgeClass = getPriorityBadgeClass(level);

  return (
    <div className="glass-card rounded-2xl p-4 hover:-translate-y-1 transition-transform">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{appName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Priority level</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[320px]">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={level}
            onChange={(event) => onLevelChange(appName, Number(event.target.value))}
            className="w-full accent-indigo-600"
          />
          <span className={badgeClass}>P{level}</span>
        </div>
      </div>
    </div>
  );
}
