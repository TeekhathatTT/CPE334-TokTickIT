// Authentication handlers (api-spec.md §1).
//
// Safe-error pattern: invalid credentials AND inactive accounts both return
// 401 `AUTHENTICATION_FAILED` with the same generic message (BR-06) so login
// failures never reveal whether an email is registered or was deactivated.

import type { Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import {
  buildClearSessionCookie,
  buildSetSessionCookie,
  createSession,
  destroySession,
  destroySessionsForUser,
  hashPassword,
  meetsPasswordPolicy,
  normalizeEmail,
  passwordPolicyMessage,
  toSafeUser,
  verifyPassword,
} from "./auth.service.js";

const GENERIC_LOGIN_FAILURE = "Invalid email or password.";

function loginFailure(res: Response) {
  return res.status(401).json({
    error: {
      code: "AUTHENTICATION_FAILED",
      message: GENERIC_LOGIN_FAILURE,
    },
  });
}

function validationFailure(
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

/** POST /api/auth/login — no session required. */
export async function login(req: Request, res: Response) {
  try {
    const rawEmail = req.body?.email;
    const password = req.body?.password;

    if (typeof rawEmail !== "string" || rawEmail.trim() === "") {
      return validationFailure(res, "Email and password are required.", {
        email: "Email is required.",
      });
    }
    if (typeof password !== "string" || password === "") {
      return validationFailure(res, "Email and password are required.", {
        password: "Password is required.",
      });
    }

    const email = normalizeEmail(rawEmail);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });

    // BR-06: wrong password and inactive account are indistinguishable.
    if (!user) return loginFailure(res);
    const record = user as {
      id: number;
      name: string;
      email: string;
      role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
      isActive: boolean;
      mustChangePassword: boolean;
      passwordHash: string;
    };
    if (!record.isActive) return loginFailure(res);
    if (!verifyPassword(password, record.passwordHash)) return loginFailure(res);

    const token = createSession(record.id);
    res.setHeader("Set-Cookie", buildSetSessionCookie(token));
    return res.status(200).json({
      data: {
        user: toSafeUser(record),
      },
    });
  } catch (error) {
    console.error("Failed to log in", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to log in",
      },
    });
  }
}

/** POST /api/auth/logout — BR-07: invalidates the server-side session. */
export async function logout(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }
    destroySession(req.sessionToken);
    res.setHeader("Set-Cookie", buildClearSessionCookie());
    return res.status(204).send();
  } catch (error) {
    console.error("Failed to log out", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to log out",
      },
    });
  }
}

/** GET /api/auth/me — returns the safe identity; never a password hash. */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });
    if (!user || !(user as { isActive: boolean }).isActive) {
      destroySession(req.sessionToken);
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }
    return res.status(200).json({
      data: {
        user: toSafeUser(
          user as {
            id: number;
            name: string;
            email: string;
            role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
            isActive: boolean;
            mustChangePassword: boolean;
          },
        ),
      },
    });
  } catch (error) {
    console.error("Failed to load current user", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load current user",
      },
    });
  }
}

/**
 * POST /api/auth/change-password — valid for sessions that must change their
 * password too. Clears `mustChangePassword` and rotates the session.
 */
export async function changePassword(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
    const fields: Record<string, string> = {};

    if (typeof currentPassword !== "string" || currentPassword === "") {
      fields.currentPassword = "Current password is required.";
    }
    if (typeof newPassword !== "string" || newPassword === "") {
      fields.newPassword = "New password is required.";
    } else if (!meetsPasswordPolicy(newPassword)) {
      fields.newPassword = passwordPolicyMessage();
    }
    if (typeof confirmPassword !== "string" || confirmPassword === "") {
      fields.confirmPassword = "Password confirmation is required.";
    } else if (
      typeof newPassword === "string" &&
      newPassword !== "" &&
      confirmPassword !== newPassword
    ) {
      fields.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(fields).length > 0) {
      return validationFailure(
        res,
        "Please correct the invalid fields.",
        fields,
      );
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      destroySession(req.sessionToken);
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }

    const record = user as {
      id: number;
      name: string;
      email: string;
      role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
      isActive: boolean;
      mustChangePassword: boolean;
      passwordHash: string;
    };

    if (!verifyPassword(currentPassword, record.passwordHash)) {
      return res.status(401).json({
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "Current password is incorrect.",
        },
      });
    }

    const updated = (await prisma.user.update({
      where: { id: record.id },
      data: {
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    })) as {
      id: number;
      name: string;
      email: string;
      role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
      isActive: boolean;
      mustChangePassword: boolean;
    };

    // Rotate ALL sessions: the current token is replaced below, and every
    // other session for this user is invalidated so a holder of the previous
    // (e.g. temporary) password cannot keep using the account.
    destroySessionsForUser(record.id);
    const token = createSession(updated.id);
    res.setHeader("Set-Cookie", buildSetSessionCookie(token));
    return res.status(200).json({
      data: {
        user: toSafeUser(updated),
      },
    });
  } catch (error) {
    console.error("Failed to change password", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to change password",
      },
    });
  }
}
