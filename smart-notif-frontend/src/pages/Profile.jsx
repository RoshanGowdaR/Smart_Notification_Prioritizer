import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  }, [username, email, userId, setUser]);

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
    <div className="shell">
      <Navbar />

      <main className="section-wrap flex justify-center py-10">
        <section className="panel w-full max-w-2xl p-6 sm:p-8">
          <p className="kicker">Account</p>
          <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.04em] text-[#102447]">Profile</h1>
          <p className="mt-1 text-sm text-[#4f648c]">Manage your identity and contact details used by NotifyAI automation.</p>

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5f789f]">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-[#c6d7ef] bg-white px-3 py-2 text-[#193a6a] outline-none transition focus:border-[#0B3D91]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5f789f]">Email</span>
              <input
                type="email"
                value={emailValue}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-[#d7e3f5] bg-[#f2f6fc] px-3 py-2 text-[#7a8eaf] outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5f789f]">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-[#c6d7ef] bg-white px-3 py-2 text-[#193a6a] outline-none transition focus:border-[#0B3D91]"
              />
            </label>
          </div>

          {saveMessage && (
            <p className="mt-4 rounded-xl border border-[#c7d8f2] bg-[#eef5ff] px-3 py-2 text-sm font-medium text-[#1f4f96]">
              {saveMessage}
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="btn-ink h-11 w-full disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-11 w-full rounded-xl border border-[#f1c3c1] bg-[#fff4f4] px-4 text-sm font-semibold text-[#b4302b] transition hover:bg-[#ffe8e8] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>

          <p className="mt-6 text-xs uppercase tracking-[0.08em] text-[#6881a7]">User ID: {userId || "test-user-001"}</p>
        </section>
      </main>
    </div>
  );
}
