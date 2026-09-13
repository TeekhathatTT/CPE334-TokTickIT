import { useState } from "react";
import { changePassword } from "../api";

export function ChangePasswordPage({ onSuccess }: { onSuccess: (user: Awaited<ReturnType<typeof changePassword>>["user"]) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!valid || newPassword !== confirmPassword) { setError("Use at least 8 characters with upper and lower case letters, a number, and a special character. Passwords must match."); return; } setBusy(true); setError(null); try { onSuccess((await changePassword({ currentPassword, newPassword, confirmPassword })).user); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to change password."); } finally { setBusy(false); } };
  return <div className="selection-page"><form className="selection-card" onSubmit={submit} noValidate><h1 className="selection-card__title">Change your password</h1><p className="selection-card__subtitle">A new password is required before you can continue.</p>{error && <div className="error-panel" role="alert">{error}</div>}<div className="form-row"><label className="field-label" htmlFor="current-password">Current or temporary password</label><input id="current-password" className="input-field" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div><div className="form-row"><label className="field-label" htmlFor="new-password">New password</label><input id="new-password" className="input-field" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><div className="helper-text">At least 8 characters, upper and lower case, a number, and a special character.</div></div><div className="form-row"><label className="field-label" htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" className="input-field" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button></form></div>;
}
