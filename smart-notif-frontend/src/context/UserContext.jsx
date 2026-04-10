import { createContext, useContext, useMemo, useState } from "react";

const USER_STORAGE_KEY = "notifyai_user_id";
const USER_PROFILE_STORAGE_KEY = "notifyai_user_profile";

const UserContext = createContext(null);

export function UserProvider({ children }) {
	const storedProfile = (() => {
		try {
			const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
			return raw ? JSON.parse(raw) : {};
		} catch {
			return {};
		}
	})();

  const [user, setUserState] = useState(() => ({
    user_id: localStorage.getItem(USER_STORAGE_KEY) || "",
    username: storedProfile.username || "",
    email: storedProfile.email || "",
    phone: storedProfile.phone || "",
  }));

  const setUser = (nextUser) => {
    setUserState((prev) => {
      const merged = { ...prev, ...nextUser };
      if (merged.user_id) {
        localStorage.setItem(USER_STORAGE_KEY, merged.user_id);
      localStorage.setItem(
        USER_PROFILE_STORAGE_KEY,
        JSON.stringify({
          username: merged.username || "",
          email: merged.email || "",
          phone: merged.phone || "",
        }),
      );
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
      }
      return merged;
    });
  };

  const value = useMemo(() => ({ ...user, setUser }), [user]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
