// LOCAL-DEV-ONLY SEED CREDENTIALS — MUST NEVER BE REUSED OUTSIDE THIS REPO.
// All seeded users use the clearly-fake local-dev password `Password123!`
// (hashed with scrypt per specification.md BR-08 / api-spec.md §7, fresh random
// 16-byte salt per user) with mustChangePassword=true so the first login forces
// rotation. No real secrets are stored here; no email delivery is attempted.
// This seed is idempotent (safe to run repeatedly): Categories/RelatedSystems/
// Requesters/Users/Tickets use `upsert` by unique keys (name/email/ticketNumber,
// emails normalized as trimmed+lowercased per BR-18); PublicComment/InternalNote
// rows are append-only per BR-14 — seed examples are ensured per ticket with an
// existence check (findFirst by ticketId + content) and created only when missing,
// never deleted, so reruns converge without erasing authored history.
// Lab 4 Actions Taken rows follow the same existence-check pattern (findFirst by
// ticketId + description): reruns never duplicate rows and never overwrite
// follow-up resolution state changed by tests or API exercise (a seeded pending
// item that was explicitly resolved stays resolved).
// Spec: docs/lab-03/specification.md §8 + BR-26 (4 active + 1 inactive Requester,
// 3 active + 1 inactive IT Staff, 1 active Administrator, distributed tickets,
// safe example comments/notes). Strategy is reference (not merge): Requester rows
// are preserved and Requester-role Users link via legacyRequesterId.
// Lab 4 (docs/lab-04/specification.md §7 + BR-07/BR-08/BR-12): one extra active
// Requester with zero tickets (Kevin Thompson) so the requester dashboard empty
// states are demonstrable; Actions Taken rows covering zero/one/several actions
// across all 8 ticket statuses, a gate-blocking pending follow-up, completed
// follow-up cycles, non-owner authorship (BR-06), and all five `result` values.

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

// scrypt per specification.md BR-08 / api-spec.md §7 (NOT bcrypt):
// crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 MiB }),
// 16-byte random salt, stored as `scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>`.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;
  const maxmem = 32 * 1024 * 1024;
  const derived = crypto.scryptSync(Buffer.from(password, "utf8"), salt, keyLen, {
    N,
    r,
    p,
    maxmem,
  });
  return `scrypt$N=${N},r=${r},p=${p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const normalizeEmail = (email) => email.trim().toLowerCase();
const DEV_PASSWORD = "Password123!";

const requesters = [
  {
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    isActive: true,
  },
  {
    name: "Michael Chen",
    email: "michael.chen@example.com",
    isActive: true,
  },
  {
    name: "Sarah Williams",
    email: "sarah.williams@example.com",
    isActive: true,
  },
  {
    name: "Emily Davis",
    email: "emily.davis@example.com",
    isActive: true,
  },
  {
    name: "David Brown",
    email: "david.brown@example.com",
    isActive: false,
  },
  // Lab 4 zero-dashboard case (docs/lab-04/specification.md BR-08/BR-12): an
  // active Requester who owns no tickets, so every requester-dashboard card
  // renders its empty state for this user.
  {
    name: "Kevin Thompson",
    email: "kevin.thompson@example.com",
    isActive: true,
  },
];

const categories = [
  {
    name: "Account and Access",
    isActive: true,
  },
  {
    name: "Hardware",
    isActive: true,
  },
  {
    name: "Software",
    isActive: true,
  },
  {
    name: "Network",
    isActive: true,
  },
];

const relatedSystems = [
  {
    name: "Corporate Laptop",
    isActive: true,
  },
  {
    name: "Campus Wi-Fi",
    isActive: true,
  },
  {
    name: "Email",
    isActive: true,
  },
  {
    name: "VPN",
    isActive: true,
  },
  {
    name: "Legacy System",
    isActive: false,
  },
];

// Lab 3 users + Lab 4 zero-dashboard requester: 6 Requester-role (5 active +
// 1 inactive), 4 IT Staff (3 active + 1 inactive), 1 active Administrator
// (Lab 3 spec §8 / BR-26 plus Lab 4 spec §7/BR-08 zero case). Requester-role
// emails match Requester rows for the legacyRequesterId link (reference strategy).
const seedUsers = [
  { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER", isActive: true },
  { name: "Michael Chen", email: "michael.chen@example.com", role: "REQUESTER", isActive: true },
  { name: "Sarah Williams", email: "sarah.williams@example.com", role: "REQUESTER", isActive: true },
  { name: "Emily Davis", email: "emily.davis@example.com", role: "REQUESTER", isActive: true },
  { name: "David Brown", email: "david.brown@example.com", role: "REQUESTER", isActive: false },
  // Lab 4: active Requester with zero tickets (requester-dashboard empty states).
  { name: "Kevin Thompson", email: "kevin.thompson@example.com", role: "REQUESTER", isActive: true },
  { name: "Priya Patel", email: "priya.patel@example.com", role: "IT_STAFF", isActive: true },
  { name: "Tom Nguyen", email: "tom.nguyen@example.com", role: "IT_STAFF", isActive: true },
  { name: "Lisa Garcia", email: "lisa.garcia@example.com", role: "IT_STAFF", isActive: true },
  { name: "Mark Lee", email: "mark.lee@example.com", role: "IT_STAFF", isActive: false },
  { name: "Alice Admin", email: "alice.admin@example.com", role: "ADMINISTRATOR", isActive: true },
];

// Realistic tickets spanning all 8 statuses, requested + IT priorities, and
// assigned/unassigned ownership. Owners (when set) are active IT Staff only
// (BR-11/BR-16); Administrators and inactive users are never owners.
const seedTickets = [
  {
    ticketNumber: "TKT-2026-000001",
    requesterEmail: "jennifer.anderson@example.com",
    categoryName: "Hardware",
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description: "The laptop battery drains within two hours of unplugging it.",
    requestedPriority: "MEDIUM",
    itPriority: null,
    status: "NEW",
    ownerEmail: null,
    problemAppearsResolvedAt: null,
  },
  {
    ticketNumber: "TKT-2026-000002",
    requesterEmail: "michael.chen@example.com",
    categoryName: "Software",
    relatedSystemName: "Email",
    summary: "Email client fails to sync new messages",
    description: "The desktop email client stopped syncing yesterday. Webmail still works.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    status: "OPEN",
    ownerEmail: "priya.patel@example.com",
    problemAppearsResolvedAt: null,
  },
  {
    ticketNumber: "TKT-2026-000003",
    requesterEmail: "sarah.williams@example.com",
    categoryName: "Network",
    relatedSystemName: "Campus Wi-Fi",
    summary: "Intermittent Wi-Fi drops in the library",
    description: "Wi-Fi disconnects every 20 minutes in the north library wing.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    status: "IN_PROGRESS",
    ownerEmail: "tom.nguyen@example.com",
    problemAppearsResolvedAt: null,
  },
  {
    ticketNumber: "TKT-2026-000004",
    requesterEmail: "emily.davis@example.com",
    categoryName: "Account and Access",
    relatedSystemName: "VPN",
    summary: "VPN prompts for verification every hour",
    description: "VPN keeps asking for re-verification during long sessions.",
    requestedPriority: "LOW",
    itPriority: "LOW",
    status: "WAITING_FOR_REQUESTER",
    ownerEmail: "lisa.garcia@example.com",
    problemAppearsResolvedAt: null,
  },
  {
    ticketNumber: "TKT-2026-000005",
    requesterEmail: "jennifer.anderson@example.com",
    categoryName: "Hardware",
    relatedSystemName: "Corporate Laptop",
    summary: "External monitor flickers when docked",
    description: "The external monitor flickers occasionally when connected through the dock.",
    requestedPriority: "HIGH",
    itPriority: "MEDIUM",
    status: "RESOLVED",
    ownerEmail: "priya.patel@example.com",
    problemAppearsResolvedAt: new Date("2026-09-20T10:00:00Z"),
  },
  {
    ticketNumber: "TKT-2026-000006",
    requesterEmail: "michael.chen@example.com",
    categoryName: "Software",
    relatedSystemName: "Email",
    summary: "Spell checker flags common words",
    description: "The editor spell checker started flagging common words after the update.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    status: "CLOSED",
    ownerEmail: "tom.nguyen@example.com",
    problemAppearsResolvedAt: new Date("2026-09-18T14:30:00Z"),
  },
  {
    ticketNumber: "TKT-2026-000007",
    requesterEmail: "sarah.williams@example.com",
    categoryName: "Network",
    relatedSystemName: "Campus Wi-Fi",
    summary: "Slow file transfers on lab machines",
    description: "File transfers from lab machines are much slower than last week.",
    requestedPriority: "LOW",
    itPriority: "HIGH",
    status: "REOPENED",
    ownerEmail: "lisa.garcia@example.com",
    problemAppearsResolvedAt: null,
  },
  {
    ticketNumber: "TKT-2026-000008",
    requesterEmail: "emily.davis@example.com",
    categoryName: "Account and Access",
    relatedSystemName: "Email",
    summary: "Duplicate test ticket for cancelled flow",
    description: "This request was filed twice by mistake and is no longer needed.",
    requestedPriority: "LOW",
    itPriority: null,
    status: "CANCELLED",
    ownerEmail: null,
    problemAppearsResolvedAt: null,
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        name: category.name,
      },
      update: {
        isActive: category.isActive,
      },
      create: category,
    });
  }

  for (const requester of requesters) {
    await prisma.requester.upsert({
      where: {
        email: normalizeEmail(requester.email),
      },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: {
        name: requester.name,
        email: normalizeEmail(requester.email),
        isActive: requester.isActive,
      },
    });
  }

  for (const system of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: {
        name: system.name,
      },
      update: {
        isActive: system.isActive,
      },
      create: system,
    });
  }

  // Users (idempotent by normalized email). Fresh scrypt hash per user per run;
  // mustChangePassword stays true so seeded credentials always force rotation.
  for (const u of seedUsers) {
    const email = normalizeEmail(u.email);
    let legacyRequesterId = null;
    if (u.role === "REQUESTER") {
      const requester = await prisma.requester.findUnique({ where: { email } });
      legacyRequesterId = requester ? requester.id : null;
    }
    await prisma.user.upsert({
      where: { email },
      update: {
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: true,
        passwordHash: hashPassword(DEV_PASSWORD),
        legacyRequesterId,
      },
      create: {
        name: u.name,
        email,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: true,
        passwordHash: hashPassword(DEV_PASSWORD),
        legacyRequesterId,
      },
    });
  }

  // Lookup maps for ticket FKs.
  const categoryRows = await prisma.category.findMany();
  const systemRows = await prisma.relatedSystem.findMany();
  const requesterRows = await prisma.requester.findMany();
  const userRows = await prisma.user.findMany();
  const categoryByName = new Map(categoryRows.map((c) => [c.name, c]));
  const systemByName = new Map(systemRows.map((s) => [s.name, s]));
  const requesterByEmail = new Map(requesterRows.map((r) => [normalizeEmail(r.email), r]));
  const userByEmail = new Map(userRows.map((u) => [normalizeEmail(u.email), u]));

  for (const t of seedTickets) {
    const requester = requesterByEmail.get(normalizeEmail(t.requesterEmail));
    const requesterUser = userByEmail.get(normalizeEmail(t.requesterEmail));
    const category = categoryByName.get(t.categoryName);
    const system = systemByName.get(t.relatedSystemName);
    if (!requester || !requesterUser || !category || !system) {
      throw new Error(`Seed lookup failed for ticket ${t.ticketNumber}`);
    }
    const owner = t.ownerEmail ? userByEmail.get(normalizeEmail(t.ownerEmail)) : null;
    if (t.ownerEmail && !owner) {
      throw new Error(`Seed owner lookup failed for ticket ${t.ticketNumber}`);
    }
    await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {
        requesterId: requester.id,
        requesterUserId: requesterUser.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        status: t.status,
        ticketOwnerId: owner ? owner.id : null,
        problemAppearsResolvedAt: t.problemAppearsResolvedAt,
      },
      create: {
        ticketNumber: t.ticketNumber,
        requesterId: requester.id,
        requesterUserId: requesterUser.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        status: t.status,
        ticketOwnerId: owner ? owner.id : null,
        problemAppearsResolvedAt: t.problemAppearsResolvedAt,
      },
    });
  }

  // Example comments/notes with non-sensitive content (no passwords, tokens, or
  // personal data beyond the seeded names). Append-only per BR-14: never delete
  // existing rows; ensure each seed example exists (by ticketId + exact content)
  // and create only when missing, so reruns are idempotent without duplicates
  // and without erasing authored history.
  const SEED_REQUESTER_COMMENT =
    "Thanks for looking into this. Happy to provide more details if it helps.";
  const SEED_STAFF_COMMENT =
    "Thanks for reporting. We are reviewing your ticket and will post updates here.";
  const SEED_INTERNAL_NOTE =
    "Checked initial diagnostics; no obvious errors. Will follow up with the requester for repro steps.";
  const tickets = await prisma.ticket.findMany({
    where: { ticketNumber: { in: seedTickets.map((t) => t.ticketNumber) } },
  });
  const liveUsersByEmail = new Map((await prisma.user.findMany()).map((u) => [normalizeEmail(u.email), u]));
  async function ensurePublicComment(ticketId, authorId, content) {
    const existing = await prisma.publicComment.findFirst({
      where: { ticketId, content },
      select: { id: true },
    });
    if (existing) return;
    await prisma.publicComment.create({
      data: { ticketId, authorId, content },
    });
  }
  async function ensureInternalNote(ticketId, authorId, content) {
    const existing = await prisma.internalNote.findFirst({
      where: { ticketId, content },
      select: { id: true },
    });
    if (existing) return;
    await prisma.internalNote.create({
      data: { ticketId, authorId, content },
    });
  }
  for (const ticket of tickets) {
    const seedDef = seedTickets.find((t) => t.ticketNumber === ticket.ticketNumber);
    const requesterUser = liveUsersByEmail.get(normalizeEmail(seedDef.requesterEmail));
    const ownerUser = seedDef.ownerEmail ? liveUsersByEmail.get(normalizeEmail(seedDef.ownerEmail)) : null;
    const commentAuthor = ownerUser ?? liveUsersByEmail.get("priya.patel@example.com");

    await ensurePublicComment(ticket.id, requesterUser.id, SEED_REQUESTER_COMMENT);
    await ensurePublicComment(ticket.id, commentAuthor.id, SEED_STAFF_COMMENT);
    if (ownerUser) {
      await ensureInternalNote(ticket.id, ownerUser.id, SEED_INTERNAL_NOTE);
    }
  }

  // Lab 4 Actions Taken (docs/lab-04/specification.md §7; BR-01…BR-07).
  // Coverage: zero-action tickets (TKT-2026-000001 NEW, TKT-2026-000006 CLOSED —
  // the gate never blocks them, AC-05), one-action tickets (000002/000004/
  // 000005/000008), several-action tickets (000003 ×2, 000007 ×3); all five
  // `result` values (BR-03); a gate-blocking pending follow-up on 000002 (AC-04)
  // vs completed follow-up cycles on 000003/000005 that leave the gate open
  // (AC-05); non-owner authorship throughout (BR-06: ownership ≠ authorship —
  // e.g. Tom authors on Priya's ticket); one ≤500-char `attachmentNotes` pointer
  // (BR-05, no upload). The inactive IT Staff account (mark.lee@example.com) is
  // deliberately left with zero authored rows so the inactive-author/admin-only
  // correction paths stay demonstrable. Spec §7 defines no assignee FK and no
  // ActionStatus enum, so there is no "assigned/cancelled action" state to seed;
  // the closest seeded case is the NO_FURTHER_ACTION entry on the CANCELLED
  // ticket 000008 (flagged in the PR).
  // Idempotency: existence check by (ticketId + description); rows are created
  // only when missing and never updated or deleted, so reruns neither duplicate
  // nor clobber follow-up state changed after seeding.
  const SEED_ACTIONS_TAKEN = [
    {
      ticketNumber: "TKT-2026-000002",
      performedByEmail: "tom.nguyen@example.com",
      actionDate: new Date("2026-09-21T09:15:00Z"),
      description: "Reproduced the sync failure on a test profile; inbox rules look fine, server-side mailbox may be stuck.",
      result: "INFO_REQUESTED",
      followUpRequired: true,
      followUpNote: "Ask the requester for the exact error code shown when sync fails, then re-test.",
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000003",
      performedByEmail: "lisa.garcia@example.com",
      actionDate: new Date("2026-09-21T11:00:00Z"),
      description: "Switched the affected shelf to the backup access point as a temporary workaround.",
      result: "WORKAROUND",
      followUpRequired: false,
      followUpNote: null,
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000003",
      performedByEmail: "tom.nguyen@example.com",
      actionDate: new Date("2026-09-22T08:40:00Z"),
      description: "Escalated to network operations after interference was confirmed on channel 6.",
      result: "ESCALATED",
      followUpRequired: true,
      followUpNote: "Confirm with network operations that the channel plan change was applied.",
      followUpResolvedAt: new Date("2026-09-23T10:05:00Z"),
      resolvedByEmail: "priya.patel@example.com",
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000004",
      performedByEmail: "lisa.garcia@example.com",
      actionDate: new Date("2026-09-22T14:20:00Z"),
      description: "Reviewed sign-in logs; hourly re-prompts match the current session policy for VPN users.",
      result: "INFO_REQUESTED",
      followUpRequired: false,
      followUpNote: null,
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000005",
      performedByEmail: "priya.patel@example.com",
      actionDate: new Date("2026-09-19T16:45:00Z"),
      description: "Replaced the dock cable and verified the external monitor is stable for a full workday.",
      result: "RESOLVED_STEP",
      followUpRequired: true,
      followUpNote: "Ask the requester to confirm the flicker is gone after one week of use.",
      followUpResolvedAt: new Date("2026-09-20T09:30:00Z"),
      resolvedByEmail: "priya.patel@example.com",
      attachmentNotes: "Photo of the replaced dock cable (see ticket attachments).",
    },
    {
      ticketNumber: "TKT-2026-000007",
      performedByEmail: "priya.patel@example.com",
      actionDate: new Date("2026-09-23T09:00:00Z"),
      description: "Re-ran throughput tests after the reopen; speeds are still below baseline on two machines.",
      result: "INFO_REQUESTED",
      followUpRequired: false,
      followUpNote: null,
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000007",
      performedByEmail: "tom.nguyen@example.com",
      actionDate: new Date("2026-09-23T13:30:00Z"),
      description: "Updated the lab switch firmware to the vendor recommended release.",
      result: "RESOLVED_STEP",
      followUpRequired: false,
      followUpNote: null,
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000007",
      performedByEmail: "lisa.garcia@example.com",
      actionDate: new Date("2026-09-24T10:10:00Z"),
      description: "Documented the firmware change and the remaining slow hosts for the next shift.",
      result: "WORKAROUND",
      followUpRequired: false,
      followUpNote: null,
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
    {
      ticketNumber: "TKT-2026-000008",
      performedByEmail: "priya.patel@example.com",
      actionDate: new Date("2026-09-20T12:00:00Z"),
      description: "Confirmed duplicate filing with the requester; no further action needed on this copy.",
      result: "NO_FURTHER_ACTION",
      followUpRequired: false,
      followUpNote: null,
      followUpResolvedAt: null,
      resolvedByEmail: null,
      attachmentNotes: null,
    },
  ];
  const ticketByNumber = new Map(tickets.map((t) => [t.ticketNumber, t]));
  for (const a of SEED_ACTIONS_TAKEN) {
    const ticket = ticketByNumber.get(a.ticketNumber);
    const performer = liveUsersByEmail.get(normalizeEmail(a.performedByEmail));
    if (!ticket || !performer) {
      throw new Error(`Seed action lookup failed for ticket ${a.ticketNumber}`);
    }
    const existing = await prisma.actionTaken.findFirst({
      where: { ticketId: ticket.id, description: a.description },
      select: { id: true },
    });
    if (existing) continue;
    const resolver = a.resolvedByEmail
      ? liveUsersByEmail.get(normalizeEmail(a.resolvedByEmail))
      : null;
    if (a.resolvedByEmail && !resolver) {
      throw new Error(`Seed resolver lookup failed for ticket ${a.ticketNumber}`);
    }
    await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        performedById: performer.id,
        actionDate: a.actionDate,
        description: a.description,
        result: a.result,
        followUpRequired: a.followUpRequired,
        followUpNote: a.followUpNote,
        followUpResolvedAt: a.followUpResolvedAt,
        followUpResolvedById: resolver ? resolver.id : null,
        attachmentNotes: a.attachmentNotes,
      },
    });
  }

  const userCount = await prisma.user.count();
  const ticketCount = await prisma.ticket.count();
  const commentCount = await prisma.publicComment.count();
  const noteCount = await prisma.internalNote.count();
  const actionTakenCount = await prisma.actionTaken.count();
  console.log(`Seeded ${categories.length} categories.`);
  console.log(`Seeded ${requesters.length} requesters.`);
  console.log(`Seeded ${relatedSystems.length} related systems.`);
  console.log(`Seeded ${userCount} users (6 requester + 4 IT staff + 1 admin expected at minimum).`);
  console.log(`Seeded ${ticketCount} tickets across 8 statuses.`);
  console.log(`Seeded ${commentCount} public comments and ${noteCount} internal notes (safe examples only).`);
  console.log(`Seeded ${actionTakenCount} actions-taken entries (zero/one/several across all 8 statuses; pending + resolved follow-ups).`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
