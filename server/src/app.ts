import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { getRequesters } from "./requesters.js";
import {
  createTicket,
  getRelatedSystems,
  getTicket,
  getTickets,
} from "./ticket.js";
import {
  addAttachment,
  getAttachment,
  downloadAttachment,
  removeAttachment,
} from "./attachment.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  getComments,
  markProblemAppearsResolved,
  postComment,
} from "./modules/comments/comments.controller.js";
import {
  getNotes,
  postNote,
} from "./modules/notes/notes.controller.js";
import {
  getStaffTicketDetail,
  getStaffTickets,
  listAssignableStaff,
  updateTicketAssignment,
  updateTicketPriority,
  updateTicketStatus,
} from "./modules/staff/staff.controller.js";
import usersRouter from "./modules/users/users.routes.js";
import { authenticate } from "./middleware/auth.middleware.js";
import {
  authorize,
  requireFreshPassword,
} from "./middleware/authorize.middleware.js";

void getPrisma;

export const app = express();

// Safe CORS for cookie authentication (api-spec.md §7): exactly one
// configured web origin may use the session cookie — never `*` with
// credentials. SameSite=Lax on the cookie is the other CSRF layer.
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Origin/CSRF guard (api-spec.md §0 + §7): cookie auth alone is not enough.
// CORS never blocks cross-origin form POSTs and SameSite=Lax treats
// localhost on different ports as same-site, so state-changing requests
// (POST/PUT/PATCH/DELETE) must carry an Origin (or Referer fallback)
// matching the configured CLIENT_URL origin. Requests without any
// Origin/Referer (non-browser clients such as supertest/curl) are allowed
// through — there is no browser CSRF vector to block there.
const ALLOWED_ORIGIN = (() => {
  const raw = process.env.CLIENT_URL ?? "http://localhost:5173";
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
})();

function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (
    req.method !== "POST" &&
    req.method !== "PUT" &&
    req.method !== "PATCH" &&
    req.method !== "DELETE"
  ) {
    next();
    return;
  }

  const origin = req.headers.origin ?? null;
  const referer = req.headers.referer ?? null;
  const candidate = origin ?? referer ?? null;

  // No Origin/Referer: non-browser client (tests, curl) — nothing to check.
  if (!candidate) {
    next();
    return;
  }

  let candidateOrigin: string;
  try {
    candidateOrigin = new URL(candidate).origin;
  } catch {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Cross-origin request was rejected.",
      },
    });
    return;
  }

  if (candidateOrigin !== ALLOWED_ORIGIN) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Cross-origin request was rejected.",
      },
    });
    return;
  }

  next();
}

app.use(csrfOriginGuard);

/*
 * Do not use multer fileSize/files limits here.
 *
 * BR-16 requires POST /api/tickets to support partial success:
 * invalid attachments must not reject the whole Ticket creation.
 *
 * Individual attachment validation is handled inside createTicket().
 */
const upload = multer({
  storage: multer.memoryStorage(),
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// Authentication endpoints (api-spec.md §1). Login is public; logout, me,
// and change-password carry their own session check. They are mounted before
// the global session chain below so the must-change-password gate never
// locks a user out of the three exempted routes.
app.use("/api/auth", authRouter);

// Every remaining /api route requires a valid session (401 when missing,
// invalid, expired, or deactivated) and a fresh password (403
// PASSWORD_CHANGE_REQUIRED while mustChangePassword is set).
app.use("/api", authenticate, requireFreshPassword);

// Requester-only reference data + Lab 2 continuation (api-spec.md §2).
// Ownership always derives from the session (BR-03); Internal Notes are
// never included in these responses.
app.get(
  "/api/categories",
  authorize(["REQUESTER"]),
  async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.status(200).json({
      data: categories,
    });
  } catch (error) {
    console.error("Failed to load categories", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch categories",
      },
    });
  }
});

app.get(
  "/api/requesters",
  authorize(["REQUESTER"]),
  getRequesters,
);

app.get(
  "/api/related-systems",
  authorize(["REQUESTER"]),
  getRelatedSystems,
);

app.post(
  "/api/tickets",
  authorize(["REQUESTER"]),
  upload.array("attachments", 5),
  createTicket,
);

app.get(
  "/api/tickets",
  authorize(["REQUESTER"]),
  getTickets,
);

app.get(
  "/api/tickets/:id",
  authorize(["REQUESTER"]),
  getTicket,
);

app.post(
  "/api/tickets/:id/attachments",
  authorize(["REQUESTER"]),
  upload.single("file"),
  addAttachment,
);

app.get(
  "/api/attachments/:id",
  authorize(["REQUESTER"]),
  getAttachment,
);

app.get(
  "/api/attachments/:id/download",
  authorize(["REQUESTER"]),
  downloadAttachment,
);

app.patch(
  "/api/attachments/:id/remove",
  authorize(["REQUESTER"]),
  removeAttachment,
);

// Public Comments: Requester (own ticket — enforced by ownership check in
// the handler), IT Staff, or Administrator (api-spec.md §4). Requesters
// never receive Internal Notes through these routes.
app.get(
  "/api/tickets/:id/comments",
  authorize(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]),
  getComments,
);

app.post(
  "/api/tickets/:id/comments",
  authorize(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]),
  postComment,
);

// BR-05: flag-only signal, never a status transition (see controller note
// for the staff-workflow branch).
app.post(
  "/api/tickets/:id/problem-appears-resolved",
  authorize(["REQUESTER"]),
  markProblemAppearsResolved,
);

// IT Staff queue + ticket operations (api-spec.md §3). Queue, operational
// detail, assignment, priority, and status are IT Staff only per the spec §6
// matrix — Administrators do not inherit them (notes below are the
// exception). A Requester always sees 403 here, never ticket data.
app.get(
  "/api/staff/tickets",
  authorize(["IT_STAFF"]),
  getStaffTickets,
);

// Assignable-owner directory for the ui-spec §6 owner select (fills the
// api-spec gap: no staff-scoped user directory existed, forcing the UI to
// ask for a raw user id).
app.get(
  "/api/staff/users",
  authorize(["IT_STAFF"]),
  listAssignableStaff,
);

app.get(
  "/api/staff/tickets/:id",
  authorize(["IT_STAFF"]),
  getStaffTicketDetail,
);

// Spec §8 decision: the implemented path is `.../assignment` (not the
// shorter `.../owner` alias) so ticket-operation routes stay out of the
// Requester namespace.
app.patch(
  "/api/staff/tickets/:id/assignment",
  authorize(["IT_STAFF"]),
  updateTicketAssignment,
);

app.patch(
  "/api/staff/tickets/:id/priority",
  authorize(["IT_STAFF"]),
  updateTicketPriority,
);

app.patch(
  "/api/staff/tickets/:id/status",
  authorize(["IT_STAFF"]),
  updateTicketStatus,
);

// Internal Notes (api-spec.md §4): IT Staff or Administrator only. The
// guard returns 403 with no note content/count for Requesters (AC-04).
app.get(
  "/api/staff/tickets/:id/notes",
  authorize(["IT_STAFF", "ADMINISTRATOR"]),
  getNotes,
);

app.post(
  "/api/staff/tickets/:id/notes",
  authorize(["IT_STAFF", "ADMINISTRATOR"]),
  postNote,
);

// Administrator user management (api-spec.md §5, FR-10/FR-11/FR-12).
// Minimalist scope only: list/search/role-filter, create, edit, activation,
// and initial-password reset. No delete, bulk, import/export, history, or
// recovery endpoint exists (BR-22/BR-27). The router carries the canonical
// `initial-password` path only.
app.use("/api/admin/users", authorize(["ADMINISTRATOR"]), usersRouter);

export default app;
