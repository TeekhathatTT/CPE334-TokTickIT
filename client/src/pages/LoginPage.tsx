import { useState } from "react";
import { login } from "../api";

export function LoginPage({ onSuccess }: { onSuccess: (user: Awaited<ReturnType<typeof login>>["user"]) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setBusy(true); setError(null);
    try { onSuccess((await login(email, password)).user); } catch { setError("Invalid email or password."); } finally { setBusy(false); }
  };
  return <div className="selection-page"><form className="selection-card" onSubmit={submit} noValidate><h1 className="selection-card__title">Sign in to TokTickIT</h1><p className="selection-card__subtitle">Use your TokTickIT account to continue.</p>{error && <div className="error-panel" role="alert">{error}</div>}<div className="form-row"><label className="field-label" htmlFor="login-email">Email</label><input id="login-email" className="input-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></div><div className="form-row"><label className="field-label" htmlFor="login-password">Password</label><input id="login-password" className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div><button className="primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form></div>;
}
