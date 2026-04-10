import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import client from "../api/client";
import { useUser } from "../context/UserContext";

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
      await client.post("/auth/logout", {});
    } catch (_error) {
      // Allow local logout even if backend logout fails.
    } finally {
      setUser({ user_id: "", username: "", email: "" });
      setMenuOpen(false);
      setIsLoggingOut(false);
      navigate("/");
    }
  };

  const navLinkClassName = ({ isActive }) =>
    [
      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-cyan-500/20 text-cyan-300"
        : "text-gray-300 hover:bg-gray-700 hover:text-white",
    ].join(" ");

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="text-xl font-bold tracking-tight text-cyan-300">NotifyAI</div>

        <nav className="hidden items-center gap-2 md:flex">
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
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-gray-200 hover:bg-gray-800 md:hidden"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1.5 block h-0.5 w-5 bg-current" />
          <span className="mt-1.5 block h-0.5 w-5 bg-current" />
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 pb-4 md:hidden">
          <nav className="mt-3 grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navLinkClassName}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-2 rounded-md bg-red-600 px-3 py-2 text-left text-sm font-medium transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
