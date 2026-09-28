// Session/token middleware (api-spec.md §0, §1, §7).
//
// Verifies the opaque server-side session cookie `toktickit_session` on every
// request and attaches `req.user = { id, role, mustChangePassword }`.
// Missing/invalid/expired sessions (and sessions whose user was deactivated)
// get a safe 401 — never a hint about which part failed.

import type { NextFunction, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import {
  destroySession,
  getSessionTokenFromCookieHeader,
  getSessionUserId,
  type UserRole,
} from "../modules/auth/auth.service.js";

export interface AuthenticatedIdentity {
  id: number;
  role: UserRole;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  namespace Express {
    interface Request {
      /** Authenticated session identity; absent when `authenticate` rejected. */
      user?: AuthenticatedIdentity;
      /** Raw session token captured by `authenticate` (for logout/rotation). */
      sessionToken?: string;
    }
  }
}

function unauthenticated(res: Response) {
  return res.status(401).json({
    error: {
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    },
  });
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getSessionTokenFromCookieHeader(req.headers.cookie);
    const userId = getSessionUserId(token);

    if (!userId) {
      destroySession(token);
      unauthenticated(res);
      return;
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    // BR-01 / FR-03: inactive (or deleted) users lose protected access even
    // with a previously valid session; the session is purged and the caller
    // sees the same 401 as a missing session (no enumeration).
    if (!user || !(user as { isActive: boolean }).isActive) {
      destroySession(token);
      unauthenticated(res);
      return;
    }

    const record = user as {
      id: number;
      role: UserRole;
      mustChangePassword: boolean;
    };
    req.user = {
      id: record.id,
      role: record.role,
      mustChangePassword: record.mustChangePassword,
    };
    req.sessionToken = token as string;
    next();
  } catch (error) {
    console.error("Failed to authenticate session", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to authenticate request",
      },
    });
  }
}
