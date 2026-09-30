// Public-comment + Problem-Appears-Resolved handlers (api-spec.md §4).
//
// GET/POST /api/tickets/:id/comments — Requester (own ticket only), IT Staff,
// or Administrator. POST is append-only with BR-14 validation.
// POST /api/tickets/:id/problem-appears-resolved — active Requester owning
// the ticket. Per BR-05 / api-spec.md §4 this records the
// `Ticket.problemAppearsResolvedAt` flag and NEVER performs a status
// transition: the ticket status is returned untouched. Repeated calls are
// idempotent (the existing timestamp is returned).
//
// NOTE for the staff-workflow branch: status-transition logic must treat
// `problemAppearsResolvedAt` as a signal only — it does not imply Resolved.

import type { Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import {
  ownedTicketFilter,
  type RequesterSessionRow,
} from "../../middleware/authorize.middleware.js";
import {
  createPublicComment,
  listPublicComments,
  validateCommentContent,
} from "./comments.service.js";

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

async function loadCommentSession(
  req: Request,
  res: Response,
): Promise<RequesterSessionRow | null> {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
      },
    });
    return null;
  }
  const prisma = getPrisma();
  const user = (await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, isActive: true, legacyRequesterId: true },
  })) as {
    id: number;
    isActive: boolean;
    legacyRequesterId: number | null;
  } | null;
  if (!user || !user.isActive) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
      },
    });
    return null;
  }
  return { id: user.id, legacyRequesterId: user.legacyRequesterId };
}

/**
 * Resolve a ticket for comments access: Requesters pass only for their own
 * ticket (404 otherwise, per BR-09); IT Staff / Administrator pass for any
 * existing ticket (queue/detail scoping beyond existence is owned by the
 * staff-workflow and admin branches, not this one).
 */
async function resolveCommentTicket(
  ticketId: number,
  sessionUser: RequesterSessionRow,
  role: string,
) {
  const prisma = getPrisma();
  if (role === "REQUESTER") {
    return prisma.ticket.findFirst({
      where: { id: ticketId, ...ownedTicketFilter(sessionUser) },
      select: { id: true },
    });
  }
  return prisma.ticket.findFirst({
    where: { id: ticketId },
    select: { id: true },
  });
}

/** GET /api/tickets/:id/comments */
export async function getComments(req: Request, res: Response) {
  try {
    const sessionUser = await loadCommentSession(req, res);
    if (!sessionUser) return;
    const ticketId = parseTicketId(req);
    if (!ticketId) return notFoundTicket(res);

    const ticket = await resolveCommentTicket(
      ticketId,
      sessionUser,
      req.user?.role ?? "",
    );
    if (!ticket) return notFoundTicket(res);

    const comments = await listPublicComments(ticketId);
    return res.status(200).json({ data: comments });
  } catch (error) {
    console.error("Failed to load comments", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch comments",
      },
    });
  }
}

/** POST /api/tickets/:id/comments */
export async function postComment(req: Request, res: Response) {
  try {
    const sessionUser = await loadCommentSession(req, res);
    if (!sessionUser) return;
    const ticketId = parseTicketId(req);
    if (!ticketId) return notFoundTicket(res);

    const ticket = await resolveCommentTicket(
      ticketId,
      sessionUser,
      req.user?.role ?? "",
    );
    if (!ticket) return notFoundTicket(res);

    const validation = validateCommentContent(req.body?.content);
    if (!validation.ok) {
      const message =
        validation.error === "TOO_LONG"
          ? "Comment must not exceed 2000 characters."
          : "Comment must not be empty.";
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message,
          fields: { content: message },
        },
      });
    }

    const comment = await createPublicComment(
      ticketId,
      sessionUser.id,
      validation.value as string,
    );
    return res.status(201).json({ data: comment });
  } catch (error) {
    console.error("Failed to post comment", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to post comment",
      },
    });
  }
}

/** POST /api/tickets/:id/problem-appears-resolved */
export async function markProblemAppearsResolved(req: Request, res: Response) {
  try {
    const sessionUser = await loadCommentSession(req, res);
    if (!sessionUser) return;
    const ticketId = parseTicketId(req);
    if (!ticketId) return notFoundTicket(res);

    const prisma = getPrisma();
    const ticket = (await prisma.ticket.findFirst({
      where: { id: ticketId, ...ownedTicketFilter(sessionUser) },
      select: { id: true, status: true, problemAppearsResolvedAt: true },
    })) as {
      id: number;
      status: string;
      problemAppearsResolvedAt: Date | null;
    } | null;
    if (!ticket) return notFoundTicket(res);

    // Idempotent: a repeated signal returns the existing timestamp.
    if (ticket.problemAppearsResolvedAt) {
      return res.status(200).json({
        data: {
          ticketId: ticket.id,
          problemAppearsResolvedAt:
            ticket.problemAppearsResolvedAt.toISOString(),
        },
      });
    }

    const updated = (await prisma.ticket.update({
      where: { id: ticket.id },
      // BR-05: only the signal flag is written — status is never set to
      // Resolved/Closed here.
      data: { problemAppearsResolvedAt: new Date() },
      select: { id: true, problemAppearsResolvedAt: true },
    })) as { id: number; problemAppearsResolvedAt: Date };

    return res.status(200).json({
      data: {
        ticketId: updated.id,
        problemAppearsResolvedAt:
          updated.problemAppearsResolvedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to mark problem as appears-resolved", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to record resolution signal",
      },
    });
  }
}
