import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Wraps protected route trees. Redirects unauthenticated users to /login,
 * preserving the originally requested path in `?next=` for post-login return.
 */
export default function RequireAuth() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) {
    const next = encodeURIComponent(`${loc.pathname}${loc.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
