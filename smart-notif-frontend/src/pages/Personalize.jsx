import { useEffect, useMemo, useState } from "react";

import client from "../api/client";
import AppToggle from "../components/AppToggle";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

const appList = ["Gmail", "Google Calendar"];

export default function Personalize() {
  const { user_id: userId } = useUser();
  const [selectedApps, setSelectedApps] = useState({ Gmail: true, "Google Calendar": true });
  const [keywordRules, setKeywordRules] = useState({ Gmail: {}, "Google Calendar": {} });
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
        const loaded = response?.data?.priority_apps || {};
        const loadedKeywordRules = response?.data?.keyword_rules || {};

        const normalizedSelection = appList.reduce((acc, app) => {
          const value = Number(loaded[app]);
          acc[app] = Number.isFinite(value) ? value > 0 : true;
          return acc;
        }, {});

        const normalizedKeywordRules = appList.reduce((acc, app) => {
          const source = loadedKeywordRules[app];

          if (Array.isArray(source)) {
            acc[app] = source.reduce((map, keyword) => {
              const cleaned = String(keyword).trim().toLowerCase();
              if (cleaned) {
                map[cleaned] = 3;
              }
              return map;
            }, {});
            return acc;
          }

          if (source && typeof source === "object") {
            acc[app] = Object.entries(source).reduce((map, [keyword, level]) => {
              const cleaned = String(keyword).trim().toLowerCase();
              const normalizedLevel = Number(level);
              if (cleaned) {
                map[cleaned] = Number.isFinite(normalizedLevel) ? Math.min(5, Math.max(1, normalizedLevel)) : 3;
              }
              return map;
            }, {});
            return acc;
          }

          acc[app] = {};
          return acc;
        }, {});

        if (isMounted) {
          setSelectedApps(normalizedSelection);
          setKeywordRules(normalizedKeywordRules);
        }
      } catch (_error) {
        if (isMounted) {
          setSelectedApps({ Gmail: true, "Google Calendar": true });
          setKeywordRules({ Gmail: {}, "Google Calendar": {} });
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

  const handleToggleSelect = (appName, selected) => {
    setSelectedApps((prev) => ({ ...prev, [appName]: selected }));
  };

  const handleKeywordsChange = (appName, nextKeywordLevels) => {
    setKeywordRules((prev) => ({ ...prev, [appName]: nextKeywordLevels }));
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      await client.post("/priority/set", {
        user_id: userId,
        priority_apps: appList.reduce((acc, app) => {
          acc[app] = selectedApps[app] ? 1 : 0;
          return acc;
        }, {}),
        keyword_rules: keywordRules,
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

  const selectedCount = useMemo(() => Object.values(selectedApps).filter(Boolean).length, [selectedApps]);

  return (
    <div className="shell">
      <Navbar />

      <main className="section-wrap max-w-6xl py-8">
        <header className="panel mb-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="kicker">Personalization Engine</p>
              <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.04em] text-[#102447]">Personalize Priorities</h1>
              <p className="mt-2 text-sm text-[#4f648c]">Control how ranking reacts to your apps and context keywords.</p>
            </div>
            <div className="metric-pill">Selected apps: {selectedCount}</div>
          </div>
        </header>

        {showSavedToast && (
          <div className="mb-4 rounded-xl border border-[#b8dec9] bg-[#eefaf2] px-4 py-2 text-sm font-medium text-[#226743]">
            Preferences saved successfully.
          </div>
        )}

        {saveError && (
          <div className="mb-4 rounded-xl border border-[#f3c1bf] bg-[#fff3f3] px-4 py-2 text-sm text-[#9d2e2a]">
            {saveError}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b9cbe8] border-t-[#0B3D91]" />
          </div>
        ) : (
          <section className="space-y-3">
            {appList.map((appName) => (
              <AppToggle
                key={appName}
                appName={appName}
                selected={Boolean(selectedApps[appName])}
                keywordLevels={keywordRules[appName] || {}}
                onToggleSelect={handleToggleSelect}
                onKeywordsChange={handleKeywordsChange}
              />
            ))}
          </section>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSaving || isLoading}
            className="btn-ink h-11 px-6 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </main>
    </div>
  );
}
