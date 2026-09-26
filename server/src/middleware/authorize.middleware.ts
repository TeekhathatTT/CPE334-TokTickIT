// Server-side authorization guards (spec §6 authorization matrix, FR-04,
// BR-02/BR-23).
//
// These guards are the enforcement point: UI visibility is only feedback.
// Every guard combines with ownership checks inside handlers where the matrix
// requires it (a Requester's own-ticket access is an ownership check yielding
// 404, not just this role check).

import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../modules/auth/auth.service.js";

/**
 * Guard factory, e.g. `authorize(["IT_STAFF", "ADMINISTRATOR"])`.
 * Returns 401 when there is no authenticated identity and 403 when the
 * authenticated role is not permitted.
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You are not allowed to perform this action.",
        },
      });
      return;
    }

    next();
  };
}

// Routes that stay usable while `mustChangePassword === true`
// (api-spec.md §1: change-password, me, logout only).
const PASSWORD_GATE_EXEMPT_PREFIXES = [
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

/**
 * BR-02 / FR-02 mandatory-password-change gate. When the authenticated user
 * still must change their password, every route except the three exempted
 * auth routes returns 403 with a `PASSWORD_CHANGE_REQUIRED` code the
 * frontend keys off to force the change-password flow.
 */
export function requireFreshPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user?.mustChangePassword) {
    next();
    return;
  }

  const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
  const exempt = PASSWORD_GATE_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (exempt) {
    next();
    return;
  }

  res.status(403).json({
    error: {
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Password change is required before continuing.",
    },
  });
}

// ---------------------------------------------------------------------------
// Requester ownership predicate (BR-03, BR-09).
//
// The authenticated session identity — never a client-supplied requesterId —
// determines which tickets a Requester may see. `Ticket.requesterUserId` is
// the post-migration ownership trail; the legacy `Ticket.requesterId` link
// (via `User.legacyRequesterId`) is matched as well so rows written before
// the backfill stay reachable by their owner. A mismatch yields 404 from the
// handler (never 403 with another user's data).
// ---------------------------------------------------------------------------

export interface RequesterSessionRow {
  id: number;
  legacyRequesterId: number | null;
  email?: string;
}

/** Prisma `where` fragment restricting tickets to one Requester's own rows. */
export function ownedTicketFilter(user: RequesterSessionRow) {
  if (user.legacyRequesterId !== null && user.legacyRequesterId !== undefined) {
    return {
      OR: [
        { requesterUserId: user.id },
        { requesterId: user.legacyRequesterId },
      ],
    };
  }
  return { requesterUserId: user.id };
}
