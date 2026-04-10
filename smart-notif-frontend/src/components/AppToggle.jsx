import { useMemo, useState } from "react";

const badgeClassByPriority = {
  low: "border border-[#f3d8b8] bg-[#fff4e6] text-[#9a6118]",
  mid: "border border-[#c7d8f2] bg-[#eff5ff] text-[#1a4b97]",
  high: "border border-[#a8c7ff] bg-[#e5efff] text-[#0b3d91]",
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

export default function AppToggle({ appName, selected, keywordLevels = {}, onToggleSelect, onKeywordsChange }) {
  const badgeClass = getPriorityBadgeClass(selected ? 5 : 1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [newKeywordPriority, setNewKeywordPriority] = useState(3);

  const keywordEntries = useMemo(
    () => Object.entries(keywordLevels).sort((a, b) => a[0].localeCompare(b[0])),
    [keywordLevels],
  );

  const handleAddKeyword = () => {
    const cleaned = keywordInput.trim().toLowerCase();
    if (!cleaned) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(keywordLevels, cleaned)) {
      setKeywordInput("");
      return;
    }
    onKeywordsChange(appName, {
      ...keywordLevels,
      [cleaned]: Number(newKeywordPriority),
    });
    setKeywordInput("");
    setNewKeywordPriority(3);
  };

  const handleRemoveKeyword = (keyword) => {
    const nextLevels = { ...keywordLevels };
    delete nextLevels[keyword];
    onKeywordsChange(appName, nextLevels);
  };

  const handleKeywordPriorityChange = (keyword, level) => {
    onKeywordsChange(appName, {
      ...keywordLevels,
      [keyword]: Number(level),
    });
  };

  return (
    <div className="panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-[#143161]">{appName}</p>

        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
            {selected ? "Selected" : "Deselected"}
          </span>
          <button
            type="button"
            onClick={() => onToggleSelect(appName, !selected)}
            className="btn-ink h-8 px-3 text-xs"
          >
            {selected ? "Deselect" : "Select"}
          </button>
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="btn-ghost h-8 px-3 text-xs"
          >
            {detailsOpen ? "Hide Details" : "More Details"}
          </button>
        </div>
      </div>

      {detailsOpen && (
        <div className="mt-4 border-t border-[#dce6f5] pt-4">
          <p className="mb-2 text-xs text-[#4e6791]">
            Add keywords and assign a priority level. Matching keywords boost ranking for {appName} notifications.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddKeyword();
                }
              }}
              placeholder="e.g. interview, urgent, invoice"
              className="h-9 flex-1 rounded-xl border border-[#c6d7ef] bg-white px-3 text-xs text-[#213b65] outline-none focus:border-[#0B3D91]"
            />
            <select
              value={newKeywordPriority}
              onChange={(event) => setNewKeywordPriority(Number(event.target.value))}
              className="h-9 rounded-xl border border-[#c6d7ef] bg-white px-2 text-xs text-[#213b65] outline-none focus:border-[#0B3D91]"
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  Priority {level}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddKeyword}
              className="btn-ink h-9 px-3 text-xs"
            >
              Add Keyword
            </button>
          </div>

          {keywordEntries.length > 0 && (
            <div className="mt-3 space-y-2">
              {keywordEntries.map(([keyword, level]) => (
                <div key={keyword} className="flex items-center gap-3 rounded-xl border border-[#d5e2f5] bg-[#f9fbff] px-3 py-2">
                  <span className="w-32 truncate text-xs font-semibold text-[#1d3f77]">{keyword}</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={Number(level) || 3}
                    onChange={(event) => handleKeywordPriorityChange(keyword, Number(event.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[#dbe8fb] accent-[#0B3D91]"
                  />
                  <span className="w-6 text-center text-xs font-semibold text-[#0B3D91]">{Number(level) || 3}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="rounded-lg border border-[#d5dff0] bg-white px-2 py-1 text-[11px] text-[#6a7ea2] transition hover:border-[#ffb8b2] hover:text-[#c52219]"
                    title="Remove keyword"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
