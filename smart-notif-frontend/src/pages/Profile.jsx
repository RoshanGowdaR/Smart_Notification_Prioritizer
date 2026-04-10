import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";

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
    setName(username || "");
    setEmailValue(email || "");
    setPhone("");
  }, [username, email]);

  const handleSaveChanges = () => {
    setIsSaving(true);
    setSaveMessage("");

    window.setTimeout(() => {
      setUser({ username: name, email: emailValue });
      setSaveMessage("Saved!");
      setIsSaving(false);

      window.setTimeout(() => {
        setSaveMessage("");
      }, 3000);
    }, 500);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await client.post("/auth/logout", {});
    } catch (_error) {
      // Continue logout for demo even if API is unavailable.
    } finally {
      setUser({ user_id: "", username: "", email: "" });
      setIsLoggingOut(false);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />

      <main className="mx-auto flex max-w-5xl justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl shadow-black/30">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="mt-1 text-sm text-gray-300">Manage your account details for NotifyAI.</p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none ring-cyan-400 transition focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">Email</span>
              <input
                type="email"
                value={emailValue}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2 text-gray-300 outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none ring-cyan-400 transition focus:ring-2"
              />
            </label>
          </div>

          {saveMessage && (
            <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">
              {saveMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>

          <p className="mt-6 text-xs text-gray-500">User ID: {userId || "test-user-001"}</p>
        </section>
      </main>
    </div>
  );
}
