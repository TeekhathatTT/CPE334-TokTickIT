import { useEffect, useRef, useState } from "react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const hasLoadedOnce = useRef(false);

  // Debounce free-text search so every keystroke does not fire a request.
  // The input stays controlled by `search` (immediate) while fetching uses
  // `debouncedSearch`, so focus is never lost while typing.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const isFirstLoad = !hasLoadedOnce.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    setErrorCode(null);
    listAdminUsers({ search: debouncedSearch, role: roleFilter })
      .then((rows) => {
        if (!active) return;
        setUsers(rows);
        hasLoadedOnce.current = true;
      })
      .catch((loadError) => {
        if (!active) return;
        if (loadError instanceof ApiError) {
          setError(loadError.message);
          setErrorCode(loadError.code);
        } else {
          setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
          setErrorCode(null);
        }
        setUsers([]);
        hasLoadedOnce.current = true;
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    // Stale responses are ignored via `active` so an older query can never
    // overwrite newer results.
    return () => {
      active = false;
    };
  }, [debouncedSearch, roleFilter, retryToken]);

  const clearFilters = () => {
    setSearch("");
    // Clear immediately so "Clear Filters" does not wait for the debounce.
    setDebouncedSearch("");
    setRoleFilter("");
  };

  const handleSaved = (saved: AdminUser, message: string) => {
    setDrawer(null);
    setNotice(message);
    // Optimistic update so the saved row is visible immediately; the
    // canonical reload below keeps ordering/filtering truthful without a
    // second competing fetch that could race the main effect.
    setUsers((current) => {
      const exists = current.some((row) => row.id === saved.id);
      if (!exists) return [...current, saved];
      return current.map((row) => (row.id === saved.id ? saved : row));
    });
    setRetryToken((token) => token + 1);
  };

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
        {refreshing ? (
          <span className="helper-text" role="status" aria-live="polite">
            Updating…
          </span>
        ) : null}
      </div>

      {notice ? (
        <div className="success-panel success-panel--inline" role="status">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="loading-state" role="status">
          Loading users…
        </div>
      ) : error ? (
        <div className="error-panel" role="alert">
          <strong>{errorCode === "FORBIDDEN" ? "Not allowed." : "Unable to load users."}</strong>
          <p>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setRetryToken((token) => token + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          {debouncedSearch !== "" || roleFilter !== "" ? (
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
