import type { AdminUser } from "../../api";

interface UserListProps {
  users: AdminUser[];
  currentUserId: number;
  onEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
}

function roleBadgeClass(role: AdminUser["role"]): string {
  if (role === "IT_STAFF") return "badge badge--role-staff";
  if (role === "ADMINISTRATOR") return "badge badge--role-admin";
  return "badge badge--role-requester";
}

function roleLabel(role: AdminUser["role"]): string {
  if (role === "IT_STAFF") return "IT Staff";
  if (role === "ADMINISTRATOR") return "Administrator";
  return "Requester";
}

function statusBadge(isActive: boolean) {
  // Reuse existing Zen Green tokens only (ui-spec §1): green solid for
  // Active, gray for Inactive. Text always accompanies the color.
  return isActive ? (
    <span className="badge badge--resolved">Active</span>
  ) : (
    <span className="badge badge--closed">Inactive</span>
  );
}

/**
 * User list (ui-spec.md §7, FR-10): Name, Email, Role badge, Status badge,
 * Edit action. The Deactivate control lives in the edit form — here the
 * self row is labelled "(you)" so the admin can see why deactivation is
 * unavailable there. A distinct Set Password action keeps password resets
 * separate from name/email fixes.
 */
export function UserList({ users, currentUserId, onEdit, onResetPassword }: UserListProps) {
  if (users.length === 0) {
    return null;
  }

  return (
    <>
      <div className="ticket-table-wrap">
        <table className="ticket-table" aria-label="Users">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    {isSelf ? " (you)" : ""}
                  </td>
                  <td title={user.email}>{user.email}</td>
                  <td>
                    <span className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</span>
                  </td>
                  <td>{statusBadge(user.isActive)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Edit ${user.name}`}
                      onClick={() => onEdit(user)}
                    >
                      Edit
                    </button>{" "}
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Set new password for ${user.name}`}
                      onClick={() => onResetPassword(user)}
                    >
                      Set Password
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ticket-cards">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <article className="ticket-card" key={user.id}>
              <div className="ticket-card__header">
                <strong>
                  {user.name}
                  {isSelf ? " (you)" : ""}
                </strong>
                {statusBadge(user.isActive)}
              </div>
              <p className="ticket-card__summary" title={user.email}>
                {user.email}
              </p>
              <div className="ticket-card__grid">
                <span>
                  Role<strong>{roleLabel(user.role)}</strong>
                </span>
                <span>
                  Actions
                  <strong>
                    <button type="button" className="link-button" onClick={() => onEdit(user)}>
                      Edit
                    </button>{" "}
                    <button type="button" className="link-button" onClick={() => onResetPassword(user)}>
                      Set Password
                    </button>
                  </strong>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
