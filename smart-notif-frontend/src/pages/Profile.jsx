import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";

import client from "../api/client";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const { user_id: userId, username, email, setUser } = useUser();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setName(username || "");
      setEmailValue(email || "");

      if (!userId) {
        return;
      }

      try {
        const response = await client.get(`/users/${userId}`);
        const data = response?.data || {};
        if (!isMounted) {
          return;
        }
        setName(data.username || username || "");
        setEmailValue(data.email_id || email || "");
        setPhone(data.ph_num || "");
        setUser({
          username: data.username || username || "",
          email: data.email_id || email || "",
          phone: data.ph_num || "",
        });
      } catch (_error) {
        if (isMounted) {
          setPhone("");
        }
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [userId, setUser]);

  const initials = useMemo(() => {
    const source = (name || username || "U").trim();
    if (!source) {
      return "U";
    }
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join("");
  }, [name, username]);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      await client.post("/users/upsert", {
        user_id: userId,
        username: name,
        email_id: emailValue,
        ph_num: phone,
      });
      setUser({ username: name, email: emailValue, phone });
      setSaveMessage("Profile saved successfully.");

      window.setTimeout(() => {
        setSaveMessage("");
      }, 2500);
    } catch (_error) {
      setSaveMessage("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (_error) {
      // Continue logout flow even if upstream sign-out fails.
    } finally {
      setUser({ user_id: "", username: "", email: "", phone: "" });
      setIsLoggingOut(false);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] transition-colors duration-300">
      <Navbar />

      <main className="pt-28 px-6 lg:px-12 pb-12">
        <section className="glass-card rounded-2xl max-w-md mx-auto p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-4">
              {initials ? <span className="text-lg font-bold">{initials}</span> : <User className="w-6 h-6" />}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Manage your account details and contact preferences.</p>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none text-gray-900 dark:text-white w-full"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Email</span>
              <input
                type="email"
                value={emailValue}
                disabled
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none text-gray-500 dark:text-gray-400 w-full cursor-not-allowed"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none text-gray-900 dark:text-white w-full"
              />
            </label>
          </div>

          {saveMessage && (
            <p className="mt-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">
              {saveMessage}
            </p>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-lg shadow-indigo-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-6 py-3 rounded-full border border-danger text-danger hover:bg-danger/10 font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
