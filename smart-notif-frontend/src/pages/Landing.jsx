import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";

const GOOGLE_PROVIDER_TOKEN_KEY = "notifyai_google_provider_token";

const featureBlocks = [
  {
    title: "Live Priority Ranking",
    description: "Scores notifications using app selection, recency, category urgency, and keyword-level boosts.",
  },
  {
    title: "Gmail + Calendar Focus",
    description: "Pulls your core work signals so important mail and schedule updates appear first.",
  },
  {
    title: "Keyword-Level Controls",
    description: "Set per-keyword intensity from 1 to 5 to shape ranking behavior around your context.",
  },
  {
    title: "Auto-Forwarding",
    description: "When score crosses threshold, send action-ready alerts to WhatsApp or SMS automatically.",
  },
  {
    title: "Behavior Learning",
    description: "Bandit-style updates adapt app weights from clicked versus dismissed decisions.",
  },
  {
    title: "Analytics + Profile Sync",
    description: "Track outcomes per app and persist your identity settings reliably across sessions.",
  },
];

const workflowSteps = [
  "Login with Google and grant Gmail/Calendar permissions.",
  "Select apps and configure keyword priorities in Personalize.",
  "Monitor ranked feed and mark seen actions from Dashboard.",
  "Review behavior trends and optimize in Analytics.",
  "Use automation rules to forward high-score notifications.",
];

const contactItems = [
  { label: "Email", value: "team.notifyai@bcehack.io" },
  { label: "Phone", value: "+91 98765 43210" },
  { label: "Location", value: "BCE Hackathon Innovation Cell" },
];

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user_id: userId, setUser } = useUser();

  useEffect(() => {
    let isMounted = true;

    const syncSessionUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUser = session?.user;
      if (!isMounted) {
        return;
      }

      const providerToken = session?.provider_token;
      if (providerToken) {
        localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, providerToken);
      }

      if (!sessionUser) {
        if (userId) {
          setUser({ user_id: "", username: "", email: "" });
        }
        return;
      }

      setUser({
        user_id: sessionUser.id,
        username: sessionUser.user_metadata?.full_name || sessionUser.email || "Google User",
        email: sessionUser.email || "",
      });

      await client.post("/users/upsert", {
        user_id: sessionUser.id,
        username: sessionUser.user_metadata?.full_name || sessionUser.email || "Google User",
        email_id: sessionUser.email,
        ph_num: null,
      });
      navigate("/dashboard", { replace: true });
    };

    syncSessionUser();

    return () => {
      isMounted = false;
    };
  }, [navigate, setUser, userId]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);

    try {
      await supabase.auth.signOut({ scope: "global" });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent select_account",
            include_granted_scopes: "true",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (_error) {
      setIsLoading(false);
    }
  };

  return (
    <main className="shell">
      <section className="section-wrap py-12 sm:py-16">
        <div className="panel fade-up relative overflow-hidden p-6 sm:p-9">
          <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="kicker">Intelligent Escalation Engine</p>
              <h1 className="hero-title mt-5">
                NEVER MISS WHAT
                <br />
                <span className="text-gradient">MATTERS MOST</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base text-[#44557a] sm:text-lg">
                NotifyAI helps students and professionals cut through noisy notifications by ranking what matters, learning from interactions, and escalating critical events through instant forwarding channels.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="btn-ink h-11 px-6 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Signing in..." : "Start with Google"}
                </button>
                <div className="metric-pill">Gmail + Google Calendar</div>
                <div className="metric-pill">Real-Time Ranking</div>
              </div>
            </div>

            <aside className="panel-soft p-5 sm:p-6">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#19376b]">Why Teams Use NotifyAI</h2>
              <div className="mt-4 space-y-3 text-sm text-[#334155]">
                <p className="panel-soft px-3 py-2">Priority scoring with keyword boost and recency weighting.</p>
                <p className="panel-soft px-3 py-2">Personalized app selection and adaptive learning loop.</p>
                <p className="panel-soft px-3 py-2">Automation hooks to route critical unseen alerts.</p>
                <p className="panel-soft px-3 py-2">Analytics dashboard for click versus dismissal behavior.</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="section-wrap pb-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureBlocks.map((feature, index) => (
            <article key={feature.title} className={`panel p-5 fade-up delay-${Math.min(index + 1, 3)}`}>
              <h3 className="text-lg font-extrabold text-[#102447]">{feature.title}</h3>
              <p className="mt-2 text-sm text-[#4a5e84]">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-wrap pb-10">
        <div className="panel p-6 sm:p-8">
          <h2 className="text-xl font-extrabold uppercase tracking-[0.08em] text-[#11264b]">How NotifyAI Works</h2>
          <div className="mt-5 grid gap-3">
            {workflowSteps.map((step, index) => (
              <div key={step} className="panel-soft flex items-start gap-3 px-4 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0B3D91] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-[#2c456f]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-wrap pb-14">
        <div className="panel p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-[0.08em] text-[#11264b]">Project Scope</h2>
              <p className="mt-3 text-sm text-[#445a82]">
                Built for high-volume communication environments, this platform combines prioritization, behavior-driven optimization, and forwarding automation in one workflow. It is designed for hackathon-grade demonstrability with practical production pathways.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-[0.08em] text-[#11264b]">Contact Us</h2>
              <div className="mt-3 space-y-2 text-sm">
                {contactItems.map((item) => (
                  <div key={item.label} className="panel-soft flex items-center justify-between px-3 py-2">
                    <span className="font-semibold text-[#25406f]">{item.label}</span>
                    <span className="text-[#4d6288]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
