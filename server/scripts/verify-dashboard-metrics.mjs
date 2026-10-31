#!/usr/bin/env node
import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";

const P95_THRESHOLD_MS = 500;
const PERF_ITERATIONS = 40;
const PERF_WARMUP_ITERATIONS = 5;

const prismaModulePath = new URL("../dist/src/prisma.js", import.meta.url);
const dashboardsModulePath = new URL("../dist/src/modules/dashboards/dashboards.service.js", import.meta.url);

if (!existsSync(prismaModulePath) || !existsSync(dashboardsModulePath)) {
  console.error("Build output is missing. Run `npm run build` first (or `npm run verify:dashboards`).");
  process.exit(1);
}

const { getPrisma } = await import(prismaModulePath.href);
const { getRequesterDashboard, getStaffDashboard } = await import(dashboardsModulePath.href);

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  return String(value);
}

function sameNumberArray(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(ratio * sorted.length) - 1);
  return sorted[index];
}

async function rawCount(prisma, sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return Number(rows[0]?.c ?? 0);
}

async function rawIds(prisma, sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return rows.map((row) => Number(row.id));
}

function addCheck(results, scope, metric, dashboard, sql) {
  const dashboardValue = typeof dashboard === "number" ? dashboard : [...dashboard];
  const sqlValue = typeof sql === "number" ? sql : [...sql];
  const match = typeof dashboardValue === "number"
    ? dashboardValue === sqlValue
    : sameNumberArray(dashboardValue, sqlValue);

  results.push({ scope, metric, dashboard: dashboardValue, sql: sqlValue, match });
}

async function verifyRequester(prisma, results, requester) {
  const dashboard = await getRequesterDashboard(requester.id);
  const recentlyResolvedSince = new Date(dashboard.recentlyResolvedSince);
  if (Number.isNaN(recentlyResolvedSince.getTime())) {
    throw new Error(`Dashboard returned an invalid recentlyResolvedSince for requester #${requester.id}`);
  }

  const [
    openTicketsSql,
    awaitingMyResponseSql,
    recentlyResolvedSql,
    totalSubmittedSql,
    recentTicketIdsSql,
  ] = await Promise.all([
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE "requesterUserId" = $1
         AND status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')`,
      requester.id,
    ),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE "requesterUserId" = $1
         AND status = 'WAITING_FOR_REQUESTER'`,
      requester.id,
    ),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE "requesterUserId" = $1
         AND status IN ('RESOLVED', 'CLOSED')
         AND "updatedAt" >= $2`,
      requester.id,
      recentlyResolvedSince,
    ),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE "requesterUserId" = $1`,
      requester.id,
    ),
    rawIds(
      prisma,
      `SELECT id FROM "Ticket"
       WHERE "requesterUserId" = $1
       ORDER BY "updatedAt" DESC, id DESC
       LIMIT 5`,
      requester.id,
    ),
  ]);

  const scope = `requester#${requester.id}`;
  const recentTicketIds = dashboard.recentTickets.map((ticket) => ticket.id);

  addCheck(results, scope, "openTickets", dashboard.openTickets, openTicketsSql);
  addCheck(results, scope, "awaitingMyResponse", dashboard.awaitingMyResponse, awaitingMyResponseSql);
  addCheck(results, scope, "recentlyResolved", dashboard.recentlyResolved, recentlyResolvedSql);
  addCheck(results, scope, "totalSubmitted", dashboard.totalSubmitted, totalSubmittedSql);
  addCheck(results, scope, "recentTickets(ids)", recentTicketIds, recentTicketIdsSql);

  return dashboard;
}

async function verifyStaff(prisma, results, staffUser) {
  const dashboard = await getStaffDashboard(staffUser.id);
  const newTodaySince = new Date(dashboard.newTodaySince);
  if (Number.isNaN(newTodaySince.getTime())) {
    throw new Error(`Dashboard returned an invalid newTodaySince for staff #${staffUser.id}`);
  }

  const pendingFollowUpSql = `
    SELECT COUNT(DISTINCT t.id)::int AS c
    FROM "Ticket" t
    WHERE EXISTS (
      SELECT 1 FROM "ActionTaken" a
      WHERE a."ticketId" = t.id
        AND a."followUpRequired" = true
        AND a."followUpResolvedAt" IS NULL
    )`;

  const pendingFollowUpIdsSql = `
    SELECT t.id
    FROM "Ticket" t
    WHERE EXISTS (
      SELECT 1 FROM "ActionTaken" a
      WHERE a."ticketId" = t.id
        AND a."followUpRequired" = true
        AND a."followUpResolvedAt" IS NULL
    )
    ORDER BY t."updatedAt" DESC, t.id DESC
    LIMIT 200`;

  const [
    unassignedActiveSql,
    assignedToMeSql,
    waitingForRequesterSql,
    pendingFollowUpCountSql,
    pendingFollowUpTicketIdsSql,
    resolvedPendingCloseSql,
    newTodaySql,
  ] = await Promise.all([
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE "ticketOwnerId" IS NULL
         AND status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')`,
    ),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE "ticketOwnerId" = $1
         AND status NOT IN ('CLOSED', 'CANCELLED')`,
      staffUser.id,
    ),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE status = 'WAITING_FOR_REQUESTER'`,
    ),
    rawCount(prisma, pendingFollowUpSql),
    rawIds(prisma, pendingFollowUpIdsSql),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE status = 'RESOLVED'`,
    ),
    rawCount(
      prisma,
      `SELECT COUNT(*)::int AS c FROM "Ticket"
       WHERE status = 'NEW'
         AND "createdAt" >= $1`,
      newTodaySince,
    ),
  ]);

  const scope = `staff#${staffUser.id}`;
  addCheck(results, scope, "unassignedActive", dashboard.unassignedActive, unassignedActiveSql);
  addCheck(results, scope, "assignedToMe", dashboard.assignedToMe, assignedToMeSql);
  addCheck(results, scope, "waitingForRequester", dashboard.waitingForRequester, waitingForRequesterSql);
  addCheck(results, scope, "pendingFollowUp", dashboard.pendingFollowUp, pendingFollowUpCountSql);
  addCheck(results, scope, "pendingFollowUpTicketIds", dashboard.pendingFollowUpTicketIds, pendingFollowUpTicketIdsSql);
  addCheck(results, scope, "resolvedPendingClose", dashboard.resolvedPendingClose, resolvedPendingCloseSql);
  addCheck(results, scope, "newToday", dashboard.newToday, newTodaySql);

  if (dashboard.pendingFollowUpTicketIds.length > 200) {
    throw new Error(`pendingFollowUpTicketIds exceeded the 200-id cap for staff #${staffUser.id}`);
  }

  return dashboard;
}

function requesterDigest(dashboard) {
  return JSON.stringify({
    openTickets: dashboard.openTickets,
    awaitingMyResponse: dashboard.awaitingMyResponse,
    recentlyResolved: dashboard.recentlyResolved,
    totalSubmitted: dashboard.totalSubmitted,
    recentTicketIds: dashboard.recentTickets.map((ticket) => ticket.id),
  });
}

function staffDigest(dashboard) {
  return JSON.stringify({
    unassignedActive: dashboard.unassignedActive,
    assignedToMe: dashboard.assignedToMe,
    waitingForRequester: dashboard.waitingForRequester,
    pendingFollowUp: dashboard.pendingFollowUp,
    pendingFollowUpTicketIds: dashboard.pendingFollowUpTicketIds,
    resolvedPendingClose: dashboard.resolvedPendingClose,
    newToday: dashboard.newToday,
  });
}

async function measureEndpoint(label, call, expectedDigest) {
  for (let index = 0; index < PERF_WARMUP_ITERATIONS; index += 1) {
    await call();
  }

  const durations = [];
  let dataMismatches = 0;

  for (let index = 0; index < PERF_ITERATIONS; index += 1) {
    const startedAt = performance.now();
    const dashboard = await call();
    durations.push(performance.now() - startedAt);
    if (dashboard.digest !== expectedDigest) dataMismatches += 1;
  }

  const p95 = percentile(durations, 0.95);
  return {
    label,
    samples: durations.length,
    p50: percentile(durations, 0.5),
    p95,
    max: Math.max(...durations),
    dataMismatches,
    pass: p95 < P95_THRESHOLD_MS && dataMismatches === 0,
  };
}

async function run(prisma) {
  const results = [];

  console.log("=== Dashboard Metrics Verification (SQL vs dashboard service) ===\n");

  const [requesters, staffUsers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "REQUESTER", isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, email: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["IT_STAFF", "ADMINISTRATOR"] }, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, email: true, role: true },
    }),
  ]);

  if (requesters.length === 0) throw new Error("No active requesters found.");
  if (staffUsers.length === 0) throw new Error("No active IT staff/administrator found.");

  console.log(`Requesters checked: ${requesters.length}`);
  console.log(`Staff/administrator dashboards checked: ${staffUsers.length}\n`);

  const requesterDashboards = new Map();
  for (const requester of requesters) {
    requesterDashboards.set(requester.id, await verifyRequester(prisma, results, requester));
  }

  const staffDashboards = new Map();
  for (const staffUser of staffUsers) {
    staffDashboards.set(staffUser.id, await verifyStaff(prisma, results, staffUser));
  }

  console.log("Scope | Metric | Dashboard | SQL | Result");
  console.log("--- | --- | --- | --- | ---");
  for (const result of results) {
    console.log(
      `${result.scope} | ${result.metric} | ${formatValue(result.dashboard)} | ${formatValue(result.sql)} | ${result.match ? "OK" : "MISMATCH"}`,
    );
  }

  const metricMismatches = results.filter((result) => !result.match);
  console.log(`\nMetric checks: ${results.length}, mismatches: ${metricMismatches.length}`);

  const perfRequester = requesters.find((requester) => requester.id === 1) ?? requesters[0];
  const perfStaff = staffUsers[0];

  const expectedRequesterDigest = requesterDigest(requesterDashboards.get(perfRequester.id));
  const expectedStaffDigest = staffDigest(staffDashboards.get(perfStaff.id));

  const performanceResults = [];
  performanceResults.push(
    await measureEndpoint(
      `requester#${perfRequester.id}`,
      async () => {
        const dashboard = await getRequesterDashboard(perfRequester.id);
        return { dashboard, digest: requesterDigest(dashboard) };
      },
      expectedRequesterDigest,
    ),
  );
  performanceResults.push(
    await measureEndpoint(
      `staff#${perfStaff.id}`,
      async () => {
        const dashboard = await getStaffDashboard(perfStaff.id);
        return { dashboard, digest: staffDigest(dashboard) };
      },
      expectedStaffDigest,
    ),
  );

  console.log("\n=== Performance Smoke Test ===");
  console.log(`Threshold: p95 < ${P95_THRESHOLD_MS} ms (${PERF_ITERATIONS} samples, ${PERF_WARMUP_ITERATIONS} warm-up calls)`);
  console.log("Dashboard | samples | p50 (ms) | p95 (ms) | max (ms) | data mismatches | Result");
  console.log("--- | --- | --- | --- | --- | --- | ---");
  for (const result of performanceResults) {
    console.log(
      `${result.label} | ${result.samples} | ${result.p50.toFixed(2)} | ${result.p95.toFixed(2)} | ${result.max.toFixed(2)} | ${result.dataMismatches} | ${result.pass ? "PASS" : "FAIL"}`,
    );
  }

  const performanceFailed = performanceResults.some((result) => !result.pass);
  const failed = metricMismatches.length > 0 || performanceFailed;

  console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
  if (failed) process.exitCode = 1;
}

let prisma;
try {
  prisma = getPrisma();
  await run(prisma);
} catch (error) {
  console.error("\nVerification failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect().catch(() => {});
}
