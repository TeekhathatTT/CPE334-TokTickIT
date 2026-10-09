# Lab 4 Test DD / TDD Plan

This plan is written before Lab 4 implementation. Every row starts as `Planned`; no result is claimed until an automated run produces evidence. Statuses and role decisions must be tested from the backend; frontend tests alone are insufficient.

Seeded reference set for dashboard/gate tests (idempotent seed, stable identifiers): requester R1 owns T1 (`OPEN`, owner S1, 1 pending follow-up), T2 (`IN_PROGRESS`, unassigned, 1 resolved follow-up + 1 all-clear entry), T3 (`WAITING_FOR_REQUESTER`, owner S2, zero entries), T4 (`RESOLVED`, owner S1, all follow-ups resolved), T5 (`NEW`, unassigned, zero entries, created today UTC); requester R2 owns T6 (`CLOSED`) and T7 (`OPEN`, owner S1, zero entries). All dashboard expectations below are computed against this set.

## 1. Planned tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| L4-API-01 | API-integration | AC-01 | IT Staff + Administrator create Actions Taken (assigned, unassigned, other-owned) | `201`, server-set `actionDate`, session-derived `performedBy` | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-02 | API-integration | AC-02 | Actions Taken validation (blank/short/long description, unknown result, followUpNote missing-when-required / supplied-when-not-required, oversized attachmentNotes, client actionDate/performedBy rejected) | `400 VALIDATION_ERROR` + `fields`, no row created | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-03 | API-integration | AC-06 | Author-or-Administrator field edit; non-author IT Staff edit rejected; any-staff resolve; double-resolve and resolve-when-not-required | Author/admin `200` (+`updatedAt` bump); non-author `403`; resolve `200` with `followUpResolvedAt`/`resolvedBy`; double-resolve `409 FOLLOW_UP_ALREADY_RESOLVED`; resolve of non-required `400` | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-04 | API-integration | AC-04, AC-05 | Resolution gate: blocked with pending follow-up (each of OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER), allowed after explicit resolve, allowed with zero entries | Pending → `409 RESOLUTION_BLOCKED`, status unchanged; resolved/zero → `200` | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-05 | API-integration | AC-11 | Gate scope: non-Resolved edges unaffected (incl. →Closed, →Cancelled, reopens) with pendings present | Matrix behavior unchanged, gate never fires off its three edges | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-06 | API-integration | AC-07 | Stale `expectedUpdatedAt` on ticket status/assignment/priority and on Actions Taken edit/resolve | `409 VERSION_CONFLICT` + `currentUpdatedAt`, no write; retry after re-fetch succeeds | server/tests/lab-04/ticket-workflow.api.test.ts; server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-API-07 | API-integration | AC-08 | Inactive / Administrator assignment targets rejected (Lab 3 BR-11/BR-16 preserved) | `400`, ownership unchanged | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-API-08 | API-integration | AC-10 | Requester dashboard cards vs seeded set (openTickets, awaitingMyResponse, recentlyResolved, totalSubmitted) incl. zero-state requester | Values equal BR-08 queries; `recentTickets` ≤5 ordered | server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| L4-API-09 | API-integration | AC-10 | Staff dashboard cards vs seeded set (unassignedActive, assignedToMe, waitingForRequester, pendingFollowUp + ids, resolvedPendingClose, newToday UTC) incl. empty states; Administrator reuse | Values equal BR-08 queries; admin `200` aggregates without queue powers | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| L4-AUTHZ-01 | Authorization/API | AC-03, AC-09 | Requester create/edit/resolve forced → `403`; staff dashboard as Requester → `403`; other-user ticket Actions Taken as Requester → `404` | No row changes; no content leaked | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| L4-AUTHZ-02 | Authorization/API | AC-06, AC-10 | Non-author staff edit → `403` but resolve → `200`; admin edits any row; admin dashboard read-only (status write still denied) | Role matrix enforced server-side | server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| L4-UNIT-01 | Unit | AC-04, AC-05 | Gate predicate + result-enum validator in isolation (no DB) | Pending detected; zero/resolved pass; unknown result rejected | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-UNIT-02 | Unit | AC-07 | `expectedUpdatedAt` comparator in isolation (canonical ISO equality, malformed → ignore-or-400 per contract) | Stale detected; equal passes | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-UI-01 | UI component | AC-01, AC-02, AC-09 | ActionsTaken create/edit/resolve UI: counters, conditional followUpNote required-when rule, role-gated controls, conflict copy, draft preservation | Valid flows succeed; invalid blocked inline; requester sees read-only | client/tests/lab-04/ActionsTaken.test.tsx | Planned |
| L4-UI-02 | UI component | AC-04, AC-05, AC-07 | TicketWorkflow UI: gate banner with pending count, RESOLUTION_BLOCKED inline copy, VERSION_CONFLICT reload/keep choice | Banner shows when blocked; conflicts preserve input | client/tests/lab-04/TicketWorkflow.test.tsx | Planned |
| L4-UI-03 | UI component | AC-10 | StaffDashboard + RequesterDashboard UI: cards, values, empty copy, drill-down links, skeleton/failure states | Zero states render; links target documented filters | client/tests/lab-04/StaffDashboard.test.tsx; client/tests/lab-04/RequesterDashboard.test.tsx | Planned |
| L4-UI-04 | UI style | AC-13 | Zen Green: thread distinction (comments vs notes vs actions), badges with text, tokens reused, no new palette | Three threads unmistakable; no color-alone meaning | client/tests/lab-04/ActionsTaken.test.tsx; client/tests/lab-04/StaffDashboard.test.tsx | Planned |
| L4-RESP-01 | Responsive | AC-13 | Dashboards + Actions Taken at desktop ≥992 / tablet 768–991 / mobile <768 | No clipping/overflow; grids collapse; rows become cards | client/e2e/lab-04/dashboards.spec.ts | Planned |
| L4-A11Y-01 | Accessibility | AC-13 | Keyboard-only pass, labels, aria-describedby errors, visible focus, badge text | All controls reachable and named | client/e2e/lab-04/actions-taken-flow.spec.ts | Planned |
| L4-WF-01 | Workflow/API | AC-04, AC-05, AC-06 | End-to-end gate lifecycle via API: create pending → blocked → non-author resolve → Resolved succeeds | Full lifecycle `201 → 409 → 200 → 200` | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| L4-REG-01 | Migration/regression | AC-12 | Lab 4 migration additive-only (new table/indexes; no Lab 1–3 alter/drop) | Schema diff clean; prior suites unmodified-pass | server/tests/lab-04/ticket-workflow.api.test.ts; migration verification | Planned |
| L4-REG-02 | Regression | AC-08, AC-12 | Labs 1–3 suites rerun (auth, requester tickets/attachments, queue/detail, comments, notes, admin users, problemAppearsResolvedAt) | All prior tests pass unmodified | server/tests/lab-0{1,2,3}/*; client/tests/lab-0{1,2,3}/*; client/e2e/lab-03/* | Planned |
| L4-PERF-01 | Performance-smoke | AC-10 | Dashboard endpoints on seeded scale: p95 < 500ms local, exact counts | Meets budget with correct values | server/tests/lab-04/staff-dashboard.api.test.ts; server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| L4-SEC-01 | Security/API | AC-03, AC-09 | Safe-error matrix for Lab 4 routes (401/403/404/400/409/500 shapes, no hash/leak, no enumeration) | Envelope + codes per api-spec §4 | server/tests/lab-04/actions-taken.api.test.ts | Planned |
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
| AC-04 gate blocks premature Resolved | L4-API-04, L4-UI-02, L4-WF-01, L4-E2E-01, L4-E2E-02, L4-UNIT-01 |
| AC-05 gate release + zero-action pass-through | L4-API-04, L4-UI-02, L4-WF-01, L4-E2E-01, L4-E2E-02, L4-UNIT-01 |
| AC-06 non-author edit vs resolve | L4-API-03, L4-AUTHZ-02, L4-E2E-01 |
| AC-07 stale-update 409 (ticket + action) | L4-API-06, L4-UI-02, L4-E2E-02, L4-UNIT-02 |
| AC-08 inactive-assignee rejection | L4-API-07, L4-REG-02 |
| AC-09 requester read-only Actions Taken | L4-AUTHZ-01, L4-UI-01, L4-E2E-01, L4-SEC-01 |
| AC-10 dashboard metrics + empty + drill-down | L4-API-08, L4-API-09, L4-UI-03, L4-E2E-03, L4-PERF-01 |
| AC-11 non-Resolved edges unchanged | L4-API-05 |
| AC-12 Labs 1–3 regression + additive migration | L4-REG-01, L4-REG-02 |
| AC-13 hardening (a11y/responsive/console/dead-UI/duplicate/retry) | L4-UI-04, L4-RESP-01, L4-A11Y-01, L4-E2E-03 |

## 4. Coverage checklist

The plan covers Actions Taken create/edit/resolve (incl. author-vs-any-staff split), all five validation axes, authorization in both directions (Requester forbidden, non-author edit forbidden but resolve allowed, admin override), the gate in all three blocked edges plus release plus zero-action plus out-of-scope edges, stale-update `409` on both Ticket and Actions Taken writes, inactive-assignee rejection, every dashboard metric incl. its zero case against the seeded set above, full Labs 1–3 regression unmodified, additive-migration verification, accessibility and responsive checks at all three breakpoints, duplicate-click safety, draft preservation, and a performance smoke budget. No implementation-code coverage is claimed in this documentation branch.
