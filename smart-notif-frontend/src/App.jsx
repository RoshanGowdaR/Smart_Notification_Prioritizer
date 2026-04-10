import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { useUser, UserProvider } from "./context/UserContext";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Personalize from "./pages/Personalize";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }) {
  const { user_id: userId } = useUser();
  if (!userId) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/personalize"
        element={
          <ProtectedRoute>
            <Personalize />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </UserProvider>
  );
}
