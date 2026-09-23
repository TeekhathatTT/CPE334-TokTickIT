# Lab 3 Test DD / TDD Plan

This plan is written before Lab 3 implementation. Every row starts as `Planned`; no result is claimed until an automated run produces evidence.

## 1. Planned tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Valid login | Authenticated response; safe user data | server/tests/lab-03/auth.api.test.ts | Pass |
| API-08 | API | AC-04 | Requester requests Internal Notes | Forbidden; no note data returned | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| E2E-02 | E2E | AC-02 | Initial password login and change | Normal app opens only after valid change | client/e2e/authentication.spec.ts | Pass |
| API-02 | API | AC-01, AC-16 | Invalid credentials and inactive account | Same safe 401 response; no account enumeration | server/tests/lab-03/auth.api.test.ts | Pass |
| API-03 | API | AC-05 | Logout | Session invalidated; protected call returns 401 | server/tests/lab-03/auth.api.test.ts | Pass |
| API-04 | API | AC-17 | Password boundaries | Rules enforced at minimum and invalid values rejected | server/tests/lab-03/auth.api.test.ts | Pass |
| AUTHZ-01 | Security/API | AC-03, AC-15 | Client requesterId tampering | Session identity controls ownership; other data returns 404 | server/tests/lab-03/authorization.api.test.ts | Pass |
| AUTHZ-02 | Security/API | AC-04, AC-09 | Direct role authorization | Requester cannot read notes; permitted roles can | server/tests/lab-03/authorization.api.test.ts | Pass |
| API-05 | API | AC-06 | Staff queue queries | Search, filters, sort, pagination, counts, invalid query | server/tests/lab-03/staff-queue.api.test.ts | Pass |
| API-06 | API | AC-07 | Claim/reassign | Only active IT Staff owner accepted | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-07 | API | AC-08, AC-19 | Priority/status transitions | Allowed transitions succeed; invalid transitions conflict | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| API-09 | API | AC-09 | Comment/note append-only | Valid content records backend author/time; blank/edit/delete rejected | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| API-10 | API | AC-18 | Problem Appears Resolved | Own Requester can signal; no formal Resolved/Closed transition | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| API-11 | API | AC-10 | Administrator user listing/search/filter | Safe fields only; non-admin forbidden | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-12 | API | AC-11 | User creation and duplicate email | One role accepted; normalized duplicate returns 409 | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-13 | API | AC-10 | User edit and activation | Name/email/role/status updates persist | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-14 | API | AC-12, AC-13 | Administrator safety | Self-deactivation and last-admin removal return 409 | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-15 | API | AC-14 | Reset initial password | Hash changes and must-change flag is true | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-16 | API | AC-10 | Plain activate/deactivate | Non-self, non-last-admin status changes succeed normally | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-17 | API | AC-10, AC-11 | Update duplicate email and role change | Edit-time duplicate email returns 409; role change persists | server/tests/lab-03/users-admin.api.test.ts | Pass |
| API-18 | API | AC-12, AC-13 | P2034 retry / concurrency safety | Retry-on-P2034 returns 200; exhausted retries return 500; AppErrors not retried; concurrent requests no 500 from P2034 | server/tests/lab-03/users-admin.concurrency.test.ts | Pass |
| UI-01 | UI component | AC-01, AC-02, AC-17 | Login/password screens | Validation, busy state, checklist, safe failure | client/tests/lab-03/Login.test.tsx; client/tests/lab-03/ChangePassword.test.tsx | Pass |
| UI-02 | UI component | AC-06 | Staff queue | Controls, loading, empty/no-results, responsive representation | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned (spec is `it.todo` — component not implemented) |
| UI-03 | UI component | AC-07, AC-08, AC-09 | Staff detail | Role controls and distinct public/private panels | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned (spec is `it.todo` — component not implemented) |
| UI-04 | UI component | AC-10, AC-11, AC-12, AC-13, AC-14 | User management | List/search/filter/create/edit/safety feedback, including the themed activate/deactivate confirmation dialog and duplicate-email error | client/tests/lab-03/UserManagement.test.tsx | Pass |
| UI-05 | UI style | AC-21, AC-22 | Zen Green and accessibility | Tokens, focus, labels, badge text, no selector remnants | client/tests/lab-03/visual-accessibility.test.tsx | Planned |
| REG-01 | Migration/regression | AC-15, AC-20 | Lab 2 records and ownership | Existing Tickets/Attachments survive and map to Users correctly | server/tests/lab-03/authorization.api.test.ts; migration verification | Pass |
| SEC-01 | Security/API | AC-23 | Safe failure matrix | 401/403/400/404/409/500 shapes and no protected leakage | server/tests/lab-03/authorization.api.test.ts | Pass |
| E2E-01 | E2E | AC-15, AC-18 | Requester regression | Authenticated Requester creates/views/comment/signals own ticket | client/e2e/authentication.spec.ts | Pass |
| E2E-03 | E2E | AC-06, AC-07, AC-08, AC-09, AC-19 | Staff ticket flow | Queue to detail, assignment, priority/status, comments/notes | client/e2e/staff-ticket-flow.spec.ts | Planned (app renders "Staff queue … available." placeholder — E2E skips with explicit reason, not a fake pass) |
| E2E-04 | E2E | AC-10, AC-11, AC-12, AC-13, AC-14 | User administration | Complete minimalist admin flow | client/e2e/user-administration.spec.ts | Pass |
| RESP-01 | Responsive | AC-22 | Desktop/tablet/mobile | No clipping, overlap, or unintended horizontal scroll | client/e2e/staff-ticket-flow.spec.ts | Partial (queue placeholder captured at 3 viewports; detail screenshots skipped — no detail screen is rendered yet) |
| A11Y-01 | Accessibility | AC-22 | Keyboard and focus | All controls reachable; labels and focus states present | client/e2e/authentication.spec.ts | Planned |

## 2. Required file plan

Server planned paths:

```text
server/tests/lab-03/
├── auth.api.test.ts
├── authorization.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts
```

Frontend planned paths:

```text
client/tests/lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx
```

E2E planned paths:

```text
client/e2e/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

> **Convention note:** this repository has never used a top-level `e2e/` directory — Playwright's `testDir` is `client/e2e`, and Lab 2's E2E spec already lives at `client/e2e/lab-02.spec.ts` with no `lab-XX` subfolder. All Lab 3 E2E specs follow that same, already-established convention and live flat at `client/e2e/`. All rows above and the traceability table reflect the real paths.

> **Evidence — full automated verification (2026-09-23, final pass):** Every check below was executed on the current working tree and logged for submission:
>
> - **Server — ESLint:** `npm run lint` exit 0 (server/eslint.config.mjs, flat config).
> - **Server — TypeScript build:** `npm run build` (`tsc`) exit 0.
> - **Server — unit/structural tests (mocked DB):** `npm test` → **80 passed / 0 failed** across 13 files (Lab 01 health/categories, Lab 02 tickets/attachments/requesters, Lab 03 auth/authorization/comments/admin-CRUD + P2034 concurrency-retry). Mock fix for `comments-notes.api.test.ts` (adds `ticket.findUnique`).
> - **Server — integration tests (real PostgreSQL):** `npm run test:int` → **1/1 passed** (`server/tests/int/lab-03/users-admin.concurrency.int.test.ts`, 346 ms) against the dockerized DB (postgres:16-alpine, `toktickit-db`); fixtures cleaned up after the run. Config: `server/vitest.int.config.ts`; unit config excludes `tests/int/**`.
> - **Client — ESLint:** `npm run lint` exit 0.
> - **Client — build:** `npm run build` (`tsc && vite build`) exit 0.
> - **Client — unit tests (jsdom, mocked API):** `npm test` → **49 passed / 19 todo / 2 skipped / 11 files**. The 2 skipped are `StaffTicketQueue.test.tsx` + `StaffTicketDetail.test.tsx` — intentionally `it.todo` (PLANNED), reported as skipped rather than as passes.
> - **End-to-end (chromium, live app + live DB):** `npx playwright test` → **19 passed / 5 skipped / 0 failed** (24 tests). The 5 skipped are the staff-ticket-flow behavioural specs: the app currently renders the placeholder shell ("Staff queue … is available.") because the Staff Queue/Detail UI is PLANNED, so those specs `test.skip(…, "… not implemented yet — PLANNED")` with an explicit reason instead of passing falsely. `client/e2e/global-setup.ts` (+ `server/scripts/e2e-setup.mjs`) deterministically resets the four auth fixtures (3 login-ready + 1 forced-change) before every run. Visual baselines compare on the platform they were rendered on: `snapshotPathTemplate` appends `{platform}` (`win32`/`linux`), and both sets are committed under `client/e2e/lab-02.spec.ts-snapshots/`, so local Windows and GitHub Actions (Linux) each compare their own real pixels instead of failing on font/scrollbar differences.
> - **Logs saved:** `artifacts/lab-03/e2e-full-run-{1..5}.log` (progressive runs during fixes; the last, run 5, is the clean pass) and screenshots under `artifacts/lab-03/screenshots/{authentication,user-management,staff-queue}/`.

> **GitHub Actions Check Runs:** `.github/workflows/ci.yml` runs the full matrix — `server` (lint/build/unit), `server-integration` (migrate+seed+`test:int` on a postgres service container), `client` (lint/build/unit), and `e2e` (postgres service + Playwright + `E2E_*` defaults). The Check Runs appear automatically once the branch is pushed and the workflow triggers on push/PR.

> **Evidence (live E2E fixes beyond the Lab 2 flow):** `client/e2e/user-administration.spec.ts` now anchors Edit / Set initial password to the row containing the managed user's unique email and waits for that row to render; the user table re-fetches on a 250 ms debounce, so an un-synchronized click previously hit a stale row (a "Set initial password" on the logged-in admin would rotate Morgan Davis's password and break every later admin login). `client/e2e/authentication.spec.ts` no longer waits for a `/login` URL (the app has no client-side router) and uses fixture-default credentials, so the login and forced-change flows run instead of skipping on missing env vars. `client/e2e/lab-02.spec.ts` logs the requester in through the real sign-in form and scopes the submit "Create Ticket" button to the `main` region (it shares a name with the nav tab).

These implementation/test files are not created in the documentation branch. Visual evidence later belongs under `artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.

> **Status (evidence artifacts):** `client/e2e/lab-02.spec.ts-snapshots/` contains the committed per-platform baselines `create-ticket-{mobile,tablet,desktop}-{win32,linux}.png` (compared, not just written), and `artifacts/lab-03/screenshots/` contains live captures: `authentication/{desktop,tablet,mobile}.png`, `user-management/{desktop,tablet,mobile}.png`, and `staff-queue/{desktop,tablet,mobile}.png` (the current PLANNED placeholder shell as shipped — the staff-queue screenshot test captures instead of skipping). `staff-ticket-detail/` intentionally has no PNG yet: the app renders no ticket-detail screen for IT Staff in this branch, so there is nothing genuine to capture — only `.gitkeep` keeps the planned directory in the submission. Run logs are in `artifacts/lab-03/e2e-full-run-{1..5}.log` and `artifacts/lab-03/logs/client-unit-afterfix.log`. Live GitHub Actions Check Runs: commit `f56fc4b` on `feature/lab3-admin` → **server, server-integration, client, e2e = all pass** (the workflow also generates the per-platform baselines on CI). These files — plus `.github/workflows/ci.yml`, `client/e2e/global-setup.ts`, and `server/scripts/e2e-setup.mjs` — are part of the Part 9 submission evidence.

## 3. AC to test traceability

| Acceptance Criterion | Planned test(s) |
|---|---|
| AC-01 | API-01, API-02, UI-01 |
| AC-02 | E2E-02, UI-01 |
| AC-03 | AUTHZ-01 |
| AC-04 | API-08, AUTHZ-02 |
| AC-05 | API-03 |
| AC-06 | API-05, E2E-03, UI-02 |
| AC-07 | API-06, E2E-03, UI-03 |
| AC-08 | API-07, E2E-03, UI-03 |
| AC-09 | API-09, AUTHZ-02, E2E-03 |
| AC-10 | API-11, API-13, API-16, API-17, E2E-04, UI-04 |
| AC-11 | API-12, API-17, UI-04 |
| AC-12 | API-14, E2E-04, UI-04 |
| AC-13 | API-14, E2E-04, UI-04 |
| AC-14 | API-15, E2E-02, E2E-04 |
| AC-15 | REG-01, E2E-01, AUTHZ-01 |
| AC-16 | API-02, SEC-01 |
| AC-17 | API-04, UI-01 |
| AC-18 | API-10, E2E-01 |
| AC-19 | API-07, E2E-03 |
| AC-20 | REG-01 |
| AC-21 | UI-01, UI-02, UI-03, UI-04, SEC-01 |
| AC-22 | UI-05, RESP-01, A11Y-01 |
| AC-23 | SEC-01, AUTHZ-02 |

## 4. Coverage checklist

The plan covers valid/invalid login, inactive accounts, password boundaries, logout, role navigation, direct API authorization, Requester regression, ownership, queue queries, IT Priority, all eight statuses, Public Comments, Internal Notes, user administration, migration, responsive behavior, accessibility, and safe failures. All statuses and role decisions must be tested from the backend; frontend tests alone are insufficient.
