import express, { Request, Response } from "express";
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
import { changePassword, login, logout, me } from "./auth-routes.js";
import { loadSession, requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import { addPublicComment, getPublicComments, markProblemResolved } from "./requester-collaboration.js";
import { addStaffNote, assignTicketOwner, getStaffTicket, getStaffTickets, getStaffNotes, updateTicketPriority, updateTicketStatus } from "./staff.js";

void getPrisma;

export const app = express();

app.use(cors({
  origin: process.env.APP_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(loadSession);

app.post("/api/auth/login", login);
app.post("/api/auth/logout", requireAuth, logout);
app.get("/api/auth/me", requireAuth, me);
app.post("/api/auth/change-password", requireAuth, changePassword);

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

app.get("/api/categories", requireAuth, requirePasswordChanged, requireRole("REQUESTER"), async (_req: Request, res: Response) => {
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

app.get("/api/requesters", requireAuth, requirePasswordChanged, requireRole("REQUESTER"), getRequesters);

app.get(
  "/api/related-systems",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  getRelatedSystems,
);

app.post(
  "/api/tickets",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  upload.array("attachments", 5),
  createTicket,
);

app.get(
  "/api/tickets",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  getTickets,
);

app.get(
  "/api/tickets/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  getTicket,
);

app.get(
  "/api/tickets/:id/comments",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  getPublicComments,
);

app.post(
  "/api/tickets/:id/comments",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  addPublicComment,
);

app.post(
  "/api/tickets/:id/problem-appears-resolved",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  markProblemResolved,
);

app.post(
  "/api/tickets/:id/attachments",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  upload.single("file"),
  addAttachment,
);

app.get(
  "/api/attachments/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  getAttachment,
);

app.get(
  "/api/attachments/:id/download",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  downloadAttachment,
);

app.patch(
  "/api/attachments/:id/remove",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  removeAttachment,
);

app.get(
  "/api/staff/tickets",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  getStaffTickets,
);

app.get(
  "/api/staff/tickets/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  getStaffTicket,
);

app.patch(
  "/api/staff/tickets/:id/assignment",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  assignTicketOwner,
);

app.patch(
  "/api/staff/tickets/:id/priority",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  updateTicketPriority,
);

app.patch(
  "/api/staff/tickets/:id/status",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  updateTicketStatus,
);

app.get(
  "/api/staff/tickets/:id/notes",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  getStaffNotes,
);

app.post(
  "/api/staff/tickets/:id/notes",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF"),
  addStaffNote,
);

export default app;