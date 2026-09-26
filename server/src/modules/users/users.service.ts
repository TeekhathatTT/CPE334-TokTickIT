// Administrator user-management service (api-spec.md §5, spec FR-10/FR-11/FR-12,
// BR-17/BR-18/BR-19/BR-20/BR-21/BR-22).
//
// Intentionally minimal per handout §8.5 "not required" list: search by
// name/email (partial, case-insensitive) + one optional single role filter.
// No pagination, multi-column sort, or multi-filter — do not gold-plate.

export const USER_ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;

export type AdminUserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is AdminUserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_SEARCH_LENGTH = 120;
export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;

export interface AdminUsersFilters {
  search: string;
  role?: AdminUserRole;
}

/** Validate GET /api/admin/users query (search + optional single role). */
export function parseAdminUsersQuery(query: Record<string, unknown>): {
  ok: boolean;
  filters?: AdminUsersFilters;
  fields?: Record<string, string>;
} {
  const fields: Record<string, string> = {};

  const rawSearch = query.search;
  const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
  if (search.length > MAX_SEARCH_LENGTH) {
    fields.search = "Search must be 120 characters or fewer.";
  }

  let role: AdminUserRole | undefined;
  const rawRole = query.role;
  if (rawRole !== undefined && rawRole !== "" && rawRole !== null) {
    if (Array.isArray(rawRole)) {
      fields.role =
        "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR.";
    } else if (typeof rawRole !== "string" || !isUserRole(rawRole)) {
      fields.role =
        "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR.";
    } else {
      role = rawRole;
    }
    // Reject comma-separated multi-values (multiple simultaneous filters out
    // of scope per handout §8.5).
    if (typeof rawRole === "string" && rawRole.includes(",")) {
      fields.role =
        "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR.";
      role = undefined;
    }
  }

  // Reject unknown query keys? No — ignore extras to stay minimal, but flag
  // clearly invalid pagination/sort attempts as out-of-scope misuse.
  for (const key of ["page", "pageSize", "sort", "order"]) {
    if (query[key] !== undefined && query[key] !== "") {
      fields[key] = "This listing supports only search and role filter.";
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }
  return { ok: true, filters: { search, ...(role ? { role } : {}) } };
}

/** Prisma `where` for the admin list. Search is case-insensitive partial. */
export function buildAdminUsersWhere(
  filters: AdminUsersFilters,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.search) {
    const contains = {
      contains: filters.search,
      mode: "insensitive" as const,
    };
    where.OR = [{ name: contains }, { email: contains }];
  }
  return where;
}

export interface SafeAdminUser {
  id: number;
  name: string;
  email: string;
  role: AdminUserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Safe shape — never a passwordHash (api-spec.md §5). */
export function toSafeAdminUser(row: {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}): SafeAdminUser {
  const toIso = (value: Date | string): string =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AdminUserRole,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function validateUserName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim() === "") {
    return "Name is required.";
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return "Name must be 120 characters or fewer.";
  }
  return null;
}

export function validateUserEmail(email: unknown): string | null {
  if (typeof email !== "string" || email.trim() === "") {
    return "Email is required.";
  }
  const trimmed = email.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return "Email must be 254 characters or fewer.";
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Email must be a valid email address.";
  }
  return null;
}

export function validateUserRole(role: unknown): string | null {
  if (!isUserRole(role)) {
    return "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR.";
  }
  return null;
}

export function validateIsActive(value: unknown): string | null {
  if (typeof value !== "boolean") {
    return "Active state must be true or false.";
  }
  return null;
}
