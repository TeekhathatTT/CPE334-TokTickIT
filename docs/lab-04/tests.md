# Lab 4 Test DD / TDD Plan

This plan is written before Lab 4 implementation. Every row starts as `Planned`; no result is claimed until an automated run produces evidence. Statuses and role decisions must be tested from the backend; frontend tests alone are insufficient.

Seeded reference set for dashboard/gate tests (idempotent seed, stable identifiers; **frozen-clock fixtures — never wall-clock "today"**): freeze test clock to `NOW = 2026-10-09T12:00:00.000Z` (UTC) via fake timers / `now()` mock. Fixture timestamps are fixed relative to `NOW`: requester R1 owns T1 (`OPEN`, owner S1, 1 pending follow-up, `createdAt 2026-10-01T10:00Z`), T2 (`IN_PROGRESS`, unassigned, 1 resolved follow-up + 1 all-clear entry, `createdAt 2026-10-02T10:00Z`), T3 (`WAITING_FOR_REQUESTER`, owner S2, zero entries, `createdAt 2026-10-03T10:00Z`), T4 (`RESOLVED`, owner S1, all follow-ups resolved, `updatedAt 2026-10-04T12:00Z` — 5 days before `NOW`, inside 30 days), T5 (`NEW`, unassigned, zero entries, `createdAt 2026-10-09T08:00Z` — same UTC day as `NOW`); requester R2 owns T6 (`CLOSED`, `updatedAt 2026-08-01T12:00Z` — outside 30 days) and T7 (`OPEN`, owner S1, zero entries, `createdAt 2026-10-01T11:00Z`). Seed upserts MUST write these fixed timestamps (anchored to the documented `NOW`), never wall-clock `now()`, or dashboard tests become day-dependent and flaky. Tests that assert time-dependent cards MUST freeze the clock to `NOW` (or create own fixed fixtures); wall-clock runs are forbidden.

Expected card values against this set (normative; tests assert these exact numbers **and** count ≡ drill-down `meta.totalItems` with the BR-08 exact filters):

| Caller | Card | Expected | Drill-down (exact) |
|---|---|---|---|
| R1 (requester) | `openTickets` | 4 (T1,T2,T3,T5) | `?status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED` → `totalItems 4` |
| R1 | `awaitingMyResponse` | 1 (T3) | `?status=WAITING_FOR_REQUESTER` → `1` |
| R1 | `recentlyResolved` | 1 (T4) | `?status=RESOLVED&status=CLOSED&updatedSince=<recentlyResolvedSince>` → `1` |
| R1 | `totalSubmitted` | 5 (T1–T5) | no filter → `5` |
| S1 (staff) | `unassignedActive` | 2 (T2,T5) | `?ownerId=unassigned&status=<5 open>` → `2` |
| S1 | `assignedToMe` | 3 (T1,T4,T7) | `?ownerId=<S1>&status=<5 open + RESOLVED>` → `3` |
| S1 | `waitingForRequester` | 1 (T3) | `?status=WAITING_FOR_REQUESTER` → `1` |
| S1 | `pendingFollowUp` | 1 (T1) | `?hasPendingFollowUp=true` → `1` (`pendingFollowUpTicketIds` ≤200 convenience only) |
| S1 | `resolvedPendingClose` | 1 (T4) | `?status=RESOLVED` → `1` |
| S1 | `newToday` | 1 (T5) | `?status=NEW&createdSince=<newTodaySince>` → `1` |

## 1. Planned tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| L4-API-01 | API-integration | AC-01 | IT Staff + Administrator create Actions Taken (assigned, unassigned, other-owned) | `201`, server-set `actionDate`, session-derived `performedBy` | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-02 | API-integration | AC-02 | Actions Taken validation (blank/short/long description, unknown result, followUpNote missing-when-required / supplied-when-not-required, oversized attachmentNotes, client-supplied `actionDate`/`performedById`/`followUpResolvedAt`/`followUpResolvedById` strictly rejected) | `400 VALIDATION_ERROR` + `fields`, no row created (no silent ignore) | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-03 | API-integration | AC-06 | Author-or-Administrator field edit; non-author IT Staff edit rejected; any-staff resolve; double-resolve and resolve-when-not-required; stored-vs-merged order; mixed-body 403; flip transitions T1–T4 | Author/admin `200` (+`updatedAt` bump); non-author fields-only `403`; non-author mixed fields+resolve `403` as a whole; resolve-only `200` with `followUpResolvedAt`/`resolvedBy`; double-resolve `409 FOLLOW_UP_ALREADY_RESOLVED`; resolve of merged-false `400`; T1 `true→false` on pending → `400` (resolve-first-then-flip two-step); T2 resolved `true→false` preserves history; T3 `false→true` requires fresh note (new pending); T4 re-arm clears `resolvedAt/By`; `false+resolve` in one call → `400`; `createdAt` equals `actionDate` alias | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-04 | API-integration | AC-04, AC-05 | Resolution gate: blocked with pending follow-up (each of OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER), allowed after explicit resolve, allowed with zero entries; matrix-illegal keeps `INVALID_STATUS_TRANSITION` | Pending → `409 RESOLUTION_BLOCKED` with `fields.pendingFollowUpCount`, status unchanged; resolved/zero → `200`; matrix-illegal → `409 INVALID_STATUS_TRANSITION` (Lab 3 code unchanged, gate not evaluated) | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-05 | API-integration | AC-11 | Gate scope: non-Resolved edges unaffected (incl. →Closed, →Cancelled, reopens) with pendings present; gate never fires off its three edges | Matrix behavior unchanged (`INVALID_STATUS_TRANSITION` where illegal), gate never fires off its three edges | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-06 | API-integration | AC-07 | Stale `expectedUpdatedAt` on ticket status/assignment/priority and on Actions Taken edit/resolve | `409 VERSION_CONFLICT` + `currentUpdatedAt`, no write; retry after re-fetch succeeds | server/tests/lab-04/ticket-workflow.api.test.ts; server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-07 | API-integration | AC-08 | Inactive / Administrator assignment targets rejected (Lab 3 BR-11/BR-16 preserved) | `400`, ownership unchanged | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-08 | API-integration | AC-10 | Requester dashboard cards vs frozen set (openTickets 4, awaitingMyResponse 1, recentlyResolved 1, totalSubmitted 5) incl. zero-state requester; count ≡ drill-down `totalItems` with exact filters; `recentTickets` ≤5 ordered; `recentlyResolvedSince` bound | Values equal BR-08 queries and exact drill-downs; frozen clock `NOW` | server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| L4-API-09 | API-integration | AC-10 | Staff dashboard cards vs frozen set (unassignedActive 2, assignedToMe(S1) 3, waitingForRequester 1, pendingFollowUp 1 + ids ≤200, resolvedPendingClose 1, newToday 1 UTC) incl. empty states; count ≡ drill-down `totalItems` via additive filters (`hasPendingFollowUp`, `createdSince`, `updatedSince`, repeated `status`); Administrator reuse without queue powers | Values equal BR-08 queries and exact drill-downs; `?hasPendingFollowUp=true` `totalItems` equals count (ids cap never truncates); admin `200` aggregates without queue powers; frozen clock `NOW` | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| L4-API-10 | API-integration | AC-04, AC-05 | `GET /api/staff/tickets/:id.pendingFollowUpCount` (additive) matches gate `EXISTS` count; banner source on page load | Detail count equals pending-row count; `0` when none; status-PATCH and detail agree | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-11 | API-integration (concurrency) | AC-04 | Gate race: concurrent `POST …/actions-taken { followUpRequired: true }` vs `PATCH …/status → RESOLVED` serialized by `SELECT … FOR UPDATE` on parent Ticket in both transactions | Under concurrency, ticket never ends `RESOLVED` with a pending row: one of (a) status wins before flag commits then flag creates pending on a `RESOLVED` ticket (allowed — gate only guards `→ Resolved` edges), or (b) flag wins then status → `409 RESOLUTION_BLOCKED`; never (c) `200 Resolved` + pending row coexisting from a check-then-write interleave | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-AUTHZ-01 | Authorization/API | AC-03, AC-09 | Requester create/edit/resolve forced → `403`; staff dashboard as Requester → `403`; other-user ticket Actions Taken as Requester → `404` | No row changes; no content leaked | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-AUTHZ-02 | Authorization/API | AC-06, AC-10 | Non-author staff edit → `403` but resolve → `200`; admin edits any row; admin dashboard read-only (status write still denied) | Role matrix enforced server-side | server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| L4-UNIT-01 | Unit | AC-04, AC-05 | Gate predicate + result-enum validator in isolation (no DB) | Pending detected; zero/resolved pass; unknown result rejected | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-UNIT-02 | Unit | AC-07 | `expectedUpdatedAt` comparator in isolation (canonical ISO equality, malformed → `400` per contract) | Stale detected (`VERSION_CONFLICT`); equal passes; malformed (non-string/unparseable/empty) → `400` (never ignored) | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-UI-01 | UI component | AC-01, AC-02, AC-09 | ActionsTaken create/edit/resolve UI: counters, conditional followUpNote required-when rule, role-gated controls, conflict copy, draft preservation | Valid flows succeed; invalid blocked inline; requester sees read-only full shape without controls | client/tests/lab-04/ActionsTaken.test.tsx | Planned |
| L4-UI-02 | UI component | AC-04, AC-05, AC-07 | TicketWorkflow UI: gate banner with pending count (sourced from detail `pendingFollowUpCount`), RESOLUTION_BLOCKED inline copy, VERSION_CONFLICT reload/keep choice | Banner shows when blocked; conflicts preserve input | client/tests/lab-04/TicketWorkflow.test.tsx | Planned |
| L4-UI-03 | UI component | AC-10 | StaffDashboard + RequesterDashboard UI: cards with exact expected numbers, values, empty copy, exact drill-down links, skeleton/failure states; admin cards render without links + reason | Zero states render; IT Staff links target exact documented filters; admin cards show value + reason with no link (no dead UI) | client/tests/lab-04/StaffDashboard.test.tsx; client/tests/lab-04/RequesterDashboard.test.tsx | Planned |
| L4-UI-04 | UI style | AC-13 | Zen Green: thread distinction (comments vs notes vs actions), badges with text, tokens reused, no new palette | Three threads unmistakable; no color-alone meaning | client/tests/lab-04/ActionsTaken.test.tsx; client/tests/lab-04/StaffDashboard.test.tsx | Planned |
| L4-RESP-01 | Responsive | AC-13 | Dashboards + Actions Taken at desktop ≥992 / tablet 768–991 / mobile <768 | No clipping/overflow; grids collapse; rows become cards | client/e2e/lab-04/dashboards.spec.ts | Planned |
| L4-A11Y-01 | Accessibility | AC-13 | Keyboard-only pass, labels, aria-describedby errors, visible focus, badge text | All controls reachable and named | client/e2e/lab-04/actions-taken-flow.spec.ts | Planned |
| L4-WF-01 | Workflow/API | AC-04, AC-05, AC-06 | End-to-end gate lifecycle via API: create pending → blocked → non-author resolve → Resolved succeeds | Full lifecycle `201 → 409 → 200 → 200` | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-REG-01 | Migration/regression | AC-12 | Lab 4 migration additive-only (new table/indexes + hand-written `CHECK`; no Lab 1–3 alter/drop; Prisma drift on `CHECK` expected and retained) | Schema diff clean except expected `CHECK`; prior suites unmodified-pass | server/tests/lab-04/ticket-workflow.api.test.ts; migration verification | Planned |
| L4-REG-02 | Regression | AC-08, AC-12 | Labs 1–3 suites rerun (auth, requester tickets/attachments, queue/detail, comments, notes, admin users, problemAppearsResolvedAt) | All prior tests pass unmodified | server/tests/lab-0{1,2,3}/*; client/tests/lab-0{1,2,3}/*; client/e2e/lab-03/* | Planned |
| L4-PERF-01 | Performance-smoke | AC-10 | Dashboard endpoints on seeded scale: p95 < 500ms local, exact counts | Meets budget with correct values | server/tests/lab-04/staff-dashboard.api.test.ts; server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| L4-SEC-01 | Security/API | AC-03, AC-09 | Safe-error matrix for Lab 4 routes (401/403/404/400/409/500 shapes incl. `RESOLUTION_BLOCKED` vs `INVALID_STATUS_TRANSITION` vs `VERSION_CONFLICT` vs `FOLLOW_UP_ALREADY_RESOLVED`, no hash/leak, no enumeration; requester full-shape visibility deliberate) | Envelope + codes per api-spec §4 | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-E2E-01 | E2E | AC-01, AC-04, AC-05, AC-06, AC-09 | Actions-taken flow: staff creates pending → resolve blocked → second staffer resolves → Resolved; requester sees read-only | UI + API agree end to end | client/e2e/lab-04/actions-taken-flow.spec.ts | Planned |
| L4-E2E-02 | E2E | AC-04, AC-05, AC-07 | Ticket-resolution flow incl. stale-update conflict recovery | Blocked copy, conflict reload/keep, eventual Resolved | client/e2e/lab-04/ticket-resolution.spec.ts | Planned |
| L4-E2E-03 | E2E | AC-10, AC-13 | Dashboards flow: cards vs seeded data, drill-downs land on filtered queues, responsive + console-clean | Values match API; links filter; no console errors | client/e2e/lab-04/dashboards.spec.ts | Planned |

## 2. Required file plan

Server planned paths:

```text
server/tests/lab-04/
├── actions-taken.api.test.ts
├── ticket-workflow.api.test.ts
├── requester-dashboard.api.test.ts
└── staff-dashboard.api.test.ts
```

Frontend planned paths:

```text
client/tests/lab-04/
├── StaffDashboard.test.tsx
├── RequesterDashboard.test.tsx
├── ActionsTaken.test.tsx
└── TicketWorkflow.test.tsx
```

E2E planned paths:

```text
client/e2e/lab-04/
├── actions-taken-flow.spec.ts
├── ticket-resolution.spec.ts
└── dashboards.spec.ts
```

These files do not exist yet; only the paths above may be used for Lab 4 tests (regression rows reuse the existing lab-01…lab-03 suites in place). Visual evidence later belongs under `artifacts/lab-04/screenshots/{requester-dashboard,staff-dashboard,actions-taken}/`.

## 3. AC to test traceability

| Acceptance Criterion | Planned test(s) |
|---|---|
| AC-01 create happy path | L4-API-01, L4-UI-01, L4-E2E-01 |
| AC-02 validation | L4-API-02, L4-UI-01 |
| AC-03 requester forbidden to write | L4-AUTHZ-01, L4-SEC-01 |
| AC-04 gate blocks premature Resolved | L4-API-04, L4-API-10, L4-API-11, L4-UI-02, L4-WF-01, L4-E2E-01, L4-E2E-02, L4-UNIT-01 |
| AC-05 gate release + zero-action pass-through | L4-API-04, L4-API-10, L4-UI-02, L4-WF-01, L4-E2E-01, L4-E2E-02, L4-UNIT-01 |
| AC-06 non-author edit vs resolve (incl. mixed-body 403, T1–T4) | L4-API-03, L4-AUTHZ-02, L4-E2E-01 |
| AC-07 stale-update 409 (ticket + action) | L4-API-06, L4-UI-02, L4-E2E-02, L4-UNIT-02 |
| AC-08 inactive-assignee rejection | L4-API-07, L4-REG-02 |
| AC-09 requester read-only Actions Taken | L4-AUTHZ-01, L4-UI-01, L4-E2E-01, L4-SEC-01 |
| AC-10 dashboard metrics + empty + drill-down (exact numbers + count≡rows) | L4-API-08, L4-API-09, L4-UI-03, L4-E2E-03, L4-PERF-01 |
| AC-11 non-Resolved edges unchanged | L4-API-05 |
| AC-12 Labs 1–3 regression + additive migration | L4-REG-01, L4-REG-02 |
| AC-13 hardening (a11y/responsive/console/dead-UI/duplicate/retry) | L4-UI-04, L4-RESP-01, L4-A11Y-01, L4-E2E-03 |

## 4. Coverage checklist

The plan covers Actions Taken create/edit/resolve (incl. author-vs-any-staff split, mixed-body fail-closed 403, stored-vs-merged order, T1–T4 flips, `false+resolve` 400, `createdAt` alias), all validation axes incl. strict-`400` server-owned fields, authorization in both directions (Requester forbidden, non-author edit forbidden but resolve-only allowed, admin API-only override, admin dashboard without links), the gate in all three blocked edges plus release plus zero-action plus out-of-scope edges plus the `FOR UPDATE` race (L4-API-11) plus detail `pendingFollowUpCount` (L4-API-10), stale-update `409` on both Ticket and Actions Taken writes with malformed-`400`, inactive-assignee rejection, every dashboard metric with exact expected numbers and count≡drill-down equality under frozen clock `NOW` (incl. additive filters and 200-cap non-truncation), full Labs 1–3 regression unmodified with unchanged `INVALID_STATUS_TRANSITION`, additive-migration verification incl. hand-written `CHECK`, accessibility and responsive checks at all three breakpoints, duplicate-click safety, draft preservation, and a performance smoke budget. No implementation-code coverage is claimed in this documentation branch.
