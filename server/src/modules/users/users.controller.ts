// Administrator user-management handlers (api-spec.md §5).
//
// Endpoints (all ADMINISTRATOR-only via route guard; 403 otherwise):
//   GET   /api/admin/users                      — list + search + role filter
//   POST  /api/admin/users                      — create (admin-supplied
//       initialPassword per api-spec §5, mustChangePassword=true always)
//   PATCH /api/admin/users/:id                  — edit name/email/role/isActive
//       + unassign owned tickets when the target stops being an eligible
//       owner (BR-11), in the same transaction as the user update
//   POST  /api/admin/users/:id/initial-password — reset (admin-supplied,
//       mustChangePassword=true; never emailed, never returned)
//
// No other reset/recovery endpoint or password field alias exists: api-spec
// §5 states "No delete, bulk, import/export, role history, email
// invitation, or advanced recovery endpoint exists in Lab 3." The canonical
// body field is `initialPassword` only.
//
// Safeguards (FR-12, BR-20/BR-21/BR-22):
//   - Duplicate email (case-insensitive via normalized email, BR-18) → 409.
//   - Self-deactivation (req.user.id === :id && isActive=false) → 409.
//   - Last active Administrator removal (deactivate or demote) → 409.
//   - No delete endpoint exists anywhere in this module (deactivation only).
//   - Every admin-set/reset password forces mustChangePassword=true (BR-19).

import type { Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import {
  destroySessionsForUser,
  hashPassword,
  meetsPasswordPolicy,
  normalizeEmail,
  passwordPolicyMessage,
} from "../auth/auth.service.js";
import {
  buildAdminUsersWhere,
  isUserRole,
  parseAdminUsersQuery,
  toSafeAdminUser,
  validateIsActive,
  validateUserEmail,
  validateUserName,
  validateUserRole,
} from "./users.service.js";

const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

function validationError(
  res: Response,
  message: string,
  fields?: Record<string, string>,
) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function conflict(res: Response, message: string, fields?: Record<string, string>) {
  return res.status(409).json({
    error: {
      code: "CONFLICT",
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function userNotFound(res: Response) {
  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "User not found.",
    },
  });
}

/** Prisma unique-violation (concurrent duplicate email) → 409, not 500. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Prisma serialization / transaction conflict (concurrent admin guard). */
function isSerializationFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2034" || code === "40001";
}

class LastAdminError extends Error {
  constructor() {
    super("At least one active Administrator must remain.");
    this.name = "LastAdminError";
  }
}

/**
 * Run `fn` in a Serializable transaction when the client supports it.
 * Falls back to a direct call for mocked clients without `$transaction`
 * (unit tests) — production Prisma (Postgres) always takes the
 * transactional path so the last-admin count+update is atomic.
 */
async function runSerializableTransaction<T>(
  prisma: ReturnType<typeof getPrisma>,
  fn: (tx: ReturnType<typeof getPrisma>) => Promise<T>,
): Promise<T> {
  const candidate = prisma as unknown as Record<string, unknown>;
  if (typeof candidate.$transaction === "function") {
    const run = candidate.$transaction as (
      arg: (tx: ReturnType<typeof getPrisma>) => Promise<T>,
      options?: Record<string, unknown>,
    ) => Promise<T>;
    return run(fn, { isolationLevel: "Serializable" });
  }
  return fn(prisma);
}

function duplicateEmailConflict(res: Response) {
  return conflict(res, "A user with this email already exists.", {
    email: "A user with this email already exists.",
  });
}

function parseUserId(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** GET /api/admin/users — list with search + optional role filter. */
export async function listUsers(req: Request, res: Response) {
  const parsed = parseAdminUsersQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    return validationError(
      res,
      "Please correct the invalid query parameters.",
      parsed.fields,
    );
  }
  const filters = parsed.filters!;

  try {
    const prisma = getPrisma();
    const where = buildAdminUsersWhere(filters);
    const rows = (await prisma.user.findMany({
      where,
      select: ADMIN_SELECT,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    })) as UserRow[];
    return res.status(200).json({ data: rows.map(toSafeAdminUser) });
  } catch (error) {
    console.error("Failed to list users", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch users",
      },
    });
  }
}

/** POST /api/admin/users — create with admin-supplied initialPassword. */
export async function createUser(req: Request, res: Response) {
  const { name, email, role, isActive, initialPassword } = req.body ?? {};
  const fields: Record<string, string> = {};

  const nameError = validateUserName(name);
  if (nameError) fields.name = nameError;

  const emailError = validateUserEmail(email);
  if (emailError) fields.email = emailError;

  const roleError = validateUserRole(role);
  if (roleError) fields.role = roleError;

  // isActive defaults to true when omitted (activation state is part of the
  // create shape per FR-11; omitted means active).
  let active = true;
  if (isActive !== undefined) {
    const activeError = validateIsActive(isActive);
    if (activeError) fields.isActive = activeError;
    else active = isActive;
  }

  // api-spec §5 canonical field is `initialPassword` only (admin-supplied,
  // never generated, never emailed). No `password` alias exists.
  const suppliedPassword = initialPassword;
  if (typeof suppliedPassword !== "string" || suppliedPassword === "") {
    fields.initialPassword = "Initial password is required.";
  } else if (!meetsPasswordPolicy(suppliedPassword)) {
    fields.initialPassword = passwordPolicyMessage();
  }

  if (Object.keys(fields).length > 0) {
    return validationError(res, "Please correct the invalid fields.", fields);
  }

  const normalized = normalizeEmail(email as string);

  try {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true },
    });
    if (existing) {
      return duplicateEmailConflict(res);
    }

    const created = (await prisma.user.create({
      data: {
        name: (name as string).trim(),
        email: normalized,
        role,
        isActive: active,
        passwordHash: hashPassword(suppliedPassword as string),
        mustChangePassword: true,
      },
      select: ADMIN_SELECT,
    })) as UserRow;

    return res.status(201).json({ data: toSafeAdminUser(created) });
  } catch (error) {
    // Concurrent creates with the same email can both pass the pre-check;
    // the unique constraint is authoritative → 409, not 500.
    if (isUniqueViolation(error)) {
      return duplicateEmailConflict(res);
    }
    console.error("Failed to create user", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to create user",
      },
    });
  }
}

/**
 * Count active Administrators excluding one id. Used before any update that
 * would deactivate an Administrator or demote them away from ADMINISTRATOR.
 */
async function countOtherActiveAdmins(
  prisma: ReturnType<typeof getPrisma>,
  excludeId: number,
): Promise<number> {
  return (prisma.user.count as (args: unknown) => Promise<number>)({
    where: { role: "ADMINISTRATOR", isActive: true, id: { not: excludeId } },
  });
}

/** PATCH /api/admin/users/:id — edit name/email/role/isActive. */
export async function updateUser(req: Request, res: Response) {
  const targetId = parseUserId(req);
  if (!targetId) return userNotFound(res);

  const body = req.body ?? {};
  const hasName = body.name !== undefined;
  const hasEmail = body.email !== undefined;
  const hasRole = body.role !== undefined;
  const hasActive = body.isActive !== undefined;

  if (!hasName && !hasEmail && !hasRole && !hasActive) {
    return validationError(res, "Please correct the invalid fields.", {
      body: "At least one of name, email, role, or isActive is required.",
    });
  }

  const fields: Record<string, string> = {};
  if (hasName) {
    const error = validateUserName(body.name);
    if (error) fields.name = error;
  }
  if (hasEmail) {
    const error = validateUserEmail(body.email);
    if (error) fields.email = error;
  }
  if (hasRole) {
    const error = validateUserRole(body.role);
    if (error) fields.role = error;
  }
  if (hasActive) {
    const error = validateIsActive(body.isActive);
    if (error) fields.isActive = error;
  }
  if (Object.keys(fields).length > 0) {
    return validationError(res, "Please correct the invalid fields.", fields);
  }

  try {
    const prisma = getPrisma();
    const current = (await prisma.user.findUnique({
      where: { id: targetId },
    })) as
      | {
          id: number;
          name: string;
          email: string;
          role: string;
          isActive: boolean;
        }
      | null;
    if (!current) return userNotFound(res);

    // BR-20 self-deactivation guard (API-level, not just UI-hidden): reject —
    // do not silently ignore the field.
    if (req.user?.id === targetId && body.isActive === false) {
      return conflict(res, "You cannot deactivate your own account.", {
        isActive: "You cannot deactivate your own account.",
      });
    }

    // Duplicate email (case-insensitive, BR-18) on edit — fast-path
    // pre-check. The unique constraint remains authoritative; a concurrent
    // edit that slips past this check surfaces as P2002 → 409 below.
    let normalizedEmail: string | undefined;
    if (hasEmail) {
      normalizedEmail = normalizeEmail(body.email as string);
      if (normalizedEmail !== normalizeEmail(current.email)) {
        const clash = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (clash && (clash as { id: number }).id !== targetId) {
          return duplicateEmailConflict(res);
        }
      }
    }

    const nextRole = hasRole ? (body.role as string) : current.role;
    const nextActive = hasActive ? (body.isActive as boolean) : current.isActive;
    const wasActiveAdmin = current.role === "ADMINISTRATOR" && current.isActive;
    const willBeActiveAdmin = nextRole === "ADMINISTRATOR" && nextActive;
    const losesAdminStanding = wasActiveAdmin && !willBeActiveAdmin;

    // BR-11: the owner set is exactly { active IT_STAFF }. When the target
    // stops being eligible (demoted away from IT_STAFF or deactivated),
    // unassign their tickets in the same transaction so no ticket keeps
    // pointing at a user who may no longer own tickets.
    const wasEligibleOwner = current.role === "IT_STAFF" && current.isActive;
    const willBeEligibleOwner = nextRole === "IT_STAFF" && nextActive;
    const needsUnassign = wasEligibleOwner && !willBeEligibleOwner;

    const data: Record<string, unknown> = {};
    if (hasName) data.name = (body.name as string).trim();
    if (hasEmail) data.email = normalizedEmail!;
    if (hasRole) {
      if (!isUserRole(body.role)) {
        return validationError(res, "Please correct the invalid fields.", {
          role: "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR.",
        });
      }
      data.role = body.role;
    }
    if (hasActive) data.isActive = body.isActive as boolean;

    // BR-21 last-active-Administrator guard + user update + ticket unassign
    // run atomically in a Serializable transaction so two concurrent
    // deactivations/demotions cannot both sneak past the count check.
    const updated = await runSerializableTransaction(prisma, async (tx) => {
      if (losesAdminStanding) {
        const remaining = await countOtherActiveAdmins(tx, targetId);
        if (remaining === 0) {
          throw new LastAdminError();
        }
      }

      const row = (await tx.user.update({
        where: { id: targetId },
        data,
        select: ADMIN_SELECT,
      })) as UserRow;

      if (needsUnassign) {
        const ticketDelegate = (tx as unknown as Record<string, unknown>)
          .ticket as
          | { updateMany?: (args: unknown) => Promise<unknown> }
          | undefined;
        if (ticketDelegate?.updateMany) {
          await ticketDelegate.updateMany({
            where: { ticketOwnerId: targetId },
            data: { ticketOwnerId: null },
          });
        }
      }

      return row;
    });

    return res.status(200).json({ data: toSafeAdminUser(updated) });
  } catch (error) {
    if (error instanceof LastAdminError) {
      return conflict(res, error.message, {
        role: "At least one active Administrator must remain.",
      });
    }
    // Concurrent edits to the same email → unique constraint → 409.
    if (isUniqueViolation(error)) {
      return duplicateEmailConflict(res);
    }
    // A serialization conflict means a concurrent admin-membership change
    // raced us; fail closed as a 409 rather than silently removing the last
    // administrator or returning a bare 500.
    if (isSerializationFailure(error)) {
      return conflict(res, "At least one active Administrator must remain.", {
        role: "At least one active Administrator must remain.",
      });
    }
    console.error("Failed to update user", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to update user",
      },
    });
  }
}

/**
 * POST /api/admin/users/:id/initial-password (api-spec §5 canonical).
 * Admin override — no old password required. Forces mustChangePassword=true
 * (BR-19) and rotates the target's sessions so a holder of the previous
 * password loses access. The body field is `initialPassword` only.
 */
export async function setInitialPassword(req: Request, res: Response) {
  const targetId = parseUserId(req);
  if (!targetId) return userNotFound(res);

  const supplied = req.body?.initialPassword;

  if (typeof supplied !== "string" || supplied === "") {
    return validationError(res, "Please correct the invalid fields.", {
      initialPassword: "Initial password is required.",
    });
  }
  if (!meetsPasswordPolicy(supplied)) {
    return validationError(res, "Please correct the invalid fields.", {
      initialPassword: passwordPolicyMessage(),
    });
  }

  try {
    const prisma = getPrisma();
    const current = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!current) return userNotFound(res);

    const updated = (await prisma.user.update({
      where: { id: targetId },
      data: {
        passwordHash: hashPassword(supplied),
        mustChangePassword: true,
      },
      select: ADMIN_SELECT,
    })) as UserRow;

    // Invalidate the target's sessions so the previous password cannot keep
    // being used (consistent with change-password rotating all sessions).
    try {
      destroySessionsForUser(targetId);
    } catch {
      // Session-store failure must not fail the password write itself.
    }

    return res.status(200).json({ data: toSafeAdminUser(updated) });
  } catch (error) {
    console.error("Failed to reset initial password", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to set initial password",
      },
    });
  }
}
