import { useMemo, useState } from "react";
import {
  ApiError,
  createAdminUser,
  setAdminInitialPassword,
  updateAdminUser,
  type AdminUser,
  type UserRole,
} from "../../api";

export type UserDrawerMode = "create" | "edit" | "reset";

interface UserFormDrawerProps {
  mode: UserDrawerMode;
  user?: AdminUser | null;
  currentUserId: number;
  onClose: () => void;
  onSaved: (user: AdminUser, message: string) => void;
}

const ROLES: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordRules(password: string) {
  return [
    { key: "length", label: "At least 8 characters", satisfied: password.length >= 8 },
    { key: "upper", label: "An upper-case letter (A–Z)", satisfied: /[A-Z]/.test(password) },
    { key: "lower", label: "A lower-case letter (a–z)", satisfied: /[a-z]/.test(password) },
    { key: "number", label: "A number (0–9)", satisfied: /[0-9]/.test(password) },
    { key: "special", label: "A special character (e.g. !@#$)", satisfied: /[^A-Za-z0-9]/.test(password) },
  ];
}

function titleFor(mode: UserDrawerMode, user?: AdminUser | null): string {
  if (mode === "create") return "Create User";
  if (mode === "reset") return `Set New Password${user ? ` for ${user.name}` : ""}`;
  return `Edit User${user ? ` — ${user.name}` : ""}`;
}

/**
 * Create/edit drawer + distinct Set New Password action (ui-spec.md §7).
 * The password reset is a separate mode so an admin cannot accidentally
 * reset a password while fixing a typo in someone's name. Client validation
 * mirrors the backend but never replaces it.
 */
export function UserFormDrawer({ mode, user, currentUserId, onClose, onSaved }: UserFormDrawerProps) {
  const isEdit = mode === "edit";
  const isCreate = mode === "create";
  const isReset = mode === "reset";
  const isSelf = isEdit && user ? user.id === currentUserId : false;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "REQUESTER");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [initialPassword, setInitialPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rules = useMemo(() => passwordRules(initialPassword), [initialPassword]);
  const allRulesSatisfied = rules.every((rule) => rule.satisfied);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (isCreate || isEdit) {
      if (name.trim() === "") nextErrors.name = "Name is required.";
      else if (name.trim().length > 120) nextErrors.name = "Name must be 120 characters or fewer.";
      if (email.trim() === "") nextErrors.email = "Email is required.";
      else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = "Email must be a valid email address.";
      if (!ROLES.includes(role)) nextErrors.role = "Role must be one of REQUESTER, IT Staff, Administrator.";
    }

    if (isCreate || isReset) {
      if (initialPassword === "") nextErrors.initialPassword = "Initial password is required.";
      else if (!allRulesSatisfied) nextErrors.initialPassword = "Initial password does not meet all rules below.";
      if (isReset && confirmPassword === "") nextErrors.confirmPassword = "Password confirmation is required.";
      else if (isReset && initialPassword !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      if (isCreate) {
        const created = await createAdminUser({
          name: name.trim(),
          email: email.trim(),
          role,
          isActive,
          initialPassword,
        });
        onSaved(created, `User ${created.name} created. They must change their password at next login.`);
      } else if (isEdit && user) {
        const updated = await updateAdminUser(user.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          isActive,
        });
        onSaved(updated, `User ${updated.name} updated.`);
      } else if (isReset && user) {
        const updated = await setAdminInitialPassword(user.id, initialPassword);
        onSaved(updated, `New initial password set for ${updated.name}. They must change it at next login.`);
      }
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.fields) {
        setErrors(submitError.fields);
        // Surface conflict/validation messages that don't map to a field.
        const fieldKeys = new Set(["name", "email", "role", "isActive", "initialPassword", "confirmPassword"]);
        const unmapped = Object.entries(submitError.fields).filter(([key]) => !fieldKeys.has(key));
        if (unmapped.length > 0 || Object.keys(submitError.fields).length === 0) {
          setFailure(submitError.message);
        } else if (submitError.status === 409 || submitError.status === 403) {
          // Field-mapped conflicts still deserve an alert-level summary.
          setFailure(submitError.message);
        }
      } else {
        setFailure(submitError instanceof Error ? submitError.message : "Unable to save changes.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={titleFor(mode, user)}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="page-title">{titleFor(mode, user)}</h2>

        {failure ? (
          <div className="error-panel" role="alert">
            <strong>Unable to save.</strong>
            <p>{failure}</p>
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          {isCreate || isEdit ? (
            <>
              <div className="form-row">
                <label className="field-label" htmlFor="user-name">
                  Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="user-name"
                  className={`input-field ${errors.name ? "field-invalid" : ""}`}
                  value={name}
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "user-name-error" : undefined}
                  onChange={(event) => {
                    setName(event.target.value);
                    setErrors((current) => ({ ...current, name: "" }));
                  }}
                />
                {errors.name ? (
                  <div id="user-name-error" className="field-error" role="alert">
                    {errors.name}
                  </div>
                ) : null}
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="user-email">
                  Email <span aria-hidden="true">*</span>
                </label>
                <input
                  id="user-email"
                  className={`input-field ${errors.email ? "field-invalid" : ""}`}
                  type="email"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "user-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((current) => ({ ...current, email: "" }));
                  }}
                />
                {errors.email ? (
                  <div id="user-email-error" className="field-error" role="alert">
                    {errors.email}
                  </div>
                ) : null}
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="user-role">
                  Role <span aria-hidden="true">*</span>
                </label>
                <select
                  id="user-role"
                  className={`select-field ${errors.role ? "field-invalid" : ""}`}
                  value={role}
                  aria-invalid={Boolean(errors.role)}
                  aria-describedby={errors.role ? "user-role-error" : undefined}
                  onChange={(event) => {
                    setRole(event.target.value as UserRole);
                    setErrors((current) => ({ ...current, role: "" }));
                  }}
                >
                  <option value="REQUESTER">Requester</option>
                  <option value="IT_STAFF">IT Staff</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                </select>
                {errors.role ? (
                  <div id="user-role-error" className="field-error" role="alert">
                    {errors.role}
                  </div>
                ) : null}
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="user-active">
                  <input
                    id="user-active"
                    type="checkbox"
                    checked={isActive}
                    disabled={isSelf}
                    aria-describedby={isSelf ? "user-active-help" : errors.isActive ? "user-active-error" : undefined}
                    onChange={(event) => {
                      setIsActive(event.target.checked);
                      setErrors((current) => ({ ...current, isActive: "" }));
                    }}
                  />{" "}
                  Active
                </label>
                {isSelf ? (
                  <p id="user-active-help" className="helper-text helper-text--muted">
                    You cannot deactivate your own account.
                  </p>
                ) : null}
                {errors.isActive ? (
                  <div id="user-active-error" className="field-error" role="alert">
                    {errors.isActive}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {isCreate || isReset ? (
            <>
              <div className="form-row">
                <label className="field-label" htmlFor="user-password">
                  {isCreate ? "Initial password" : "New initial password"} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="user-password"
                  className={`input-field ${errors.initialPassword ? "field-invalid" : ""}`}
                  type="password"
                  autoComplete="new-password"
                  value={initialPassword}
                  autoFocus={isReset}
                  aria-invalid={Boolean(errors.initialPassword)}
                  aria-describedby="user-password-rules user-password-error"
                  onChange={(event) => {
                    setInitialPassword(event.target.value);
                    setErrors((current) => ({ ...current, initialPassword: "" }));
                  }}
                />
                <ul id="user-password-rules" className="password-checklist" aria-label="Password rules">
                  {rules.map((rule) => (
                    <li
                      key={rule.key}
                      className={rule.satisfied ? "password-checklist__item password-checklist__item--met" : "password-checklist__item"}
                    >
                      <span aria-hidden="true">{rule.satisfied ? "✓" : "○"}</span> {rule.label}
                      <span className="password-checklist__state">{rule.satisfied ? " (met)" : " (not met)"}</span>
                    </li>
                  ))}
                </ul>
                <p className="helper-text helper-text--muted">
                  The user must change this password at next login. It is never emailed.
                </p>
                {errors.initialPassword ? (
                  <div id="user-password-error" className="field-error" role="alert">
                    {errors.initialPassword}
                  </div>
                ) : null}
              </div>

              {isReset ? (
                <div className="form-row">
                  <label className="field-label" htmlFor="user-password-confirm">
                    Confirm new password <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="user-password-confirm"
                    className={`input-field ${errors.confirmPassword ? "field-invalid" : ""}`}
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "user-password-confirm-error" : undefined}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setErrors((current) => ({ ...current, confirmPassword: "" }));
                    }}
                  />
                  {errors.confirmPassword ? (
                    <div id="user-password-confirm-error" className="field-error" role="alert">
                      {errors.confirmPassword}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {isEdit ? (
            <p className="helper-text helper-text--muted">
              Password changes use the separate Set Password action — saving here never resets the password.
            </p>
          ) : null}

          <div className="dialog-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving…" : isCreate ? "Create User" : isReset ? "Set New Password" : "Save Changes"}
            </button>
            <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
