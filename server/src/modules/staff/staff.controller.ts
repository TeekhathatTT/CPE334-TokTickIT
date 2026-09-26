// IT Staff queue + ticket-operation handlers (api-spec.md §3).
//
// Authorization boundary: queue, detail, assignment, priority, and status
// are IT Staff only (spec §6 matrix — Administrators do not inherit them).
// Internal Notes live under modules/notes with their own IT Staff +
// Administrator gate. Every handler returns the safe envelope; unexpected
// failures log server-side and return INTERNAL_ERROR only.

import type { Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import {
  allowedNextStatuses,
  buildStaffQueueOrderBy,
  buildStaffQueueWhere,
  isStaffPriority,
  isStaffStatus,
  parseStaffQueueQuery,
} from "./staff.service.js";

function validationError(res: Response, message: string, fields?: Record<string, string>) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function ticketNotFound(res: Response) {
  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Ticket not found.",
    },
  });
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

interface QueueRow {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string };
  requester: { name: string };
  ticketOwner: { id: number; name: string } | null;
}

function toQueueRow(row: QueueRow) {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    summary: row.summary,
    category: row.category.name,
    requestedPriority: row.requestedPriority,
    itPriority: row.itPriority,
    status: row.status,
    owner: row.ticketOwner
      ? { id: row.ticketOwner.id, name: row.ticketOwner.name }
      : null,
    requester: { name: row.requester.name },
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

interface DetailRow extends QueueRow {
  description: string;
  relatedSystem: { name: string };
  requester: { name: string; email: string };
  requesterUser: { id: number; name: string; email: string } | null;
  problemAppearsResolvedAt: Date | null;
  attachments: Array<{
    id: number;
    originalFilename: string;
    sizeBytes: number;
    uploadedAt: Date;
    removedAt: Date | null;
    removalReason: string | null;
  }>;
  publicComments: Array<{
    id: number;
    content: string;
    createdAt: Date;
    author: { id: number; name: string; role: string };
  }>;
  internalNotes: Array<{
    id: number;
    content: string;
    createdAt: Date;
    author: { id: number; name: string; role: string };
  }>;
}

/**
 * Full operational detail for IT Staff: ticket fields, requester safe
 * identity, owner, attachments, both threads, the BR-05 resolved signal,
 * and the permitted next statuses (the UI mirrors this list; enforcement
 * stays server-side in updateTicketStatus).
 */
export function toStaffDetail(ticket: DetailRow) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    description: ticket.description,
    category: ticket.category.name,
    relatedSystem: ticket.relatedSystem.name,
    requester: {
      name: ticket.requester.name,
      email: ticket.requester.email,
      userId: ticket.requesterUser ? ticket.requesterUser.id : null,
    },
    owner: ticket.ticketOwner
      ? { id: ticket.ticketOwner.id, name: ticket.ticketOwner.name }
      : null,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    // BR-05: flag-only signal surfaced for staff context — never a transition.
    problemAppearsResolvedAt: ticket.problemAppearsResolvedAt
      ? toIso(ticket.problemAppearsResolvedAt)
      : null,
    createdAt: toIso(ticket.createdAt),
    updatedAt: toIso(ticket.updatedAt),
    attachments: ticket.attachments.map((attachment) => ({
      id: attachment.id,
      originalFilename: attachment.originalFilename,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: toIso(attachment.uploadedAt),
      removedAt: attachment.removedAt ? toIso(attachment.removedAt) : null,
      removalReason: attachment.removalReason,
    })),
    publicComments: ticket.publicComments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: toIso(comment.createdAt),
      author: comment.author,
    })),
    internalNotes: ticket.internalNotes.map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: toIso(note.createdAt),
      author: note.author,
    })),
    permittedActions: {
      allowedStatuses: allowedNextStatuses(ticket.status),
    },
  };
}

const detailInclude = {
  category: { select: { name: true } },
  relatedSystem: { select: { name: true } },
  requester: { select: { name: true, email: true } },
  requesterUser: { select: { id: true, name: true, email: true } },
  ticketOwner: { select: { id: true, name: true } },
  attachments: { orderBy: { id: "asc" as const } },
  publicComments: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  internalNotes: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
};

/** GET /api/staff/tickets — queue with search/filter/sort/pagination. */
export async function getStaffTickets(req: Request, res: Response) {
  const parsed = parseStaffQueueQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    return validationError(res, "Please correct the invalid query parameters.", parsed.fields);
  }
  const filters = parsed.filters!;

  try {
    const prisma = getPrisma();
    const where = buildStaffQueueWhere(filters);

    const [queueTotal, totalItems, rows] = await Promise.all([
      prisma.ticket.count({}),
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          requestedPriority: true,
          itPriority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { name: true } },
          requester: { select: { name: true } },
          ticketOwner: { select: { id: true, name: true } },
        },
        orderBy: [buildStaffQueueOrderBy(filters.sort, filters.order) as never, { id: "desc" as const } as never],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / filters.pageSize);

    return res.status(200).json({
      data: (rows as QueueRow[]).map(toQueueRow),
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
        queueTotal,
        isEmpty: queueTotal === 0,
        isNoResults: queueTotal > 0 && totalItems === 0,
      },
    });
  } catch (error) {
    console.error("Failed to load staff queue", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch tickets",
      },
    });
  }
}

function staffTicketId(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET /api/staff/tickets/:id — operational detail. */
export async function getStaffTicketDetail(req: Request, res: Response) {
  const ticketId = staffTicketId(req);
  if (!ticketId) return ticketNotFound(res);

  try {
    const prisma = getPrisma();
    const ticket = (await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: detailInclude,
    })) as DetailRow | null;

    if (!ticket) return ticketNotFound(res);
    return res.status(200).json({ data: toStaffDetail(ticket) });
  } catch (error) {
    console.error("Failed to load staff ticket", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch ticket",
      },
    });
  }
}

/**
 * PATCH /api/staff/tickets/:id/assignment — claim (self-assign), reassign,
 * or unassign (`{ "ownerId": number | null }`). The owner, when present,
 * must be an active IT Staff user: inactive users, Requesters, and
 * Administrators are rejected (spec BR-11/BR-16). Only IT Staff may invoke
 * this operation (route guard); the guard runs before any ticket lookup so
 * a Requester always sees 403 here, never ticket data.
 */
export async function updateTicketAssignment(req: Request, res: Response) {
  const ticketId = staffTicketId(req);
  if (!ticketId) return ticketNotFound(res);

  const { ownerId } = req.body ?? {};
  if (ownerId !== null && !Number.isInteger(ownerId)) {
    return validationError(res, "Please correct the invalid fields.", {
      ownerId: "Owner must be a user id or null to unassign.",
    });
  }
  if (typeof ownerId === "number" && ownerId <= 0) {
    return validationError(res, "Please correct the invalid fields.", {
      ownerId: "Owner must be a user id or null to unassign.",
    });
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return ticketNotFound(res);

    if (ownerId !== null) {
      const owner = (await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, isActive: true, role: true },
      })) as { id: number; isActive: boolean; role: string } | null;
      if (!owner) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Owner user not found.",
          },
        });
      }
      if (!owner.isActive || owner.role !== "IT_STAFF") {
        return validationError(res, "Please correct the invalid fields.", {
          ownerId: "Owner must be an active IT Staff user.",
        });
      }
    }

    const updated = (await prisma.ticket.update({
      where: { id: ticketId },
      data: { ticketOwnerId: ownerId },
      include: detailInclude,
    })) as DetailRow;
    return res.status(200).json({ data: toStaffDetail(updated) });
  } catch (error) {
    console.error("Failed to update ticket assignment", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to update assignment",
      },
    });
  }
}

/**
 * PATCH /api/staff/tickets/:id/priority — sets IT Priority only.
 * Requested Priority is never modified by this endpoint (spec BR-12).
 */
export async function updateTicketPriority(req: Request, res: Response) {
  const ticketId = staffTicketId(req);
  if (!ticketId) return ticketNotFound(res);

  const { itPriority } = req.body ?? {};
  if (!isStaffPriority(itPriority)) {
    return validationError(res, "Please correct the invalid fields.", {
      itPriority: "IT Priority must be LOW, MEDIUM, or HIGH.",
    });
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return ticketNotFound(res);

    const updated = (await prisma.ticket.update({
      where: { id: ticketId },
      data: { itPriority },
      include: detailInclude,
    })) as DetailRow;
    return res.status(200).json({ data: toStaffDetail(updated) });
  } catch (error) {
    console.error("Failed to update ticket priority", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to update priority",
      },
    });
  }
}

/**
 * PATCH /api/staff/tickets/:id/status — enforces the 8-state transition
 * matrix server-side. Unknown values (including legacy PENDING) are 400;
 * well-formed but disallowed transitions are 409 naming the transition.
 */
export async function updateTicketStatus(req: Request, res: Response) {
  const ticketId = staffTicketId(req);
  if (!ticketId) return ticketNotFound(res);

  const { status } = req.body ?? {};
  if (!isStaffStatus(status)) {
    return validationError(
      res,
      "Please correct the invalid fields.",
      {
        status:
          status === "PENDING"
            ? "Legacy PENDING is no longer accepted; it was migrated to WAITING_FOR_REQUESTER."
            : "Status must be one of NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED.",
      },
    );
  }

  try {
    const prisma = getPrisma();
    const ticket = (await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    })) as { id: number; status: string } | null;
    if (!ticket) return ticketNotFound(res);

    if (!allowedNextStatuses(ticket.status).includes(status)) {
      return res.status(409).json({
        error: {
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot change status from ${String(ticket.status).replaceAll("_", " ")} to ${String(status).replaceAll("_", " ")}.`,
        },
      });
    }

    const updated = (await prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
      include: detailInclude,
    })) as DetailRow;
    return res.status(200).json({ data: toStaffDetail(updated) });
  } catch (error) {
    console.error("Failed to update ticket status", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to update status",
      },
    });
  }
}
