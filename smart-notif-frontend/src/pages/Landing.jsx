import { useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import { useUser } from "../context/UserContext";

const featureCards = [
  {
    title: "Smart Ranking",
    description: "Prioritize what matters most with context-aware scoring.",
  },
  {
    title: "Learn Your Habits",
    description: "Bandit learning adapts to your clicks and dismissals over time.",
  },
  {
    title: "Auto-Forward",
    description: "Route critical unseen alerts to WhatsApp or SMS automatically.",
  },
];

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await client.post("/auth/google", {
        redirect_to: window.location.origin,
      });

      if (response.status >= 200 && response.status < 300) {
        // Mock user bootstrap for demo flow while OAuth callback integration is pending.
        setUser({
          user_id: "test-user-001",
          username: "Demo User",
          email: "demo@notifyai.app",
        });
        navigate("/dashboard");
        return;
      }

      throw new Error("Unexpected response from login endpoint.");
    } catch (error) {
      const message = error?.response?.data?.detail || "Google login failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Smart Notification Prioritizer
        </p>

        <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl">NotifyAI</h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-300 sm:text-xl">
          Your notifications, ranked by you
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="mt-10 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Signing in..." : "Login with Google"}
        </button>

        {errorMessage && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {errorMessage}
          </p>
        )}

        <div className="mt-14 grid w-full gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6 text-left shadow-xl shadow-black/20"
            >
              <h2 className="text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-gray-300">{card.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
