// Actions Taken handlers (docs/lab-04/api-spec.md §1).
//
// Routes are guarded in app.ts:
//   POST   /api/staff/tickets/:id/actions-taken                       IT Staff | Administrator
//   GET    /api/staff/tickets/:id/actions-taken                       IT Staff | Administrator
//   PATCH  /api/staff/tickets/:id/actions-taken/:actionId             IT Staff | Administrator
//   GET    /api/tickets/:id/actions-taken                             Requester (own tickets only)
//
// Every write runs inside a transaction that first locks the parent Ticket row
// (BR-07). The actor is always the authenticated session user — `performedById`
// /`followUpResolvedById` are never read from the request body (BR-01).

import type { Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import { ownedTicketFilter } from "../../middleware/authorize.middleware.js";
import { getNow } from "../../utils/clock.js";
import { lockActionRow, withTicketLock } from "../../utils/tx.js";
import {
  authorizeActionFields,
  checkExpectedUpdatedAt,
  evaluateActionPatch,
  toActionShape,
  validateActionCreate,
  type ActionRecord,
} from "./actions-taken.service.js";

const actionInclude = {
  performedBy: { select: { id: true, name: true, role: true } },
  resolvedBy: { select: { id: true, name: true, role: true } },
} as const;

interface PrismaLike {
  ticket: {
    findUnique: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
  };
  user: { findUnique: (args: unknown) => Promise<unknown> };
  actionTaken: {
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
}

function parsePositiveId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function ticketNotFound(res: Response) {
  return res.status(404).json({
    error: { code: "NOT_FOUND", message: "Ticket not found." },
  });
}

function actionNotFound(res: Response) {
  return res.status(404).json({
    error: { code: "NOT_FOUND", message: "Action entry not found." },
  });
}

function validationError(res: Response, message: string, fields?: Record<string, string>) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function internalError(res: Response, message: string) {
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message },
  });
}

function versionConflict(res: Response, currentUpdatedAt: string) {
  return res.status(409).json({
    error: {
      code: "VERSION_CONFLICT",
      message: "This ticket changed since you loaded it. Reload and try again.",
    },
    data: { currentUpdatedAt },
  });
}

function malformedVersion(res: Response) {
  return validationError(res, "Please correct the invalid fields.", {
    expectedUpdatedAt: "expectedUpdatedAt must be a valid ISO-8601 timestamp.",
  });
}

// ---------------------------------------------------------------------------
// GET (shared by staff + requester)
// ---------------------------------------------------------------------------

async function listActions(client: PrismaLike, ticketId: number) {
  const entries = (await client.actionTaken.findMany({
    where: { ticketId },
    include: actionInclude,
    orderBy: [{ actionDate: "asc" }, { id: "asc" }],
  })) as Array<ActionRecord & {
    performedBy: { id: number; name: string; role: string };
    resolvedBy: { id: number; name: string; role: string } | null;
  }>;
  return entries.map(toActionShape);
}

/** GET /api/staff/tickets/:id/actions-taken — IT Staff / Administrator. */
export async function getStaffActions(req: Request, res: Response) {
  const ticketId = parsePositiveId(req.params.id);
  if (!ticketId) return ticketNotFound(res);

  try {
    const prisma = getPrisma() as unknown as PrismaLike;
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) return ticketNotFound(res);

    return res.status(200).json({ data: await listActions(prisma, ticketId) });
  } catch (error) {
    console.error("Failed to load actions taken", error);
    return internalError(res, "Unable to fetch actions taken");
  }
}

/** GET /api/tickets/:id/actions-taken — Requester, own tickets only. */
export async function getRequesterActions(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
    });
  }
  const ticketId = parsePositiveId(req.params.id);
  if (!ticketId) return ticketNotFound(res);

  try {
    const prisma = getPrisma() as unknown as PrismaLike;
    const user = (await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, isActive: true, legacyRequesterId: true },
    })) as { id: number; isActive: boolean; legacyRequesterId: number | null } | null;
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
      });
    }

    // BR-09: another user's ticket is hidden — 404, never 403.
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...ownedTicketFilter({ id: user.id, legacyRequesterId: user.legacyRequesterId }),
      },
      select: { id: true },
    });
    if (!ticket) return ticketNotFound(res);

    return res.status(200).json({ data: await listActions(prisma, ticketId) });
  } catch (error) {
    console.error("Failed to load requester actions taken", error);
    return internalError(res, "Unable to fetch actions taken");
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

/** POST /api/staff/tickets/:id/actions-taken — IT Staff / Administrator. */
export async function createAction(req: Request, res: Response) {
  const ticketId = parsePositiveId(req.params.id);
  if (!ticketId) return ticketNotFound(res);

  const validation = validateActionCreate(req.body);
  if (!validation.ok) {
    return validationError(res, "Please correct the invalid fields.", validation.fields);
  }

  try {
    const prisma = getPrisma() as unknown as PrismaLike;
    const actorId = req.user!.id;

    const created = await withTicketLock(prisma, ticketId, async (tx) => {
      const client = tx as PrismaLike;
      const ticket = await client.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });
      if (!ticket) return null;

      return client.actionTaken.create({
        data: {
          ticketId,
          performedById: actorId,
          // BR-14: stamped from the injectable app clock, passed explicitly.
          actionDate: getNow(),
          description: validation.value.description,
          result: validation.value.result,
          followUpRequired: validation.value.followUpRequired,
          followUpNote: validation.value.followUpNote,
          attachmentNotes: validation.value.attachmentNotes,
        },
        include: actionInclude,
      });
    });

    if (!created) return ticketNotFound(res);
    return res
      .status(201)
      .json({ data: toActionShape(created as Parameters<typeof toActionShape>[0]) });
  } catch (error) {
    console.error("Failed to create action taken", error);
    return internalError(res, "Unable to create action entry");
  }
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

const actionRecordSelect = {
  id: true,
  ticketId: true,
  performedById: true,
  actionDate: true,
  description: true,
  result: true,
  followUpRequired: true,
  followUpNote: true,
  followUpResolvedAt: true,
  followUpResolvedById: true,
  attachmentNotes: true,
  updatedAt: true,
} as const;

/** PATCH /api/staff/tickets/:id/actions-taken/:actionId — IT Staff / Administrator. */
export async function patchAction(req: Request, res: Response) {
  const ticketId = parsePositiveId(req.params.id);
  if (!ticketId) return ticketNotFound(res);
  const actionId = parsePositiveId(req.params.actionId);
  if (!actionId) return actionNotFound(res);

  const actor = { id: req.user!.id, role: req.user!.role };

  try {
    const prisma = getPrisma() as unknown as PrismaLike;

    const outcome = await withTicketLock(prisma, ticketId, async (tx) => {
      const client = tx as PrismaLike;
      const ticket = await client.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });
      if (!ticket) return { kind: "ticket_not_found" } as const;

      // BR-07: lock the action row too (when it exists).
      await lockActionRow(tx, actionId);

      const stored = (await client.actionTaken.findUnique({
        where: { id: actionId },
        select: actionRecordSelect,
      })) as ActionRecord | null;
      // BR-09: no cross-ticket id oracle — a mismatched entry is 404.
      if (!stored || stored.ticketId !== ticketId) {
        return { kind: "action_not_found" } as const;
      }

      // BR-06 step (2): author/admin key-presence authorization.
      const authFailure = authorizeActionFields(req.body, actor, stored.performedById);
      if (authFailure) {
        return {
          kind: "patch_error",
          status: authFailure.status,
          code: authFailure.code,
          message: authFailure.message,
          fields: authFailure.fields,
        } as const;
      }

      // BR-06 step (3): version conflict against the post-lock re-read.
      const version = checkExpectedUpdatedAt(req.body?.expectedUpdatedAt, stored.updatedAt);
      if (!version.ok) {
        if (version.kind === "malformed") return { kind: "malformed_version" } as const;
        return { kind: "version_conflict", currentUpdatedAt: version.currentUpdatedAt } as const;
      }

      // BR-06 steps (4) + (5): field validation on M, then resolve precondition.
      const evaluation = evaluateActionPatch(stored, req.body, actor);
      if (!evaluation.ok) {
        return {
          kind: "patch_error",
          status: evaluation.status,
          code: evaluation.code,
          message: evaluation.message,
          fields: evaluation.fields,
        } as const;
      }

      const updated = await client.actionTaken.update({
        where: { id: actionId },
        data: evaluation.data,
        include: actionInclude,
      });
      return { kind: "ok", updated } as const;
    });

    switch (outcome.kind) {
      case "ticket_not_found":
        return ticketNotFound(res);
      case "action_not_found":
        return actionNotFound(res);
      case "malformed_version":
        return malformedVersion(res);
      case "version_conflict":
        return versionConflict(res, outcome.currentUpdatedAt);
      case "patch_error":
        return res.status(outcome.status).json({
          error: {
            code: outcome.code,
            message: outcome.message,
            ...(outcome.fields ? { fields: outcome.fields } : {}),
          },
        });
      case "ok":
        return res
          .status(200)
          .json({ data: toActionShape(outcome.updated as Parameters<typeof toActionShape>[0]) });
    }
  } catch (error) {
    console.error("Failed to update action taken", error);
    return internalError(res, "Unable to update action entry");
  }
}
