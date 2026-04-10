import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  Smartphone,
  MessageCircle,
  AlertCircle,
  Zap,
  ArrowRight,
  Layers,
  Briefcase,
  CreditCard,
  Heart,
  GraduationCap,
  Code,
  DollarSign,
} from "lucide-react";

import client from "../api/client";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";
import ThemeToggle from "../components/ThemeToggle";

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // Continue with session lookup or fallback.
        }
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (session?.user) {
          setUser({
            user_id: session.user.id,
            username:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email ||
              "Demo User",
            email: session.user.email || "demo@notifyai.com",
          });
          navigate("/dashboard", { replace: true });
          return;
        }

        if (code) {
          setUser({
            user_id: "test-user-001",
            username: "Demo User",
            email: "demo@notifyai.com",
          });
          navigate("/dashboard", { replace: true });
        }
      } catch {
        if (!isMounted) {
          return;
        }
      }
    };

    handleOAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate, setUser]);

  async function handleGoogleLogin() {
    setIsLoading(true);
    try {
      const res = await client.get("/auth/google", {
        params: {
          redirect_to: window.location.origin,
        },
      });
      const url = res?.data?.auth_url || res?.data?.oauth_url;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("no url");
    } catch {
      setUser({
        user_id: "test-user-001",
        username: "Demo User",
        email: "demo@notifyai.com",
      });
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] overflow-x-hidden transition-colors duration-300">
      <nav className="fixed top-0 w-full z-50 glass border-b py-4 px-6 lg:px-12 flex justify-between items-center">
        <div className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">NotifyAI</div>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="#problem"
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            The Problem
          </a>
          <a
            href="#solution"
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            How it Works
          </a>
          <a
            href="#use-cases"
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Use Cases
          </a>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="hidden md:inline-flex text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="px-5 py-2 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition-colors shadow-lg shadow-indigo-500/30 dark:shadow-none"
          >
            Try Demo
          </button>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 lg:px-12 overflow-hidden flex flex-col items-center text-center bg-gradient-to-b from-white via-indigo-50/30 to-white dark:from-[#050505] dark:via-indigo-950/20 dark:to-[#050505]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md mb-8 shadow-sm"
        >
          <span className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Smart Notification Prioritizer v1.0
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl text-gray-900 dark:text-white"
        >
          <span className="block">Never Miss What</span>
          <span className="block text-gradient mt-2 py-2">Matters. Ever.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl"
        >
          AI-powered ranking ensures your most critical notifications reach you - intelligently prioritized across Gmail,
          Calendar, and more.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="px-8 py-4 rounded-full bg-indigo-600 dark:bg-white text-white dark:text-black font-semibold hover:bg-indigo-700 dark:hover:bg-gray-100 transition-transform active:scale-95 flex items-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.3)] dark:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Zap className="w-5 h-5" />
            {isLoading ? "Signing in..." : "Login with Google"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative w-full max-w-5xl mx-auto mt-16"
        >
          <div className="glass-card rounded-3xl p-6 md:p-10">
            <div className="w-full rounded-2xl relative mb-2 flex flex-col md:flex-row items-center justify-center gap-4 text-left p-2">
              <div className="relative flex flex-col items-center p-6 rounded-2xl w-full md:w-1/3 border z-10 backdrop-blur-sm hover:-translate-y-2 transition-transform shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 shadow-lg flex items-center justify-center mb-4">
                  <Smartphone className="w-8 h-8 text-gray-700 dark:text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Push Notification</h3>
                <span className="bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400 text-xs px-2 py-1 rounded-full">
                  Ignored (2m)
                </span>
              </div>

              <div className="hidden md:flex w-12 items-center justify-center relative">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/30 to-transparent" />
                <div className="absolute w-8 h-8 rounded-full bg-white dark:bg-black border border-gray-200 dark:border-white/10 z-10 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>
              </div>

              <div className="relative flex flex-col items-center p-6 rounded-2xl w-full md:w-1/3 border z-10 backdrop-blur-sm hover:-translate-y-2 transition-transform shadow-sm bg-indigo-50 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-500/50">
                <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 shadow-lg flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">AI Ranked &amp; Forwarded</h3>
                <span className="bg-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 text-xs px-2 py-1 rounded-full">
                  Sent (Automatic)
                </span>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative h-4 w-4 rounded-full bg-indigo-500" />
                </span>
              </div>

              <div className="hidden md:flex w-12 items-center justify-center relative">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/30 to-transparent" />
                <div className="absolute w-8 h-8 rounded-full bg-white dark:bg-black border border-gray-200 dark:border-white/10 z-10 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>
              </div>

              <div className="relative flex flex-col items-center p-6 rounded-2xl w-full md:w-1/3 border z-10 backdrop-blur-sm hover:-translate-y-2 transition-transform shadow-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 shadow-lg flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">SMS Backup</h3>
                <span className="bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400 text-xs px-2 py-1 rounded-full">
                  Queued
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="problem" className="py-24 px-6 lg:px-12 bg-white dark:bg-[#050505]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-center text-gray-900 dark:text-white">
            The Cost of <span className="text-red-500 dark:text-red-400">Missed</span> Notifications
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-center mb-16">
            We ignore push notifications. We mute our phones. But missing the wrong message at the wrong time has
            real-world consequences.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-3 hover:-translate-y-1 transition-transform">
              <div className="bg-orange-100 dark:bg-orange-500/10 rounded-xl p-3 w-fit">
                <Briefcase className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Missed Job Offers</h3>
              <p className="text-gray-600 dark:text-gray-400">
                You did not see the recruiter email. By the time you opened the app, the role was filled.
              </p>
              <span className="bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 text-xs font-medium px-3 py-1 rounded-lg border border-red-100 dark:border-red-500/20 w-fit mt-3">
                Impact: Lost Opportunity
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col gap-3 hover:-translate-y-1 transition-transform">
              <div className="bg-red-100 dark:bg-red-500/10 rounded-xl p-3 w-fit">
                <CreditCard className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Payment Deadlines</h3>
              <p className="text-gray-600 dark:text-gray-400">
                The bank alert got lost in your 200+ daily push notifications. Result? Late fees and credit hits.
              </p>
              <span className="bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 text-xs font-medium px-3 py-1 rounded-lg border border-red-100 dark:border-red-500/20 w-fit mt-3">
                Impact: Financial Loss
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col gap-3 hover:-translate-y-1 transition-transform">
              <div className="bg-pink-100 dark:bg-pink-500/10 rounded-xl p-3 w-fit">
                <Heart className="w-6 h-6 text-pink-500" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Emergency Alerts</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Server went down or a loved one had an emergency. Your phone was on DND.
              </p>
              <span className="bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 text-xs font-medium px-3 py-1 rounded-lg border border-red-100 dark:border-red-500/20 w-fit mt-3">
                Impact: High Stress
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col gap-3 hover:-translate-y-1 transition-transform">
              <div className="bg-yellow-100 dark:bg-yellow-500/10 rounded-xl p-3 w-fit">
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Critical Meetings</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Calendar app sent a silent push. You missed the investor pitch of your life.
              </p>
              <span className="bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 text-xs font-medium px-3 py-1 rounded-lg border border-red-100 dark:border-red-500/20 w-fit mt-3">
                Impact: Reputation Hit
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="solution" className="py-24 px-6 lg:px-12 bg-gray-50/50 dark:bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 mb-6">
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Smart Notification Engine</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="block text-gray-900 dark:text-white">It does not just notify.</span>
            <span className="block text-gradient mt-2">It ensures delivery.</span>
          </h2>

          <p className="text-gray-500 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
            NotifyAI uses intelligent bandit learning and AI priority detection to rank your critical alerts across
            Gmail, Calendar, WhatsApp, and SMS until they are seen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-8 text-center hover:-translate-y-1 transition-transform">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-center mb-2">Custom Logic</h3>
              <p className="text-center text-gray-500 dark:text-gray-400">
                Set specific priority weights per app. Gmail can outrank Instagram every time, automatically.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-8 text-center hover:-translate-y-1 transition-transform">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-center mb-2">Omnichannel Routing</h3>
              <p className="text-center text-gray-500 dark:text-gray-400">
                Push, Gmail, Calendar, WhatsApp, and SMS supported perfectly out of the box.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-8 text-center hover:-translate-y-1 transition-transform">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-center mb-2">AI Prioritization</h3>
              <p className="text-center text-gray-500 dark:text-gray-400">
                Our bandit engine reads your behavior and automatically ranks "Meeting in 5 mins" over "Promo Sale".
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="py-24 px-6 lg:px-12 bg-white dark:bg-[#050505]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 text-center">
            Who is NotifyAI For?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-16 text-center max-w-2xl mx-auto">
            Built for anyone whose time matters. If it is important, it finds you.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-transform">
              <div className="bg-indigo-100 dark:bg-indigo-500/10 rounded-xl p-3 w-fit mb-4">
                <GraduationCap className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Students</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Critical assignment deadlines, sudden campus emergencies, or exam schedule changes.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-transform">
              <div className="bg-cyan-100 dark:bg-cyan-500/10 rounded-xl p-3 w-fit mb-4">
                <Code className="w-6 h-6 text-cyan-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Developers</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Build failures, deployment alerts, and P0 incidents that escalate automatically when ignored.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-transform">
              <div className="bg-green-100 dark:bg-green-500/10 rounded-xl p-3 w-fit mb-4">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Finance</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Fraud detection alerts, extreme margin calls, or huge transaction confirmations.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-transform">
              <div className="bg-purple-100 dark:bg-purple-500/10 rounded-xl p-3 w-fit mb-4">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Everyone</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Weather warnings, local emergencies, and anything critical that you cannot afford to miss.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 lg:px-12 flex flex-col items-center text-center bg-gradient-to-br from-indigo-50 to-cyan-50/30 dark:from-indigo-950/30 dark:to-cyan-950/20 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="glass-card rounded-3xl p-12 md:p-16 max-w-3xl w-full mx-auto relative overflow-hidden">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
            Start Never Missing Again.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
            If it is important, it finds you. Join NotifyAI for intelligent notification prioritization.
          </p>

          <div className="flex gap-4 flex-wrap justify-center">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="px-8 py-4 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-95 transition-transform shadow-[0_0_30px_rgba(79,70,229,0.3)] flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Get Started Free
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-8 py-4 rounded-full border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-gray-700 dark:text-gray-300 font-semibold hover:border-indigo-500 hover:text-indigo-600 transition-colors"
            >
              View Dashboard
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 dark:border-white/5 py-8 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center text-gray-900 dark:text-white font-bold">
          <span className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center mr-2 text-white text-xs font-bold">
            E
          </span>
          NotifyAI
        </div>

        <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
          <a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Contact
          </a>
        </div>

        <div className="text-sm text-gray-400 dark:text-gray-500">© 2026 Team Malnad. All rights reserved.</div>
      </footer>
    </div>
  );
}
