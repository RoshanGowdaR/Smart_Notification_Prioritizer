import { createContext, useCallback, useContext, useMemo, useState } from "react";

const USER_STORAGE_KEY = "notifyai_user_id";
const USER_PROFILE_STORAGE_KEY = "notifyai_user_profile";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getStoredUserId = () => {
  const raw = localStorage.getItem(USER_STORAGE_KEY) || "";
  return UUID_REGEX.test(raw) ? raw : "";
};

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
    user_id: getStoredUserId(),
    username: storedProfile.username || "",
    email: storedProfile.email || "",
    phone: storedProfile.phone || "",
  }));

  const setUser = useCallback((nextUser) => {
    setUserState((prev) => {
      const merged = { ...prev, ...nextUser };
      if (merged.user_id && UUID_REGEX.test(merged.user_id)) {
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
  }, []);

  const value = useMemo(() => ({ ...user, setUser }), [user, setUser]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
