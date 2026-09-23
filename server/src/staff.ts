import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const VALID_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

const STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

const STAFF_SORTS = [
  "ticketNumber",
  "createdAt",
  "updatedAt",
  "requestedPriority",
  "itPriority",
  "status",
  "owner",
] as const;

const PAGE_SIZES = new Set([10, 20, 50]);

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: unknown): (typeof VALID_STATUSES)[number] | null {
  if (typeof value !== "string") return null;
  return VALID_STATUSES.includes(value as (typeof VALID_STATUSES)[number])
    ? (value as (typeof VALID_STATUSES)[number])
    : null;
}

function normalizePriority(value: unknown): (typeof VALID_PRIORITIES)[number] | null {
  if (typeof value !== "string") return null;
  return VALID_PRIORITIES.includes(value as (typeof VALID_PRIORITIES)[number])
    ? (value as (typeof VALID_PRIORITIES)[number])
    : null;
}

function requireStaff(req: Request, res: Response): boolean {
  if (!req.authUser) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    return false;
  }

  if (req.authUser.role !== "IT_STAFF") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to perform this action." } });
    return false;
  }

  return true;
}

function requireStaffOrAdmin(req: Request, res: Response): boolean {
  if (!req.authUser) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    return false;
  }

  if (req.authUser.role !== "IT_STAFF" && req.authUser.role !== "ADMINISTRATOR") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to perform this action." } });
    return false;
  }

  return true;
}

function safeUserSummary(user: { id: number; name: string; email?: string | null; role?: string | null } | null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    role: user.role,
  };
}

const staffTicketSummarySelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  requestedPriority: true,
  itPriority: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { name: true } },
  requester: { select: { id: true, name: true, email: true, role: true } },
  ticketOwner: { select: { id: true, name: true, email: true, role: true } },
} as const satisfies Prisma.TicketSelect;

type StaffTicketSummary = Prisma.TicketGetPayload<{ select: typeof staffTicketSummarySelect }>;

function mapTicketSummary(ticket: StaffTicketSummary) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    category: ticket.category?.name ?? null,
    requester: safeUserSummary(ticket.requester),
    owner: safeUserSummary(ticket.ticketOwner),
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export async function getStaffTickets(req: Request, res: Response) {
  if (!requireStaff(req, res)) return;

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const invalidSearch = search.length > 120;

  const rawStatuses = Array.isArray(req.query.status) ? req.query.status : req.query.status ? [req.query.status] : [];
  const statuses = rawStatuses
    .map((entry) => normalizeStatus(entry))
    .filter((entry): entry is (typeof VALID_STATUSES)[number] => entry !== null);

  const invalidStatus = rawStatuses.some((entry) => normalizeStatus(entry) === null && typeof entry === "string" && entry.length > 0);

  const requestedPriority = normalizePriority(req.query.requestedPriority);
  const itPriority = normalizePriority(req.query.itPriority);
  const categoryId = parsePositiveInt(req.query.categoryId);
  const ownerIdRaw = req.query.ownerId;
  const ownerId = ownerIdRaw === "unassigned" ? null : parsePositiveInt(ownerIdRaw);

  const sortKey = typeof req.query.sort === "string" && STAFF_SORTS.includes(req.query.sort as typeof STAFF_SORTS[number])
    ? req.query.sort as typeof STAFF_SORTS[number]
    : "updatedAt";
  const order = req.query.order === "asc" ? "asc" : "desc";
  const page = parsePositiveInt(req.query.page) ?? 1;
  const requestedPageSize = parsePositiveInt(req.query.pageSize) ?? 20;
  const pageSize = PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : 20;

  if (invalidSearch || invalidStatus || (req.query.page !== undefined && page === null) || (req.query.pageSize !== undefined && requestedPageSize !== 20 && requestedPageSize !== 10 && requestedPageSize !== 50) || (req.query.ownerId !== undefined && ownerIdRaw !== "unassigned" && ownerId === null)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "One or more query parameters are invalid.",
        fields: {
          ...(invalidSearch ? { search: "Search must be 120 characters or fewer." } : {}),
          ...(invalidStatus ? { status: "Status values must be valid ticket statuses." } : {}),
          ...(req.query.page !== undefined && page === null ? { page: "Page must be a positive integer." } : {}),
          ...(req.query.pageSize !== undefined && !PAGE_SIZES.has(requestedPageSize) ? { pageSize: "Page size must be 10, 20, or 50." } : {}),
          ...(req.query.ownerId !== undefined && ownerIdRaw !== "unassigned" && ownerId === null ? { ownerId: "Owner must be a positive integer or unassigned." } : {}),
        },
      },
    });
  }

  const prisma = getPrisma();

  const where: Prisma.TicketWhereInput = {};
  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { requester: { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } },
    ];
  }

  if (statuses.length > 0) where.status = { in: statuses };
  if (requestedPriority) where.requestedPriority = requestedPriority;
  if (itPriority) where.itPriority = itPriority;
  if (categoryId) where.categoryId = categoryId;
  if (ownerIdRaw === "unassigned") where.ticketOwnerId = null;
  else if (ownerId) where.ticketOwnerId = ownerId;

  const [queueTotal, totalItems, tickets] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      select: staffTicketSummarySelect,
      orderBy: getOrderBy(sortKey, order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return res.status(200).json({
    data: tickets.map(mapTicketSummary),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
      queueTotal,
      isEmpty: queueTotal === 0,
      isNoResults: queueTotal > 0 && totalItems === 0,
    },
  });
}

function getOrderBy(sortKey: string, order: "asc" | "desc"): Prisma.TicketOrderByWithRelationInput[] {
  const direction: "asc" | "desc" = order === "asc" ? "asc" : "desc";
  const fallback: Prisma.TicketOrderByWithRelationInput[] = [{ updatedAt: direction }, { id: direction }];
  switch (sortKey) {
    case "ticketNumber":
      return [{ ticketNumber: direction }, ...fallback];
    case "createdAt":
      return [{ createdAt: direction }, { id: direction }];
    case "updatedAt":
      return [{ updatedAt: direction }, { id: direction }];
    case "requestedPriority":
      return [{ requestedPriority: direction }, { id: direction }];
    case "itPriority":
      return [{ itPriority: direction }, { id: direction }];
    case "status":
      return [{ status: direction }, { id: direction }];
    case "owner":
      return [{ ticketOwner: { name: direction } }, { id: direction }];
    default:
      return fallback;
  }
}

export async function getStaffTicket(req: Request, res: Response) {
  if (!requireStaff(req, res)) return;

  const ticketId = parsePositiveInt(req.params.id);
  if (!ticketId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId },
    include: {
      requester: { select: { id: true, name: true, email: true, role: true } },
      ticketOwner: { select: { id: true, name: true, email: true, role: true } },
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      attachments: { orderBy: { id: "asc" } },
      publicComments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } },
      internalNotes: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } },
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const canClaim = ticket.ticketOwnerId === null;
  const canAssign = true;
  const canUpdatePriority = true;
  const canUpdateStatus = true;

  return res.status(200).json({
    data: {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      description: ticket.description,
      category: ticket.category?.name ?? null,
      relatedSystem: ticket.relatedSystem?.name ?? null,
      requester: safeUserSummary(ticket.requester),
      owner: safeUserSummary(ticket.ticketOwner),
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      status: ticket.status,
      ticketOwnerId: ticket.ticketOwnerId,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      attachments: {
        active: ticket.attachments.filter((attachment) => !attachment.removedAt).map((attachment) => ({
          id: attachment.id,
          originalFilename: attachment.originalFilename,
          sizeBytes: attachment.sizeBytes,
          mimeType: attachment.mimeType,
          uploadedAt: attachment.uploadedAt.toISOString(),
        })),
        removed: ticket.attachments.filter((attachment) => attachment.removedAt).map((attachment) => ({
          id: attachment.id,
          originalFilename: attachment.originalFilename,
          sizeBytes: attachment.sizeBytes,
          removedAt: attachment.removedAt?.toISOString() ?? null,
          removalReason: attachment.removalReason,
        })),
      },
      publicComments: ticket.publicComments.map((comment) => ({
        id: comment.id,
        ticketId: comment.ticketId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        author: safeUserSummary(comment.author),
      })),
      internalNotes: ticket.internalNotes.map((note) => ({
        id: note.id,
        ticketId: note.ticketId,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        author: safeUserSummary(note.author),
      })),
      actions: {
        canClaim,
        canAssign,
        canUpdatePriority,
        canUpdateStatus,
      },
    },
  });
}

export async function assignTicketOwner(req: Request, res: Response) {
  if (!requireStaff(req, res)) return;

  const ticketId = parsePositiveInt(req.params.id);
  if (!ticketId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const targetOwnerId = req.body?.ownerId === null ? null : parsePositiveInt(req.body?.ownerId);
  if (req.body?.ownerId !== null && targetOwnerId === null) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Owner must be a valid user id or null." } });
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId } });
  if (!ticket) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  if (targetOwnerId !== null) {
    const owner = await prisma.user.findFirst({
      where: { id: targetOwnerId, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!owner) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Owner must be an active IT Staff or Administrator user." } });
    }
  }

  const ownerFilter = ticket.ticketOwnerId === null
    ? { ticketOwnerId: null }
    : { ticketOwnerId: ticket.ticketOwnerId };
  const claimed = await prisma.ticket.updateMany({
    where: { id: ticketId, ...ownerFilter },
    data: { ticketOwnerId: targetOwnerId },
  });

  if (claimed.count !== 1) {
    return res.status(409).json({ error: { code: "ASSIGNMENT_CONFLICT", message: "The ticket owner changed before this assignment was saved." } });
  }

  const updated = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { requester: { select: { id: true, name: true, email: true, role: true } }, ticketOwner: { select: { id: true, name: true, email: true, role: true } }, category: { select: { name: true } }, relatedSystem: { select: { name: true } } },
  });

  if (!updated) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  return res.status(200).json({
    data: {
      id: updated.id,
      ticketNumber: updated.ticketNumber,
      summary: updated.summary,
      description: updated.description,
      category: updated.category?.name ?? null,
      relatedSystem: updated.relatedSystem?.name ?? null,
      requester: safeUserSummary(updated.requester),
      owner: safeUserSummary(updated.ticketOwner),
      requestedPriority: updated.requestedPriority,
      itPriority: updated.itPriority,
      status: updated.status,
      ticketOwnerId: updated.ticketOwnerId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function updateTicketPriority(req: Request, res: Response) {
  if (!requireStaff(req, res)) return;

  const ticketId = parsePositiveInt(req.params.id);
  if (!ticketId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const itPriority = normalizePriority(req.body?.itPriority);
  if (!itPriority) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "IT priority must be LOW, MEDIUM, or HIGH." } });
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId } });
  if (!ticket) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { itPriority },
    include: { requester: { select: { id: true, name: true, email: true, role: true } }, ticketOwner: { select: { id: true, name: true, email: true, role: true } }, category: { select: { name: true } }, relatedSystem: { select: { name: true } } },
  });

  return res.status(200).json({
    data: {
      id: updated.id,
      ticketNumber: updated.ticketNumber,
      summary: updated.summary,
      description: updated.description,
      category: updated.category?.name ?? null,
      relatedSystem: updated.relatedSystem?.name ?? null,
      requester: safeUserSummary(updated.requester),
      owner: safeUserSummary(updated.ticketOwner),
      requestedPriority: updated.requestedPriority,
      itPriority: updated.itPriority,
      status: updated.status,
      ticketOwnerId: updated.ticketOwnerId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function updateTicketStatus(req: Request, res: Response) {
  if (!requireStaff(req, res)) return;

  const ticketId = parsePositiveInt(req.params.id);
  if (!ticketId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const nextStatus = normalizeStatus(req.body?.status);
  if (!nextStatus) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Status is invalid." } });
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId } });
  if (!ticket) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const currentStatus = ticket.status as string;
  const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    return res.status(409).json({ error: { code: "STATUS_TRANSITION_INVALID", message: "This status transition is not allowed." } });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: nextStatus },
    include: { requester: { select: { id: true, name: true, email: true, role: true } }, ticketOwner: { select: { id: true, name: true, email: true, role: true } }, category: { select: { name: true } }, relatedSystem: { select: { name: true } } },
  });

  return res.status(200).json({
    data: {
      id: updated.id,
      ticketNumber: updated.ticketNumber,
      summary: updated.summary,
      description: updated.description,
      category: updated.category?.name ?? null,
      relatedSystem: updated.relatedSystem?.name ?? null,
      requester: safeUserSummary(updated.requester),
      owner: safeUserSummary(updated.ticketOwner),
      requestedPriority: updated.requestedPriority,
      itPriority: updated.itPriority,
      status: updated.status,
      ticketOwnerId: updated.ticketOwnerId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function getStaffNotes(req: Request, res: Response) {
  if (!requireStaffOrAdmin(req, res)) return;

  const ticketId = parsePositiveInt(req.params.id);
  if (!ticketId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const notes = await prisma.internalNote.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  return res.status(200).json({
    data: notes.map((note) => ({
      id: note.id,
      ticketId: note.ticketId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      author: safeUserSummary(note.author),
    })),
  });
}

export async function addStaffNote(req: Request, res: Response) {
  if (!requireStaffOrAdmin(req, res)) return;

  const ticketId = parsePositiveInt(req.params.id);
  if (!ticketId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 2000) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Note content must contain 1 to 2,000 characters.",
        fields: { content: "Note content must contain 1 to 2,000 characters." },
      },
    });
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
  }

  const note = await prisma.internalNote.create({
    data: { ticketId, authorId: req.authUser!.id, content },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  return res.status(201).json({
    data: {
      id: note.id,
      ticketId: note.ticketId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      author: safeUserSummary(note.author),
    },
  });
}
