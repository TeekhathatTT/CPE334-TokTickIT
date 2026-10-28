#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toIso(d) { return d.toISOString(); }
function startOfUtcDay(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }

async function verify() {
  const now = new Date('2026-10-09T12:00:00.000Z');
  const recentlyResolvedSince = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const newTodaySince = startOfUtcDay(now);
  
  const results = [];
  
  try {
    // Requester metrics sample - need to find a requester
    const requesters = await prisma.user.findMany({ where: { role: 'REQUESTER', isActive: true }, take: 5 });
    if (requesters.length > 0) {
      const uid = requesters[0].id;
      // API-like counts (app-computed bounds)
      const [openApi, awaitingApi, recentApi, totalApi] = await Promise.all([
        prisma.ticket.count({ where: { requesterUserId: uid, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } }),
        prisma.ticket.count({ where: { requesterUserId: uid, status: 'WAITING_FOR_REQUESTER' } }),
        prisma.ticket.count({ where: { requesterUserId: uid, status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: recentlyResolvedSince } } }),
        prisma.ticket.count({ where: { requesterUserId: uid } }),
      ]);
      // SQL verification
      const openSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE "requesterUserId" =  AND status NOT IN ('RESOLVED','CLOSED','CANCELLED');
      const awaitingSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE "requesterUserId" =  AND status = 'WAITING_FOR_REQUESTER';
      const recentSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE "requesterUserId" =  AND status IN ('RESOLVED','CLOSED') AND "updatedAt" >= ;
      const totalSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE "requesterUserId" = ';
      results.push({ metric: 'requester.openTickets', API: openApi, SQL: openSql[0]?.c, match: openApi === openSql[0]?.c });
      results.push({ metric: 'requester.awaitingMyResponse', API: awaitingApi, SQL: awaitingSql[0]?.c, match: awaitingApi === awaitingSql[0]?.c });
      results.push({ metric: 'requester.recentlyResolved', API: recentApi, SQL: recentSql[0]?.c, match: recentApi === recentSql[0]?.c });
      results.push({ metric: 'requester.totalSubmitted', API: totalApi, SQL: totalSql[0]?.c, match: totalApi === totalSql[0]?.c });
    }
    
    // Staff metrics
    const [unassignedApi, waitingApi, resolvedApi, newTodayApi] = await Promise.all([
      prisma.ticket.count({ where: { ticketOwnerId: null, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } }),
      prisma.ticket.count({ where: { status: 'WAITING_FOR_REQUESTER' } }),
      prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      prisma.ticket.count({ where: { status: 'NEW', createdAt: { gte: newTodaySince } } }),
    ]);
    const unassignedSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE "ticketOwnerId" IS NULL AND status NOT IN ('RESOLVED','CLOSED','CANCELLED');
    const waitingSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE status = 'WAITING_FOR_REQUESTER';
    const resolvedSql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE status = 'RESOLVED';
    const newTodaySql = await prisma.SELECT COUNT(*)::int as c FROM "Ticket" WHERE status = 'NEW' AND "createdAt" >= ;
    const pendingSql = await prisma.SELECT COUNT(DISTINCT t.id)::int as c FROM "Ticket" t WHERE EXISTS (SELECT 1 FROM "ActionTaken" a WHERE a."ticketId" = t.id AND a."followUpRequired" = true AND a."followUpResolvedAt" IS NULL);
    const pendingApi = await prisma.ticket.count({ where: { actionsTaken: { some: { followUpRequired: true, followUpResolvedAt: null } } } });
    
    results.push({ metric: 'staff.unassignedActive', API: unassignedApi, SQL: unassignedSql[0]?.c, match: unassignedApi === unassignedSql[0]?.c });
    results.push({ metric: 'staff.waitingForRequester', API: waitingApi, SQL: waitingSql[0]?.c, match: waitingApi === waitingSql[0]?.c });
    results.push({ metric: 'staff.resolvedPendingClose', API: resolvedApi, SQL: resolvedSql[0]?.c, match: resolvedApi === resolvedSql[0]?.c });
    results.push({ metric: 'staff.newToday', API: newTodayApi, SQL: newTodaySql[0]?.c, match: newTodayApi === newTodaySql[0]?.c });
    results.push({ metric: 'staff.pendingFollowUp', API: pendingApi, SQL: pendingSql[0]?.c, match: pendingApi === pendingSql[0]?.c });
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  console.log('metric | API | SQL | match');
  console.log('--- | --- | --- | ---');
  for (const r of results) {
    console.log(${r.metric} |  |  | );
  }
  
  // Performance smoke test
  const start = Date.now();
  await prisma.ticket.count({ take: 1000 } as any);
  const elapsed = Date.now() - start;
  console.log(\nPerformance smoke: query took ms);
}

verify().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.());
