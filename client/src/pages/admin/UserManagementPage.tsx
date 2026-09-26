import { useCallback, useEffect, useState } from "react";
import { ApiError, listAdminUsers, type AdminUser } from "../../api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { UserList } from "../../components/admin/UserList";
import { UserFormDrawer, type UserDrawerMode } from "../../components/admin/UserFormDrawer";

interface DrawerState {
  mode: UserDrawerMode;
  user: AdminUser | null;
}

/**
 * Minimalist Administrator User Management (ui-spec.md §7, FR-10/FR-11/FR-12).
 * List + search by name/email + one optional role filter. No pagination,
 * multi-sort, or multi-filter per handout §8.5. Create/edit share one form;
 * Set New Password is a distinct action so a name typo fix never resets a
 * password by accident.
 */
export function UserManagementPage() {
  const currentUser = useCurrentUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const rows = await listAdminUsers({ search, role: roleFilter });
      setUsers(rows);
    } catch (loadError) {
      if (loadError instanceof ApiError) {
        setError(loadError.message);
        setErrorCode(loadError.code);
      } else {
        setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
        setErrorCode(null);
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, retryToken]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("");
  };

  const handleSaved = (saved: AdminUser, message: string) => {
    setDrawer(null);
    setNotice(message);
    // Refresh the list so the saved row is visible immediately.
    setUsers((current) => {
      const exists = current.some((row) => row.id === saved.id);
      if (!exists) return [...current, saved];
      return current.map((row) => (row.id === saved.id ? saved : row));
    });
    // Re-fetch in the background to keep ordering/filtering truthful.
    void listAdminUsers({ search, role: roleFilter })
      .then((rows) => setUsers(rows))
      .catch(() => undefined);
  };

  if (loading) {
    return (
      <div className="page-card">
        <h1 className="page-title">User Management</h1>
        <div className="loading-state" role="status">
          Loading users…
        </div>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="ticket-list-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p>
            {users.length} user{users.length === 1 ? "" : "s"} shown. Search by name or email; filter by one role.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="primary-button" onClick={() => { setNotice(null); setDrawer({ mode: "create", user: null }); }}>
            Create User
          </button>
        </div>
      </div>

      <div className="filters-row filters-row--open">
        <input
          aria-label="Search users"
          className="input-field"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name or email"
        />
        <select
          aria-label="Role filter"
          className="select-field"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="">All Roles</option>
          <option value="REQUESTER">Requester</option>
          <option value="IT_STAFF">IT Staff</option>
          <option value="ADMINISTRATOR">Administrator</option>
        </select>
      </div>

      {notice ? (
        <div className="success-panel success-panel--inline" role="status">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="error-panel" role="alert">
          <strong>{errorCode === "FORBIDDEN" ? "Not allowed." : "Unable to load users."}</strong>
          <p>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setLoading(true);
              setRetryToken((token) => token + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          {search !== "" || roleFilter !== "" ? (
            <>
              <p>No users match your search.</p>
              <button type="button" className="secondary-button" onClick={clearFilters}>
                Clear Filters
              </button>
            </>
          ) : (
            <p>No users yet.</p>
          )}
        </div>
      ) : (
        <UserList
          users={users}
          currentUserId={currentUser?.id ?? -1}
          onEdit={(selected) => {
            setNotice(null);
            setDrawer({ mode: "edit", user: selected });
          }}
          onResetPassword={(selected) => {
            setNotice(null);
            setDrawer({ mode: "reset", user: selected });
          }}
        />
      )}

      {drawer ? (
        <UserFormDrawer
          mode={drawer.mode}
          user={drawer.user}
          currentUserId={currentUser?.id ?? -1}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

export default UserManagementPage;
