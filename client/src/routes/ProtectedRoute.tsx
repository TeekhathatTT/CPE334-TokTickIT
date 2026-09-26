import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { LoginPage } from "../pages/auth/LoginPage";
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage";

/**
 * Route guard (no router in this app — view state lives in App):
 * - still loading the session → neutral loading state,
 * - unauthenticated → Login,
 * - mustChangePassword → Change Password, regardless of requested view
 *   (FR-02: normal screens stay blocked until a valid password is saved),
 * - otherwise → the requested children.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <div className="page-card">
        <div className="loading-state" role="status">
          Loading session…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {error ? (
          <div className="error-panel" role="alert">
            {error}
            <button type="button" className="secondary-button" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : null}
        <LoginPage />
      </>
    );
  }

  if (user.mustChangePassword) {
    return <ChangePasswordPage />;
  }

  return <>{children}</>;
}
