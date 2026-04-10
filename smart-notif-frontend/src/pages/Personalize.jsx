import { useEffect, useMemo, useState } from "react";

import client from "../api/client";
import AppToggle from "../components/AppToggle";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

const appList = [
  "Gmail",
  "WhatsApp",
  "Calendar",
  "Slack",
  "Jira",
  "Instagram",
  "Telegram",
  "Flipkart",
  "Swiggy",
  "Myntra",
  "X",
  "System",
];

const defaultPriorities = appList.reduce((acc, app) => {
  acc[app] = 3;
  return acc;
}, {});

export default function Personalize() {
  const { user_id: userId } = useUser();
  const [priorities, setPriorities] = useState(defaultPriorities);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPriorities = async () => {
      setIsLoading(true);
      try {
        const response = await client.get(`/priority/${userId}`);
        const loaded = response?.data?.priority_apps || {};

        const normalized = appList.reduce((acc, app) => {
          const value = Number(loaded[app]);
          acc[app] = Number.isFinite(value) && value >= 1 && value <= 5 ? value : 3;
          return acc;
        }, {});

        if (isMounted) {
          setPriorities(normalized);
        }
      } catch (_error) {
        if (isMounted) {
          setPriorities(defaultPriorities);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (userId) {
      loadPriorities();
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handlePriorityChange = (appName, newValue) => {
    setPriorities((prev) => ({ ...prev, [appName]: newValue }));
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      await client.post("/priority/set", {
        user_id: userId,
        priority_apps: priorities,
        ranking_weights: {
          urgency: 0.4,
          recency: 0.3,
          category: 0.3,
        },
      });

      setShowSavedToast(true);
      window.setTimeout(() => {
        setShowSavedToast(false);
      }, 3000);
    } catch (_error) {
      setSaveError("Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const averagePriority = useMemo(() => {
    const values = Object.values(priorities);
    const sum = values.reduce((total, value) => total + Number(value || 0), 0);
    return (sum / values.length).toFixed(2);
  }, [priorities]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Personalize Priorities</h1>
          <p className="mt-2 text-sm text-gray-300">
            Tune app-level priority scores. Current average priority: <span className="text-cyan-300">{averagePriority}</span>
          </p>
        </header>

        {showSavedToast && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            Preferences saved!
          </div>
        )}

        {saveError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {saveError}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-cyan-400" />
          </div>
        ) : (
          <section className="space-y-3">
            {appList.map((appName) => (
              <AppToggle
                key={appName}
                appName={appName}
                priority={priorities[appName]}
                onChange={handlePriorityChange}
              />
            ))}
          </section>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSaving || isLoading}
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </main>
    </div>
  );
}
