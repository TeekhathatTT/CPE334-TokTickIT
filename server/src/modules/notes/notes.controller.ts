// Internal-note handlers (api-spec.md §4).
//
// Routes are guarded by `authorize(["IT_STAFF", "ADMINISTRATOR"])` in
// app.ts, so a Requester always receives 403 with the safe error envelope
// and NO note content, count, or existence hint in the body (handout AC-04).
// Requester-role access never reaches the service layer below.

import type { Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import {
  createInternalNote,
  listInternalNotes,
  validateNoteContent,
} from "./notes.service.js";

function parseTicketId(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function notFoundTicket(res: Response) {
  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Ticket not found.",
    },
  });
}

/** GET /api/staff/tickets/:id/notes — IT Staff / Administrator only. */
export async function getNotes(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }
    const ticketId = parseTicketId(req);
    if (!ticketId) return notFoundTicket(res);

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) return notFoundTicket(res);

    const notes = await listInternalNotes(ticketId);
    return res.status(200).json({ data: notes });
  } catch (error) {
    console.error("Failed to load internal notes", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch notes",
      },
    });
  }
}

/** POST /api/staff/tickets/:id/notes — append-only, BR-14 validation. */
export async function postNote(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }
    const ticketId = parseTicketId(req);
    if (!ticketId) return notFoundTicket(res);

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) return notFoundTicket(res);

    const validation = validateNoteContent(req.body?.content);
    if (!validation.ok) {
      const message =
        validation.error === "TOO_LONG"
          ? "Note must not exceed 2000 characters."
          : "Note must not be empty.";
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message,
          fields: { content: message },
        },
      });
    }

    const note = await createInternalNote(ticketId, req.user.id, validation.value as string);
    return res.status(201).json({ data: note });
  } catch (error) {
    console.error("Failed to post internal note", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to post note",
      },
    });
  }
}
