// IT Staff queue + ticket-operation helpers (api-spec.md §3, spec BR-11,
// BR-12, BR-13, BR-16).
//
// The transition matrix below is the server-side enforcement point: the
// frontend dropdown only mirrors it, PATCH /status re-checks every write.

export const STAFF_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type StaffPriority = (typeof STAFF_PRIORITIES)[number];

/**
 * Allowed next statuses per current status (api-spec.md §3 matrix).
 * Lab 3 has no Actions Taken gating (spec BR-15): Resolved/Closed are
 * blocked only when the matrix says so.
 */
export const STATUS_TRANSITIONS: Record<StaffStatus, StaffStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

/** Statuses the UI may offer from a given current status. */
export function allowedNextStatuses(current: string): StaffStatus[] {
  if (!isStaffStatus(current)) return [];
  return STATUS_TRANSITIONS[current];
}

export function isStaffStatus(value: unknown): value is StaffStatus {
  return (
    typeof value === "string" &&
    (STAFF_STATUSES as readonly string[]).includes(value)
  );
}

export function isStaffPriority(value: unknown): value is StaffPriority {
  return (
    typeof value === "string" &&
    (STAFF_PRIORITIES as readonly string[]).includes(value)
  );
}

export const STAFF_SORTS = [
  "ticketNumber",
  "createdAt",
  "updatedAt",
  "requestedPriority",
  "itPriority",
  "status",
  "owner",
] as const;

export type StaffSort = (typeof STAFF_SORTS)[number];

export function isStaffSort(value: unknown): value is StaffSort {
  return (
    typeof value === "string" &&
    (STAFF_SORTS as readonly string[]).includes(value)
  );
}

export interface StaffQueueFilters {
  search: string;
  statuses: StaffStatus[];
  requestedPriority?: StaffPriority;
  itPriority?: StaffPriority;
  categoryId?: number;
  /** Numeric owner user id, or the string "unassigned". */
  ownerId?: number | "unassigned";
  sort: StaffSort;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

function parsePositiveInt(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}

function splitStatuses(raw: string | string[]): string[] {
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts.flatMap((part) => String(part).split(",")).map((part) => part.trim()).filter((part) => part !== "");
}

/**
 * Validate the staff queue query string (api-spec.md §3). Invalid values
 * return 400 field errors — never a silent fallback or a 500.
 */
export function parseStaffQueueQuery(query: Record<string, unknown>): {
  ok: boolean;
  filters?: StaffQueueFilters;
  fields?: Record<string, string>;
} {
  const fields: Record<string, string> = {};

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search.length > 120) {
    fields.search = "Search must be 120 characters or fewer.";
  }

  let statuses: StaffStatus[] = [];
  if (query.status !== undefined && query.status !== "") {
    const raw = splitStatuses(query.status as string | string[]);
    const invalid = raw.filter((value) => !isStaffStatus(value));
    if (invalid.length > 0) {
      fields.status =
        invalid.includes("PENDING")
          ? "Legacy PENDING is no longer accepted; it was migrated to WAITING_FOR_REQUESTER."
          : "Status must be one or more of NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED.";
    } else {
      statuses = raw as StaffStatus[];
    }
  }

  let requestedPriority: StaffPriority | undefined;
  if (query.requestedPriority !== undefined && query.requestedPriority !== "") {
    if (!isStaffPriority(query.requestedPriority)) {
      fields.requestedPriority = "Requested Priority must be LOW, MEDIUM, or HIGH.";
    } else {
      requestedPriority = query.requestedPriority;
    }
  }

  let itPriority: StaffPriority | undefined;
  if (query.itPriority !== undefined && query.itPriority !== "") {
    if (!isStaffPriority(query.itPriority)) {
      fields.itPriority = "IT Priority must be LOW, MEDIUM, or HIGH.";
    } else {
      itPriority = query.itPriority;
    }
  }

  let categoryId: number | undefined;
  if (query.categoryId !== undefined && query.categoryId !== "") {
    const parsed = parsePositiveInt(query.categoryId);
    if (!parsed) {
      fields.categoryId = "Category must be a positive integer.";
    } else {
      categoryId = parsed;
    }
  }

  let ownerId: number | "unassigned" | undefined;
  if (query.ownerId !== undefined && query.ownerId !== "") {
    if (query.ownerId === "unassigned") {
      ownerId = "unassigned";
    } else {
      const parsed = parsePositiveInt(query.ownerId);
      if (!parsed) {
        fields.ownerId = 'Owner must be a user id or "unassigned".';
      } else {
        ownerId = parsed;
      }
    }
  }

  let sort: StaffSort = "updatedAt";
  if (query.sort !== undefined && query.sort !== "") {
    if (!isStaffSort(query.sort)) {
      fields.sort =
        "Sort must be one of ticketNumber, createdAt, updatedAt, requestedPriority, itPriority, status, owner.";
    } else {
      sort = query.sort;
    }
  }

  let order: "asc" | "desc" = "desc";
  if (query.order !== undefined && query.order !== "") {
    if (query.order !== "asc" && query.order !== "desc") {
      fields.order = 'Order must be "asc" or "desc".';
    } else {
      order = query.order;
    }
  }

  let page = 1;
  if (query.page !== undefined && query.page !== "") {
    const parsed = Number(query.page);
    if (!Number.isInteger(parsed) || parsed < 1) {
      fields.page = "Page must be an integer of 1 or greater.";
    } else {
      page = parsed;
    }
  }

  let pageSize = 20;
  if (query.pageSize !== undefined && query.pageSize !== "") {
    const parsed = Number(query.pageSize);
    if (parsed !== 10 && parsed !== 20 && parsed !== 50) {
      fields.pageSize = "Page size must be 10, 20, or 50.";
    } else {
      pageSize = parsed;
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    filters: {
      search,
      statuses,
      requestedPriority,
      itPriority,
      categoryId,
      ownerId,
      sort,
      order,
      page,
      pageSize,
    },
  };
}

/**
 * Prisma `where` for the queue. Search is a case-insensitive partial match
 * on ticket number, summary, description, requester name/email (legacy row
 * and User row alike).
 */
export function buildStaffQueueWhere(filters: StaffQueueFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }
  if (filters.requestedPriority) {
    where.requestedPriority = filters.requestedPriority;
  }
  if (filters.itPriority) {
    where.itPriority = filters.itPriority;
  }
  if (filters.categoryId !== undefined) {
    where.categoryId = filters.categoryId;
  }
  if (filters.ownerId !== undefined) {
    where.ticketOwnerId = filters.ownerId === "unassigned" ? null : filters.ownerId;
  }

  if (filters.search) {
    const contains = { contains: filters.search, mode: "insensitive" as const };
    where.OR = [
      { ticketNumber: contains },
      { summary: contains },
      { description: contains },
      { requester: { name: contains } },
      { requester: { email: contains } },
      { requesterUser: { name: contains } },
      { requesterUser: { email: contains } },
    ];
  }

  return where;
}

/**
 * Prisma `orderBy` for the queue. Enum fields sort in Postgres enum order
 * (LOW < MEDIUM < HIGH for priorities). The caller appends `{ id: "desc" }`
 * as a stable tiebreak.
 */
export function buildStaffQueueOrderBy(
  sort: StaffSort,
  order: "asc" | "desc",
): Record<string, unknown> {
  if (sort === "owner") {
    return { ticketOwner: { name: order } };
  }
  return { [sort]: order };
}
