// Actions Taken service (docs/lab-04/specification.md BR-01…BR-09,
// api-spec.md §1). Holds the pure validation/merge logic plus the shared
// shape mapper and the BR-07 gate predicate so both the controller and the
// Lab 4 unit tests exercise the same code.
//
// Nothing here touches the global `prisma` singleton: callers pass a
// transaction client (`tx`) so every query runs inside the transaction whose
// first statement locked the parent Ticket row (BR-07).

import { getNow } from "../../utils/clock.js";

export const ACTION_RESULTS = [
  "RESOLVED_STEP",
  "WORKAROUND",
  "INFO_REQUESTED",
  "ESCALATED",
  "NO_FURTHER_ACTION",
] as const;

export type ActionResult = (typeof ACTION_RESULTS)[number];

export function isActionResult(value: unknown): value is ActionResult {
  return typeof value === "string" && (ACTION_RESULTS as readonly string[]).includes(value);
}

export const DESCRIPTION_MIN = 5;
export const DESCRIPTION_MAX = 2000;
export const FOLLOW_UP_NOTE_MIN = 5;
export const FOLLOW_UP_NOTE_MAX = 1000;
export const ATTACHMENT_NOTES_MAX = 500;

/** Client-supplied server-owned fields are rejected with 400 (BR-01). */
export const SERVER_OWNED_ACTION_FIELDS = [
  "actionDate",
  "performedById",
  "followUpResolvedAt",
  "followUpResolvedById",
] as const;

/** Correctable fields; their presence alone triggers the author/admin rule. */
export const CORRECTABLE_ACTION_FIELDS = [
  "description",
  "result",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
] as const;

type CorrectableField = (typeof CORRECTABLE_ACTION_FIELDS)[number];

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export interface ActionRecord {
  id: number;
  ticketId: number;
  performedById: number;
  actionDate: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  followUpResolvedAt: Date | null;
  followUpResolvedById: number | null;
  attachmentNotes: string | null;
  updatedAt: Date;
}

interface ActionWithRelations extends ActionRecord {
  performedBy: { id: number; name: string; role: string };
  resolvedBy: { id: number; name: string; role: string } | null;
}

export interface ActionTakenShape {
  id: number;
  ticketId: number;
  actionDate: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  followUpResolvedAt: string | null;
  resolvedBy: { id: number; name: string; role: string } | null;
  attachmentNotes: string | null;
  performedBy: { id: number; name: string; role: string };
  createdAt: string;
  updatedAt: string;
}

/** Map a stored row (+ relations) to the api-spec §1 entry shape. */
export function toActionShape(entry: ActionWithRelations): ActionTakenShape {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    actionDate: entry.actionDate.toISOString(),
    description: entry.description,
    result: entry.result,
    followUpRequired: entry.followUpRequired,
    followUpNote: entry.followUpNote,
    followUpResolvedAt: entry.followUpResolvedAt
      ? entry.followUpResolvedAt.toISOString()
      : null,
    resolvedBy: entry.resolvedBy
      ? { id: entry.resolvedBy.id, name: entry.resolvedBy.name, role: entry.resolvedBy.role }
      : null,
    attachmentNotes: entry.attachmentNotes,
    performedBy: {
      id: entry.performedBy.id,
      name: entry.performedBy.name,
      role: entry.performedBy.role,
    },
    // Response-only alias: FAQ §7 — createdAt equals the immutable actionDate.
    createdAt: entry.actionDate.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export interface CreateValue {
  description: string;
  result: ActionResult;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

export type CreateValidation =
  | { ok: true; value: CreateValue }
  | { ok: false; fields: Record<string, string> };

/** Validate a POST body (BR-01/BR-02/BR-03/BR-05). */
export function validateActionCreate(body: unknown): CreateValidation {
  const fields: Record<string, string> = {};
  const record = (body ?? {}) as Record<string, unknown>;

  for (const owned of SERVER_OWNED_ACTION_FIELDS) {
    if (has(record, owned)) {
      fields[owned] = `${owned} is set by the server and must not be supplied.`;
    }
  }

  const description = typeof record.description === "string" ? record.description.trim() : "";
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    fields.description = `Description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`;
  }

  if (!isActionResult(record.result)) {
    fields.result = `Result must be one of ${ACTION_RESULTS.join(", ")}.`;
  }

  let followUpRequired = false;
  if (record.followUpRequired !== undefined) {
    if (typeof record.followUpRequired !== "boolean") {
      fields.followUpRequired = "Follow-up required must be true or false.";
    } else {
      followUpRequired = record.followUpRequired;
    }
  }

  let followUpNote: string | null = null;
  const rawNote = record.followUpNote;
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== "string") {
      fields.followUpNote = "Follow-up note must be text.";
    } else {
      followUpNote = rawNote.trim();
    }
  }
  if (followUpRequired) {
    if (followUpNote === null || followUpNote.length < FOLLOW_UP_NOTE_MIN || followUpNote.length > FOLLOW_UP_NOTE_MAX) {
      fields.followUpNote = `Follow-up note is required (${FOLLOW_UP_NOTE_MIN}–${FOLLOW_UP_NOTE_MAX} characters) when follow-up is required.`;
    }
  } else if (followUpNote !== null && followUpNote.length > 0) {
    fields.followUpNote =
      "Follow-up note must not be supplied when follow-up is not required.";
  }

  let attachmentNotes: string | null = null;
  const rawAttachment = record.attachmentNotes;
  if (rawAttachment !== undefined && rawAttachment !== null) {
    if (typeof rawAttachment !== "string") {
      fields.attachmentNotes = "Attachment notes must be text.";
    } else {
      const trimmed = rawAttachment.trim();
      if (trimmed.length > ATTACHMENT_NOTES_MAX) {
        fields.attachmentNotes = `Attachment notes must be ${ATTACHMENT_NOTES_MAX} characters or fewer.`;
      } else {
        attachmentNotes = trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      description,
      result: record.result as ActionResult,
      followUpRequired,
      followUpNote: followUpRequired ? followUpNote : null,
      attachmentNotes,
    },
  };
}

// ---------------------------------------------------------------------------
// BR-09 optimistic concurrency comparator.
// ---------------------------------------------------------------------------

export type VersionCheck =
  | { ok: true }
  | { ok: false; kind: "malformed" }
  | { ok: false; kind: "mismatch"; currentUpdatedAt: string };

/**
 * Compare the optional `expectedUpdatedAt` against the current row's
 * `updatedAt` (millisecond-exact on the canonical ISO form). Malformed input is
 * rejected — never silently ignored (BR-09).
 */
export function checkExpectedUpdatedAt(
  expected: unknown,
  current: Date,
): VersionCheck {
  if (expected === undefined) return { ok: true };
  if (typeof expected !== "string" || expected.trim() === "") {
    return { ok: false, kind: "malformed" };
  }
  const parsed = new Date(expected);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, kind: "malformed" };
  }
  if (parsed.toISOString() !== current.toISOString()) {
    return { ok: false, kind: "mismatch", currentUpdatedAt: current.toISOString() };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// BR-07 gate predicate.
// ---------------------------------------------------------------------------

interface CountCapable {
  actionTaken?: {
    count?: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
}

/**
 * Count pending follow-up rows for a ticket (BR-07):
 * `followUpRequired = TRUE AND followUpResolvedAt IS NULL`.
 * Returns 0 against a test double that does not model ActionTaken.
 */
export async function countPendingFollowUps(
  client: unknown,
  ticketId: number,
): Promise<number> {
  const capable = client as CountCapable;
  if (typeof capable.actionTaken?.count !== "function") return 0;
  return capable.actionTaken.count({
    where: { ticketId, followUpRequired: true, followUpResolvedAt: null },
  });
}

/** BR-07 precondition: `true` when the ticket has ≥1 pending follow-up. */
export async function hasPendingFollowUp(
  client: unknown,
  ticketId: number,
): Promise<boolean> {
  return (await countPendingFollowUps(client, ticketId)) > 0;
}

// ---------------------------------------------------------------------------
// PATCH evaluation (BR-06 stored-vs-merged order, T1–T4, mixed-body 403).
// ---------------------------------------------------------------------------

export interface ActionActor {
  id: number;
  role: string;
}

export interface ActionPatchFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type PatchEvaluation =
  | { ok: true; data: Record<string, unknown> }
  | ActionPatchFailure;

function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): ActionPatchFailure {
  return { ok: false, status, code, message, ...(fields ? { fields } : {}) };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Correctable-field keys present as own properties on the parsed body. */
export function presentCorrectableFields(body: unknown): CorrectableField[] {
  const record = (body ?? {}) as Record<string, unknown>;
  return CORRECTABLE_ACTION_FIELDS.filter((key) => has(record, key)) as CorrectableField[];
}

/**
 * BR-06 step (2): authorization of a field edit **by key presence** (fail
 * closed — a present key counts even when its value is `null`; `undefined`
 * from JSON parsing never counts). Returns `null` when allowed, else the 403.
 * Runs before the version check so a non-author field edit is always 403.
 */
export function authorizeActionFields(
  body: unknown,
  actor: ActionActor,
  storedAuthorId: number,
): ActionPatchFailure | null {
  const presentFields = presentCorrectableFields(body);
  const isAdmin = actor.role === "ADMINISTRATOR";
  const isAuthor = actor.role === "IT_STAFF" && actor.id === storedAuthorId;
  if (presentFields.length > 0 && !isAdmin && !isAuthor) {
    return fail(
      403,
      "FORBIDDEN",
      "Only the original author or an administrator may edit this entry.",
    );
  }
  return null;
}

/**
 * Evaluate a PATCH body against the stored row `S` (already re-read inside the
 * locked transaction). Runs BR-06 steps (4) field-validation-on-M and (5)
 * resolve-precondition after the controller has done existence/authorization/
 * version checks. Returns either the Prisma `data` to write or a safe error.
 */
export function evaluateActionPatch(
  S: ActionRecord,
  body: unknown,
  actor: ActionActor,
): PatchEvaluation {
  const record = (body ?? {}) as Record<string, unknown>;

  // (0) server-owned fields are never client-settable (BR-01).
  for (const owned of SERVER_OWNED_ACTION_FIELDS) {
    if (has(record, owned)) {
      return fail(400, "VALIDATION_ERROR", "Please correct the invalid fields.", {
        [owned]: `${owned} is set by the server and must not be supplied.`,
      });
    }
  }

  const presentFields = presentCorrectableFields(body);
  const hasMarkResolve = has(record, "markFollowUpResolved");
  const markResolve = record.markFollowUpResolved;

  // (1) empty body: at least one field key or markFollowUpResolved is required.
  if (presentFields.length === 0 && !hasMarkResolve) {
    return fail(400, "VALIDATION_ERROR", "Provide at least one field to edit or markFollowUpResolved.");
  }

  if (hasMarkResolve && markResolve !== true) {
    return fail(400, "VALIDATION_ERROR", "Please correct the invalid fields.", {
      markFollowUpResolved: "markFollowUpResolved must be true.",
    });
  }

  // (2) field-presence authorization (fail-closed, by key presence).
  const authFailure = authorizeActionFields(body, actor, S.performedById);
  if (authFailure) return authFailure;

  // (3) merge: S + present correctable keys → M.
  const merged = {
    description: S.description,
    result: S.result,
    followUpRequired: S.followUpRequired,
    followUpNote: S.followUpNote,
    attachmentNotes: S.attachmentNotes,
  } as Record<string, unknown>;
  for (const key of presentFields) {
    merged[key] = record[key];
  }

  // (4) field validation on the merged row M.
  const fields: Record<string, string> = {};

  if (has(record, "description")) {
    if (typeof merged.description !== "string") {
      fields.description = "Description must be text.";
    } else {
      const trimmed = merged.description.trim();
      if (trimmed.length < DESCRIPTION_MIN || trimmed.length > DESCRIPTION_MAX) {
        fields.description = `Description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`;
      }
    }
  }

  if (has(record, "result") && !isActionResult(merged.result)) {
    fields.result = `Result must be one of ${ACTION_RESULTS.join(", ")}.`;
  }

  if (has(record, "followUpRequired") && typeof merged.followUpRequired !== "boolean") {
    fields.followUpRequired = "Follow-up required must be true or false.";
  }

  if (has(record, "attachmentNotes")) {
    if (merged.attachmentNotes !== null && typeof merged.attachmentNotes !== "string") {
      fields.attachmentNotes = "Attachment notes must be text.";
    } else if (typeof merged.attachmentNotes === "string" && merged.attachmentNotes.trim().length > ATTACHMENT_NOTES_MAX) {
      fields.attachmentNotes = `Attachment notes must be ${ATTACHMENT_NOTES_MAX} characters or fewer.`;
    }
  }

  const hasNote = has(record, "followUpNote");
  const suppliedNote = record.followUpNote;
  if (hasNote && suppliedNote !== null && typeof suppliedNote !== "string") {
    fields.followUpNote = "Follow-up note must be text.";
  }
  const mergedFollowUp = merged.followUpRequired === true;
  if (mergedFollowUp) {
    const mergedNote = hasNote
      ? typeof suppliedNote === "string"
        ? suppliedNote.trim()
        : null
      : S.followUpNote;
    if (mergedNote === null || mergedNote.length < FOLLOW_UP_NOTE_MIN || mergedNote.length > FOLLOW_UP_NOTE_MAX) {
      fields.followUpNote = `Follow-up note is required (${FOLLOW_UP_NOTE_MIN}–${FOLLOW_UP_NOTE_MAX} characters) when follow-up is required.`;
    }
  } else if (hasNote && isNonEmptyString(suppliedNote)) {
    fields.followUpNote = "Follow-up note must not be supplied when follow-up is not required.";
  }

  if (Object.keys(fields).length > 0) {
    return fail(400, "VALIDATION_ERROR", "Please correct the invalid fields.", fields);
  }

  // (5) explicit flag flip transitions T1–T4 (only on a boolean value change).
  const flagPresent = has(record, "followUpRequired");
  const flagValue = record.followUpRequired;
  const isFlip =
    flagPresent &&
    typeof flagValue === "boolean" &&
    flagValue !== S.followUpRequired;

  let clearResolution = false;
  let preserveStoredNote = false;
  let requireFreshNote = false;

  if (isFlip) {
    const storedPending = S.followUpRequired && S.followUpResolvedAt === null;
    const storedResolved = S.followUpRequired && S.followUpResolvedAt !== null;
    const storedClear = !S.followUpRequired && S.followUpResolvedAt === null;
    const storedReArm = !S.followUpRequired && S.followUpResolvedAt !== null;
    const target = merged.followUpRequired === true;

    if (storedPending && !target) {
      // T1 — pending true→false: resolve first (two-step).
      return fail(
        400,
        "VALIDATION_ERROR",
        "Resolve the pending follow-up before turning follow-up off.",
        { followUpRequired: "Resolve the pending follow-up before turning it off." },
      );
    }
    if (storedResolved && !target) {
      // T2 — resolved true→false: preserve history.
      preserveStoredNote = true;
    }
    if (storedClear && target) {
      // T3 — all-clear false→true: new pending needs a fresh note.
      requireFreshNote = true;
    }
    if (storedReArm && target) {
      // T4 — re-arm on a resolved row: clear resolution, fresh note.
      requireFreshNote = true;
      clearResolution = true;
    }
  }

  if (requireFreshNote) {
    if (!hasNote || !isNonEmptyString(suppliedNote)) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "A new follow-up note is required when arming follow-up.",
        { followUpNote: `Follow-up note is required (${FOLLOW_UP_NOTE_MIN}–${FOLLOW_UP_NOTE_MAX} characters).` },
      );
    }
  }

  // (6) resolve precondition on M + S.
  let resolveNow = false;
  if (hasMarkResolve) {
    if (S.followUpResolvedAt !== null) {
      return fail(409, "FOLLOW_UP_ALREADY_RESOLVED", "This follow-up has already been resolved.");
    }
    if (merged.followUpRequired !== true) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "There is no pending follow-up to resolve.",
        { markFollowUpResolved: "There is no pending follow-up to resolve." },
      );
    }
    resolveNow = true;
  }

  // (7) assemble the Prisma update payload.
  const data: Record<string, unknown> = {};

  if (has(record, "description")) data.description = (merged.description as string).trim();
  if (has(record, "result")) data.result = merged.result;
  if (flagPresent) data.followUpRequired = merged.followUpRequired;

  if (clearResolution) {
    data.followUpResolvedAt = null;
    data.followUpResolvedById = null;
  }

  // Follow-up note handling. A resolved-row T2 flip preserves the stored note
  // verbatim (BR-05 exemption); an explicit note only ever applies when the
  // merged flag is true.
  if (!preserveStoredNote && mergedFollowUp && hasNote && typeof suppliedNote === "string") {
    data.followUpNote = suppliedNote.trim();
  }

  if (has(record, "attachmentNotes")) {
    const raw = merged.attachmentNotes;
    data.attachmentNotes =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  }

  if (resolveNow) {
    data.followUpResolvedAt = getNow();
    data.followUpResolvedById = actor.id;
  }

  return { ok: true, data };
}
