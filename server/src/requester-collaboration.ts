import type { Request, Response } from "express";
import { getPrisma } from "./prisma.js";

function hiddenNotFound(res: Response) {
  return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
}

async function ownedTicket(req: Request) {
  const requesterId = req.authUser?.id;
  const ticketId = Number(req.params.id);
  if (!requesterId || !Number.isInteger(ticketId) || ticketId <= 0) return null;
  return getPrisma().ticket.findFirst({ where: { id: ticketId, requesterUserId: requesterId }, select: { id: true, problemAppearsResolvedAt: true } });
}

function commentInput(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getPublicComments(req: Request, res: Response) {
  const ticket = await ownedTicket(req);
  if (!ticket) return hiddenNotFound(res);
  const comments = await getPrisma().publicComment.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: "asc" }, select: { id: true, ticketId: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } });
  return res.status(200).json({ data: comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() })) });
}

export async function addPublicComment(req: Request, res: Response) {
  const ticket = await ownedTicket(req);
  if (!ticket) return hiddenNotFound(res);
  const content = commentInput(req.body?.content);
  if (!content || content.length > 2000) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Comment must contain 1 to 2,000 characters.", fields: { content: "Comment must contain 1 to 2,000 characters." } } });
  const comment = await getPrisma().publicComment.create({ data: { ticketId: ticket.id, authorId: req.authUser?.id as number, content }, select: { id: true, ticketId: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } });
  return res.status(201).json({ data: { ...comment, createdAt: comment.createdAt.toISOString() } });
}

export async function markProblemResolved(req: Request, res: Response) {
  const ticket = await ownedTicket(req);
  if (!ticket) return hiddenNotFound(res);
  if (ticket.problemAppearsResolvedAt) return res.status(200).json({ data: { ticketId: ticket.id, problemAppearsResolvedAt: ticket.problemAppearsResolvedAt.toISOString() } });
  const updated = await getPrisma().ticket.update({ where: { id: ticket.id }, data: { problemAppearsResolvedAt: new Date() }, select: { id: true, problemAppearsResolvedAt: true } });
  return res.status(200).json({ data: { ticketId: updated.id, problemAppearsResolvedAt: updated.problemAppearsResolvedAt?.toISOString() ?? null } });
}
