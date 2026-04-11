import { useEffect, useMemo, useState } from "react";

import client from "../api/client";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

const appList = ["Gmail", "Google Calendar"];
const defaultRuleDraft = { keyword: "", priority: 3 };

const priorityLabel = (level) => {
  if (level === 5) return "P5 (Highest)";
  if (level === 4) return "P4 (High)";
  if (level === 3) return "P3 (Medium)";
  if (level === 2) return "P2 (Low)";
  return "P1 (Lowest)";
};

const normalizeKeywordRules = (loaded = {}) =>
  appList.reduce((acc, app) => {
    const appRules = loaded?.[app] || {};
    const normalizedEntries = Object.entries(appRules)
      .map(([key, value]) => [String(key).trim(), Number(value)])
      .filter(([key]) => key.length > 0)
      .map(([key, value]) => [key, Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : 3]);

    acc[app] = Object.fromEntries(normalizedEntries);
    return acc;
  }, {});

export default function Personalize() {
  const { user_id: userId } = useUser();
  const [toggleState, setToggleState] = useState(
    appList.reduce((acc, app) => {
      acc[app] = false;
      return acc;
    }, {}),
  );
  const [keywordRules, setKeywordRules] = useState(
    appList.reduce((acc, app) => {
      acc[app] = {};
      return acc;
    }, {}),
  );
  const [ruleDraft, setRuleDraft] = useState(
    appList.reduce((acc, app) => {
      acc[app] = { ...defaultRuleDraft };
      return acc;
    }, {}),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPriorities = async () => {
      if (!userId) {
        return;
      }

      setIsLoading(true);
      try {
        const response = await client.get(`/priority/${userId}`);
        const loadedRules = normalizeKeywordRules(response?.data?.keyword_rules || {});
        const loadedPriorityApps = response?.data?.priority_apps || {};

        const nextToggleState = appList.reduce((acc, app) => {
          const priorityValue = Number(loadedPriorityApps?.[app]);
          const hasRules = Object.keys(loadedRules[app] || {}).length > 0;
          acc[app] = hasRules || Number.isFinite(priorityValue) && priorityValue > 1;
          return acc;
        }, {});

        if (isMounted) {
          setKeywordRules(loadedRules);
          setToggleState(nextToggleState);
        }
      } catch (_error) {
        if (isMounted) {
          setKeywordRules(appList.reduce((acc, app) => ({ ...acc, [app]: {} }), {}));
          setToggleState(appList.reduce((acc, app) => ({ ...acc, [app]: false }), {}));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPriorities();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleToggle = (appName) => {
    setToggleState((prev) => {
      const next = !prev[appName];
      if (!next) {
        setKeywordRules((rules) => ({ ...rules, [appName]: {} }));
      }
      return { ...prev, [appName]: next };
    });
  };

  const handleDraftChange = (appName, key, value) => {
    setRuleDraft((prev) => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        [key]: value,
      },
    }));
  };

  const handleAddKeyword = (appName) => {
    const keyword = (ruleDraft[appName]?.keyword || "").trim();
    const priority = Number(ruleDraft[appName]?.priority || 3);
    if (!keyword) {
      return;
    }

    setKeywordRules((prev) => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        [keyword]: Math.min(5, Math.max(1, priority)),
      },
    }));

    setRuleDraft((prev) => ({
      ...prev,
      [appName]: { ...defaultRuleDraft },
    }));
  };

  const handleRemoveKeyword = (appName, keyword) => {
    setKeywordRules((prev) => {
      const nextRules = { ...(prev[appName] || {}) };
      delete nextRules[keyword];
      return {
        ...prev,
        [appName]: nextRules,
      };
    });
  };

  const handleKeywordPriorityChange = (appName, keyword, priority) => {
    setKeywordRules((prev) => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        [keyword]: Number(priority),
      },
    }));
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveError("");

    const sanitizedKeywordRules = appList.reduce((acc, app) => {
      acc[app] = toggleState[app] ? keywordRules[app] || {} : {};
      return acc;
    }, {});

    const priorityApps = appList.reduce((acc, app) => {
      acc[app] = toggleState[app] ? 5 : 1;
      return acc;
    }, {});

    try {
      await client.post("/priority/set", {
        user_id: userId,
        priority_apps: priorityApps,
        keyword_rules: sanitizedKeywordRules,
        ranking_weights: {
          urgency: 0.4,
          recency: 0.3,
          category: 0.3,
        },
      });

      setShowSavedToast(true);
      window.setTimeout(() => {
        setShowSavedToast(false);
      }, 2500);
    } catch (_error) {
      const backendMessage =
        _error?.response?.data?.detail ||
        _error?.message ||
        "Failed to save preferences. Please try again.";
      setSaveError(String(backendMessage));
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = useMemo(
    () => Object.values(toggleState).filter(Boolean).length,
    [toggleState],
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] transition-colors duration-300">
      <Navbar />

      {showSavedToast && (
        <div className="fixed top-24 right-6 z-50 glass-card rounded-xl px-4 py-3 text-green-500 dark:text-green-400 text-sm font-medium">
          ✓ Preferences saved!
        </div>
      )}

      <main className="pt-28 px-6 lg:px-12 pb-12 max-w-5xl mx-auto">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Personalize Priorities</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Turn ON keyword mode for each app, then add keywords and priority so emails are ranked accordingly.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 px-3 py-1 text-sm font-semibold">
              Active Apps: {enabledCount}
            </span>
          </div>
        </header>

        {saveError && (
          <div className="mb-4 rounded-xl border border-[#f1d6c5] bg-[#fff6ef] px-3 py-2 text-sm text-[#915d30]">
            {saveError}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
          </div>
        ) : (
          <section>
            {appList.map((appName) => (
              <div key={appName} className="glass-card rounded-2xl p-4 mb-4 border border-gray-200 dark:border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{appName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enable keyword-based ranking for this app</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle(appName)}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                      toggleState[appName] ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                    aria-pressed={toggleState[appName]}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        toggleState[appName] ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {toggleState[appName] && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3 items-end">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                          Keyword
                        </span>
                        <input
                          type="text"
                          value={ruleDraft[appName]?.keyword || ""}
                          onChange={(event) => handleDraftChange(appName, "keyword", event.target.value)}
                          placeholder="e.g. interview, invoice, deadline"
                          className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                          Priority
                        </span>
                        <select
                          value={ruleDraft[appName]?.priority || 3}
                          onChange={(event) => handleDraftChange(appName, "priority", Number(event.target.value))}
                          className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                        >
                          {[1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level}>
                              {priorityLabel(level)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleAddKeyword(appName)}
                        className="h-[44px] rounded-xl px-4 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(keywordRules[appName] || {}).length ? (
                        Object.entries(keywordRules[appName]).map(([keyword, priority]) => (
                          <div
                            key={`${appName}-${keyword}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2"
                          >
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{keyword}</span>

                            <div className="flex items-center gap-2">
                              <select
                                value={priority}
                                onChange={(event) =>
                                  handleKeywordPriorityChange(appName, keyword, Number(event.target.value))
                                }
                                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm text-gray-900 dark:text-white"
                              >
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <option key={level} value={level}>
                                    {priorityLabel(level)}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => handleRemoveKeyword(appName, keyword)}
                                className="rounded-lg px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No keywords added yet for {appName}.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSaving || isLoading}
            className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-lg shadow-indigo-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </main>
    </div>
  );
}
