// Internal-note service (spec FR-09, BR-04/BR-14, api-spec.md §4).
//
// Append-only like Public Comments but a structurally separate table and
// service by design, so a bug cannot leak a note as a public comment (or
// vice versa). Entries record author + creation time, reject
// empty/whitespace content, and cap content at 2,000 characters. Visibility
// is enforced by the controller + route guard (IT Staff / Administrator
// only — Requesters never reach this service through the API).

import { getPrisma } from "../../prisma.js";

export const MAX_NOTE_LENGTH = 2000;

export type NoteValidationError = "EMPTY" | "TOO_LONG";

export function validateNoteContent(content: unknown): {
  ok: boolean;
  value?: string;
  error?: NoteValidationError;
} {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, error: "EMPTY" };
  }
  if (content.trim().length > MAX_NOTE_LENGTH) {
    return { ok: false, error: "TOO_LONG" };
  }
  return { ok: true, value: content.trim() };
}

export interface InternalNoteShape {
  id: number;
  ticketId: number;
  author: { id: number; name: string; role: string };
  content: string;
  createdAt: string;
}

function toNoteShape(entry: {
  id: number;
  ticketId: number;
  content: string;
  createdAt: Date;
  author: { id: number; name: string; role: string };
}): InternalNoteShape {
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

export async function listInternalNotes(ticketId: number): Promise<InternalNoteShape[]> {
  const prisma = getPrisma();
  const entries = (await prisma.internalNote.findMany({
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
  return entries.map(toNoteShape);
}

export async function createInternalNote(
  ticketId: number,
  authorId: number,
  content: string,
): Promise<InternalNoteShape> {
  const prisma = getPrisma();
  const entry = (await prisma.internalNote.create({
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
  return toNoteShape(entry);
}
