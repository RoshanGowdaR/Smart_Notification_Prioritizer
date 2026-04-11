import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

import ThemeToggle from "./ThemeToggle";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Personalize", to: "/personalize" },
  { label: "Analytics", to: "/analytics" },
  { label: "Profile", to: "/profile" },
];

export default function Navbar({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user_id: userId } = useUser();

  const linkClass = ({ isActive }) =>
    [
      "transition-colors text-sm font-medium",
      isActive
        ? "text-gray-900 dark:text-white font-semibold"
        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white",
    ].join(" ");

  const handleSignIn = () => {
    if (typeof onLogout === "function") {
      onLogout();
    }
  };

  return (
    <nav className="fixed w-full z-50 glass border-b py-4 px-6 lg:px-12 flex justify-between items-center top-0">
      <div className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">NotifyAI</div>

      <div className="hidden md:flex items-center gap-8">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-4">
        <ThemeToggle />
        {!userId && (
          <>
            <button
              type="button"
              onClick={handleSignIn}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition-colors shadow-lg shadow-indigo-500/30 dark:shadow-none"
            >
              Open App
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="md:hidden text-gray-700 dark:text-gray-200 text-xl"
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      {menuOpen && (
        <div className="absolute top-full left-0 w-full md:hidden glass border-t border-gray-100 dark:border-white/10 px-6 py-4">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between pt-2">
              <ThemeToggle />
              {!userId && (
                <>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/dashboard");
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition-colors"
                  >
                    Open App
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
