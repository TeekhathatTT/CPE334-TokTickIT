import { useState } from "react";
import { ApiError } from "../../api";
import { useAuth } from "../../hooks/useAuth";

/**
 * Login screen (ui-spec.md §3): focused Zen Green form with labelled Email
 * and Password fields, inline validation, disabled busy submit, and a safe
 * generic failure message (inactive accounts get the same non-enumerating
 * failure as wrong credentials).
 */
export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};
    if (email.trim() === "") nextErrors.email = "Email is required.";
    if (password === "") nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await login(email.trim(), password);
    } catch (submitError) {
      // Safe message: never reveal whether the email exists or is inactive.
      if (submitError instanceof ApiError && (submitError.status === 401 || submitError.status === 400)) {
        setFailure("Invalid email or password.");
      } else {
        setFailure(submitError instanceof Error ? submitError.message : "Unable to log in.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="selection-page">
      <div className="selection-card">
        <div className="selection-card__icon" aria-hidden="true">
          🔐
        </div>
        <h1 className="selection-card__title">Log in to TokTickIT</h1>
        <p className="selection-card__subtitle">Use your TokTickIT account to continue.</p>

        {failure ? (
          <div className="error-panel" role="alert">
            <strong>Unable to log in.</strong>
            <p>{failure}</p>
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="form-row">
            <label className="field-label" htmlFor="login-email">
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="login-email"
              className={`input-field ${errors.email ? "field-invalid" : ""}`}
              type="email"
              autoComplete="username"
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
            />
            {errors.email ? (
              <div id="login-email-error" className="field-error" role="alert">
                {errors.email}
              </div>
            ) : null}
          </div>

          <div className="form-row">
            <label className="field-label" htmlFor="login-password">
              Password <span aria-hidden="true">*</span>
            </label>
            <input
              id="login-password"
              className={`input-field ${errors.password ? "field-invalid" : ""}`}
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
            />
            {errors.password ? (
              <div id="login-password-error" className="field-error" role="alert">
                {errors.password}
              </div>
            ) : null}
          </div>

          <div className="selection-actions">
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
