import { useMemo, useState } from "react";
import { ApiError } from "../../api";
import { useAuth } from "../../hooks/useAuth";
import { changePassword as apiChangePassword } from "../../api";

interface Rule {
  key: string;
  label: string;
  satisfied: boolean;
}

function checklist(newPassword: string): Rule[] {
  return [
    { key: "length", label: "At least 8 characters", satisfied: newPassword.length >= 8 },
    { key: "upper", label: "An upper-case letter (A–Z)", satisfied: /[A-Z]/.test(newPassword) },
    { key: "lower", label: "A lower-case letter (a–z)", satisfied: /[a-z]/.test(newPassword) },
    { key: "number", label: "A number (0–9)", satisfied: /[0-9]/.test(newPassword) },
    { key: "special", label: "A special character (e.g. !@#$)", satisfied: /[^A-Za-z0-9]/.test(newPassword) },
  ];
}

/**
 * Mandatory password-change screen (ui-spec.md §3, FR-02): current/temporary
 * password, new password with a live rule checklist (text + icon, never
 * color alone), and confirmation. The surrounding ProtectedRoute blocks every
 * other screen until this succeeds.
 */
export function ChangePasswordPage() {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rules = useMemo(() => checklist(newPassword), [newPassword]);
  const allRulesSatisfied = rules.every((rule) => rule.satisfied);
  const matches = confirmPassword === "" || newPassword === confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (currentPassword === "") nextErrors.currentPassword = "Current password is required.";
    if (!allRulesSatisfied) nextErrors.newPassword = "New password does not meet all rules below.";
    if (confirmPassword === "") nextErrors.confirmPassword = "Password confirmation is required.";
    else if (newPassword !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      await apiChangePassword({ currentPassword, newPassword, confirmPassword });
      await refresh();
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.fields) {
        const fieldErrors: typeof errors = {};
        if (submitError.fields.currentPassword) fieldErrors.currentPassword = submitError.fields.currentPassword;
        if (submitError.fields.newPassword) fieldErrors.newPassword = submitError.fields.newPassword;
        if (submitError.fields.confirmPassword) fieldErrors.confirmPassword = submitError.fields.confirmPassword;
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length === 0) {
          setFailure(submitError.message);
        }
      } else if (submitError instanceof ApiError && submitError.status === 401) {
        setErrors((current) => ({ ...current, currentPassword: "Current password is incorrect." }));
      } else {
        setFailure(submitError instanceof Error ? submitError.message : "Unable to change password.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="selection-page">
      <div className="selection-card">
        <div className="selection-card__icon" aria-hidden="true">
          🔑
        </div>
        <h1 className="selection-card__title">Change your password</h1>
        <p className="selection-card__subtitle">
          Your account requires a new password before you can continue.
        </p>

        {failure ? (
          <div className="error-panel" role="alert">
            <strong>Unable to change password.</strong>
            <p>{failure}</p>
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="form-row">
            <label className="field-label" htmlFor="change-current">
              Current password <span aria-hidden="true">*</span>
            </label>
            <input
              id="change-current"
              className={`input-field ${errors.currentPassword ? "field-invalid" : ""}`}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              aria-invalid={Boolean(errors.currentPassword)}
              aria-describedby={errors.currentPassword ? "change-current-error" : undefined}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setErrors((current) => ({ ...current, currentPassword: undefined }));
              }}
            />
            {errors.currentPassword ? (
              <div id="change-current-error" className="field-error" role="alert">
                {errors.currentPassword}
              </div>
            ) : null}
          </div>

          <div className="form-row">
            <label className="field-label" htmlFor="change-new">
              New password <span aria-hidden="true">*</span>
            </label>
            <input
              id="change-new"
              className={`input-field ${errors.newPassword ? "field-invalid" : ""}`}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              aria-invalid={Boolean(errors.newPassword)}
              aria-describedby="password-rules change-new-error"
              onChange={(event) => {
                setNewPassword(event.target.value);
                setErrors((current) => ({ ...current, newPassword: undefined }));
              }}
            />
            <ul id="password-rules" className="password-checklist" aria-label="Password rules">
              {rules.map((rule) => (
                <li key={rule.key} className={rule.satisfied ? "password-checklist__item password-checklist__item--met" : "password-checklist__item"}>
                  <span aria-hidden="true">{rule.satisfied ? "✓" : "○"}</span> {rule.label}
                  <span className="password-checklist__state">{rule.satisfied ? " (met)" : " (not met)"}</span>
                </li>
              ))}
            </ul>
            {errors.newPassword ? (
              <div id="change-new-error" className="field-error" role="alert">
                {errors.newPassword}
              </div>
            ) : null}
          </div>

          <div className="form-row">
            <label className="field-label" htmlFor="change-confirm">
              Confirm new password <span aria-hidden="true">*</span>
            </label>
            <input
              id="change-confirm"
              className={`input-field ${errors.confirmPassword || !matches ? "field-invalid" : ""}`}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={Boolean(errors.confirmPassword) || !matches}
              aria-describedby={errors.confirmPassword ? "change-confirm-error" : undefined}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({ ...current, confirmPassword: undefined }));
              }}
            />
            {errors.confirmPassword ? (
              <div id="change-confirm-error" className="field-error" role="alert">
                {errors.confirmPassword}
              </div>
            ) : (!matches ? (
              <div className="field-error" role="alert">
                Passwords do not match.
              </div>
            ) : null)}
          </div>

          <div className="selection-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save new password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
