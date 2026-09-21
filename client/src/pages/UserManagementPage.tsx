import { useEffect, useState } from "react";
import { createUser, getUsers, setInitialPassword, updateUser, type ManagedUser, type UserRole } from "../api";

const roles: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const blank = { name: "", email: "", role: "REQUESTER" as UserRole, isActive: true, initialPassword: "" };
const passwordHelp = "Use 8+ characters with upper/lower case, a number, and a special character.";

export default function UserManagementPage({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [resetFor, setResetFor] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);
  const [statusError, setStatusError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await getUsers({ search: search || undefined, role: role || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [search, role]);

  const openCreate = () => { setEditing(null); setForm(blank); setError(""); };
  const openEdit = (user: ManagedUser) => { setEditing(user); setForm({ name: user.name, email: user.email, role: user.role, isActive: user.isActive, initialPassword: "" }); setError(""); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) await updateUser(editing.id, { name: form.name, email: form.email, role: form.role, isActive: form.isActive });
      else await createUser(form);
      setNotice(editing ? "User updated." : "User created. They must change their password at next login.");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  // Section 25 (deactivation confirmation) — a themed Zen Green dialog that
  // clearly identifies the target user and, if the backend rejects the
  // operation (self-deactivation or last-active-Administrator), surfaces the
  // exact reason instead of a generic failure message.
  const openStatusConfirm = (user: ManagedUser) => { setStatusTarget(user); setStatusError(""); };
  const closeStatusConfirm = () => { setStatusTarget(null); setStatusError(""); };
  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      await updateUser(statusTarget.id, { isActive: !statusTarget.isActive });
      setNotice(`${statusTarget.name} is now ${statusTarget.isActive ? "inactive" : "active"}.`);
      setStatusTarget(null);
      await load();
    } catch (e) {
      // Keep the dialog open and show the specific backend reason
      // (e.g. "Administrators cannot deactivate their own account." or
      // "At least one active Administrator must remain.") rather than
      // bouncing the admin back to a generic page-level error banner.
      setStatusError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetFor) return;
    setSaving(true);
    setError("");
    try {
      await setInitialPassword(resetFor.id, newPassword);
      setNotice(`A new initial password was set for ${resetFor.name}.`);
      setResetFor(null);
      setNewPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reset password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-card user-management">
      <div className="ticket-list-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="helper-text">Create and maintain user access.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>Create user</button>
      </div>

      {notice && <div className="success-panel" role="status">{notice}</div>}
      {error && <div className="error-panel" role="alert"><strong>Unable to complete that action</strong><p>{error}</p></div>}

      <div className="filters-row">
        <div>
          <label className="field-label" htmlFor="user-search">Search users</label>
          <input id="user-search" className="input-field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
        </div>
        <div>
          <label className="field-label" htmlFor="user-role">Role</label>
          <select id="user-role" className="select-field" value={role} onChange={(e) => setRole(e.target.value as UserRole | "")}>
            <option value="">All roles</option>
            {roles.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state" role="status">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="empty-state">{search || role ? "No users match the current search or role filter." : "There are no users in the system."}</div>
      ) : (
        <>
          <div className="ticket-table-wrap">
            <table className="ticket-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span className="badge badge--open">{user.role}</span></td>
                    <td><span className={`badge ${user.isActive ? "badge--resolved" : "badge--pending"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="header-actions">
                      <button className="link-button" onClick={() => openEdit(user)}>Edit</button>
                      <button className="link-button" onClick={() => { setResetFor(user); setNewPassword(""); }}>Set initial password</button>
                      <button
                        className={user.isActive ? "destructive-button" : "secondary-button"}
                        disabled={user.id === currentUserId && user.isActive}
                        title={user.id === currentUserId && user.isActive ? "You cannot deactivate your own account." : undefined}
                        onClick={() => openStatusConfirm(user)}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ticket-cards">
            {users.map((user) => (
              <article className="ticket-card" key={user.id}>
                <div className="ticket-card__header">
                  <strong>{user.name}</strong>
                  <span className={`badge ${user.isActive ? "badge--resolved" : "badge--pending"}`}>{user.isActive ? "Active" : "Inactive"}</span>
                </div>
                <p>{user.email}</p>
                <p><span className="badge badge--open">{user.role}</span></p>
                <div className="header-actions">
                  <button className="link-button" onClick={() => openEdit(user)}>Edit</button>
                  <button className="link-button" onClick={() => { setResetFor(user); setNewPassword(""); }}>Set initial password</button>
                  <button
                    className={user.isActive ? "destructive-button" : "secondary-button"}
                    disabled={user.id === currentUserId && user.isActive}
                    onClick={() => openStatusConfirm(user)}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="dialog-actions"><button className="secondary-button" onClick={openCreate}>New user form</button></div>

      <form className="page-card user-form" onSubmit={submit} aria-label={editing ? "Edit user" : "Create user"}>
        <h2>{editing ? `Edit ${editing.name}` : "Create user"}</h2>
        <div className="ticket-grid ticket-grid--three">
          <label className="form-row" htmlFor="managed-name"><span className="field-label">Name</span><input id="managed-name" className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="form-row" htmlFor="managed-email"><span className="field-label">Email</span><input id="managed-email" className="input-field" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="form-row" htmlFor="managed-role"><span className="field-label">Role</span><select id="managed-role" className="select-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>{roles.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active account</label>
        {!editing && (
          <label className="form-row" htmlFor="managed-initial-password">
            <span className="field-label">Initial password</span>
            <input id="managed-initial-password" className="input-field" required type="password" value={form.initialPassword} onChange={(e) => setForm({ ...form, initialPassword: e.target.value })} />
            <span className="helper-text">{passwordHelp}</span>
          </label>
        )}
        <div className="ticket-actions">
          <button type="button" className="secondary-button" onClick={openCreate}>Reset</button>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save user"}</button>
        </div>
      </form>

      {resetFor && (
        <div className="modal-backdrop">
          <form className="confirmation-dialog" onSubmit={submitPassword}>
            <h2>Set new initial password</h2>
            <p>{resetFor.name} will be required to change this password at next login.</p>
            <label className="field-label" htmlFor="reset-password">New initial password</label>
            <input id="reset-password" className="input-field" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="helper-text">{passwordHelp}</p>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setResetFor(null)}>Cancel</button>
              <button className="primary-button" disabled={saving}>Set password</button>
            </div>
          </form>
        </div>
      )}

      {statusTarget && (
        <div className="modal-backdrop">
          <div className="confirmation-dialog" role="alertdialog" aria-labelledby="status-dialog-title">
            <h2 id="status-dialog-title">{statusTarget.isActive ? "Deactivate User?" : "Activate User?"}</h2>
            <p><strong>Name:</strong> {statusTarget.name}<br /><strong>Email:</strong> {statusTarget.email}</p>
            {statusTarget.isActive && (
              <p className="helper-text">Deactivation does not delete the account. Tickets, comments, and notes already authored by this user are preserved.</p>
            )}
            {statusError && <div className="error-panel" role="alert"><strong>Unable to complete that action</strong><p>{statusError}</p></div>}
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={closeStatusConfirm}>Cancel</button>
              <button
                type="button"
                className={statusTarget.isActive ? "destructive-button" : "primary-button"}
                disabled={statusSaving}
                onClick={() => void confirmStatusChange()}
              >
                {statusSaving ? "Saving…" : statusTarget.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
