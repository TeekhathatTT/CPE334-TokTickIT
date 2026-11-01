import { getPrisma } from "../../prisma.js";
import { getNow } from "../../utils/clock.js";

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIso(value: Date): string {
  return value.toISOString();
}

export async function getRequesterDashboard(userId: number) {
  const prisma = getPrisma();
  const now = getNow();
  const recentlyResolvedSince = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [openTickets, awaitingMyResponse, recentlyResolved, totalSubmitted, recentTickets] = await Promise.all([
    prisma.ticket.count({
      where: {
        requesterUserId: userId,
        status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
      },
    }),
    prisma.ticket.count({
      where: {
        requesterUserId: userId,
        status: "WAITING_FOR_REQUESTER",
      },
    }),
    prisma.ticket.count({
      where: {
        requesterUserId: userId,
        status: { in: ["RESOLVED", "CLOSED"] },
        updatedAt: { gte: recentlyResolvedSince },
      },
    }),
    prisma.ticket.count({
      where: {
        requesterUserId: userId,
      },
    }),
    prisma.ticket.findMany({
      where: { requesterUserId: userId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    openTickets,
    awaitingMyResponse,
    recentlyResolved,
    recentlyResolvedSince: toIso(recentlyResolvedSince),
    totalSubmitted,
    recentTickets: recentTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      status: t.status,
      updatedAt: toIso(t.updatedAt),
    })),
  };
}

export async function getStaffDashboard(userId: number) {
  const prisma = getPrisma();
  const now = getNow();
  const newTodaySince = startOfUtcDay(now);

  const [unassignedActive, assignedToMe, waitingForRequester, resolvedPendingClose, newToday, pendingFollowUpTickets] = await Promise.all([
    prisma.ticket.count({
      where: {
        ticketOwnerId: null,
        status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
      },
    }),
    prisma.ticket.count({
      where: {
        ticketOwnerId: userId,
        status: { notIn: ["CLOSED", "CANCELLED"] },
      },
    }),
    prisma.ticket.count({
      where: {
        status: "WAITING_FOR_REQUESTER",
      },
    }),
    prisma.ticket.count({
      where: {
        status: "RESOLVED",
      },
    }),
    prisma.ticket.count({
      where: {
        status: "NEW",
        createdAt: { gte: newTodaySince },
      },
    }),
    prisma.ticket.findMany({
      where: {
        actionsTaken: {
          some: {
            followUpRequired: true,
            followUpResolvedAt: null,
          },
        },
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 200,
    }),
  ]);

  const pendingFollowUp = await prisma.ticket.count({
    where: {
      actionsTaken: {
        some: {
          followUpRequired: true,
          followUpResolvedAt: null,
        },
      },
    },
  });

  return {
    unassignedActive,
    assignedToMe,
    waitingForRequester,
    pendingFollowUp,
    pendingFollowUpTicketIds: pendingFollowUpTickets.map((t) => t.id),
    resolvedPendingClose,
    newToday,
    newTodaySince: toIso(newTodaySince),
  };
}
