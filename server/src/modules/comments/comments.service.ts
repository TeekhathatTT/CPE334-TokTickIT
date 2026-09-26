// Public-comment service (spec FR-06/FR-09, BR-04/BR-14, api-spec.md §4).
//
// Append-only: entries record author + creation time, can never be edited or
// deleted. Content is rejected when empty/whitespace-only and limited to
// 2,000 characters. Visibility is enforced by the controller (Requester sees
// own tickets only; IT Staff / Administrator per the matrix). Internal Notes
// live in a structurally separate table/service and are never touched here.

import { getPrisma } from "../../prisma.js";

export const MAX_COMMENT_LENGTH = 2000;

export type CommentValidationError = "EMPTY" | "TOO_LONG";

export function validateCommentContent(content: unknown): {
  ok: boolean;
  value?: string;
  error?: CommentValidationError;
} {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, error: "EMPTY" };
  }
  if (content.trim().length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: "TOO_LONG" };
  }
  return { ok: true, value: content.trim() };
}

export interface CommentAuthorShape {
  id: number;
  name: string;
  role: string;
}

export interface PublicCommentShape {
  id: number;
  ticketId: number;
  author: CommentAuthorShape;
  content: string;
  createdAt: string;
}

function toCommentShape(entry: {
  id: number;
  ticketId: number;
  content: string;
  createdAt: Date;
  author: { id: number; name: string; role: string };
}): PublicCommentShape {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    author: {
      id: entry.author.id,
      name: entry.author.name,
      role: entry.author.role,
    },
    content: entry.content,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function listPublicComments(
  ticketId: number,
): Promise<PublicCommentShape[]> {
  const prisma = getPrisma();
  const entries = (await prisma.publicComment.findMany({
    where: { ticketId },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })) as Array<{
    id: number;
    ticketId: number;
    content: string;
    createdAt: Date;
    author: { id: number; name: string; role: string };
  }>;
  return entries.map(toCommentShape);
}

export async function createPublicComment(
  ticketId: number,
  authorId: number,
  content: string,
): Promise<PublicCommentShape> {
  const prisma = getPrisma();
  const entry = (await prisma.publicComment.create({
    data: { ticketId, authorId, content },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  })) as {
    id: number;
    ticketId: number;
    content: string;
    createdAt: Date;
    author: { id: number; name: string; role: string };
  };
  return toCommentShape(entry);
}
