import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useUser } from "../context/UserContext";

const GOOGLE_PROVIDER_TOKEN_KEY = "notifyai_google_provider_token";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Personalize", to: "/personalize" },
  { label: "Analytics", to: "/analytics" },
  { label: "Profile", to: "/profile" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (_error) {
      // Allow local logout even if upstream sign-out fails.
    } finally {
      setUser({ user_id: "", username: "", email: "" });
      localStorage.removeItem(GOOGLE_PROVIDER_TOKEN_KEY);
      setMenuOpen(false);
      setIsLoggingOut(false);
      navigate("/");
    }
  };

  const navLinkClassName = ({ isActive }) =>
    [
      "inline-flex h-16 items-center border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.12em] transition-colors",
      isActive
        ? "border-[#4f46e5] text-[#3f37c9]"
        : "border-transparent text-[#5b6f95] hover:text-[#3f37c9]",
    ].join(" ");

  return (
    <header className="sticky top-0 z-50 h-16 glass text-[#102345]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#06b6d4] text-sm font-black text-white shadow-lg shadow-indigo-500/20">
            N
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6a7ca3]">NotifyAI</p>
            <p className="text-sm font-bold uppercase tracking-[0.09em] text-[#14203b]">Priority Engine</p>
          </div>
        </div>

        <nav className="hidden h-full items-center gap-6 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClassName}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="btn-ghost disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#c6d4ee] bg-white/70 text-xl font-semibold text-[#2f4570] md:hidden"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-[#d7e2f5] bg-white/90 px-4 pb-4 md:hidden">
          <nav className="mt-2 grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "border-b border-[#e6edf8] py-3 text-sm font-semibold uppercase tracking-[0.12em] transition-colors",
                    isActive ? "text-[#4f46e5]" : "text-[#5B6F95] hover:text-[#4f46e5]",
                  ].join(" ")
                }
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="btn-ghost mt-3 w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
