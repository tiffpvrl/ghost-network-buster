import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Redirects /app to the workspace matching the current user's role.
 * Used as the index element under /app.
 */
export default function RoleGate() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "employer" ? "/app/employer" : "/app/patient"} replace />;
}
