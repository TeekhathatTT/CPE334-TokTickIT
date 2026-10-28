#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toIso(d) { return d.toISOString(); }
function startOfUtcDay(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }

async function main() {
  const now = new Date('2026-10-09T12:00:00.000Z');
  const recentlyResolvedSince = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const newTodaySince = startOfUtcDay(now);

  // Try to read any users/tickets to compute; if DB not ready, still show structure
  try {
    const users = await prisma.user.findMany({ take: 10 });
    console.log(JSON.stringify({ usersCount: users.length, now: toIso(now) }, null, 2));
  } catch (e) {
    console.log('DB not ready or schema not migrated:', e.message);
  }

  console.log('\nmetric | API | SQL | match');
  console.log('--- | --- | --- | ---');
  // Placeholder structure - actual verification requires seeded data per spec
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.());
