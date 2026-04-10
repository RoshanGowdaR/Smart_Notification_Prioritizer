import { createContext, useContext, useMemo, useState } from "react";

const USER_STORAGE_KEY = "notifyai_user_id";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(() => ({
    user_id: localStorage.getItem(USER_STORAGE_KEY) || "",
    username: "",
    email: "",
  }));

  const setUser = (nextUser) => {
    setUserState((prev) => {
      const merged = { ...prev, ...nextUser };
      if (merged.user_id) {
        localStorage.setItem(USER_STORAGE_KEY, merged.user_id);
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
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
