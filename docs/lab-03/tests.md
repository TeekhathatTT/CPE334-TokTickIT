# Lab 3 Test DD / TDD Plan

This plan is written before Lab 3 implementation. Every row starts as `Planned`; no result is claimed until an automated run produces evidence.

## 1. Planned tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Valid login | Authenticated response; safe user data | server/tests/lab-03/auth.api.test.ts | Pass |
| API-08 | API | AC-04 | Requester requests Internal Notes | Forbidden; no note data returned | server/tests/lab-03/comments-notes.api.test.ts | Pass |
| E2E-02 | E2E | AC-02 | Initial password login and change | Normal app opens only after valid change | client/e2e/lab-03/authentication.spec.ts | Pass |
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
| UI-01 | UI component | AC-01, AC-02, AC-17 | Login/password screens | Validation, busy state, checklist, safe failure | client/tests/lab-03/Login.test.tsx; client/tests/lab-03/ChangePassword.test.tsx | Pass |
| UI-02 | UI component | AC-06 | Staff queue | Controls, loading, empty/no-results, responsive representation | client/tests/lab-03/StaffTicketQueue.test.tsx | Pass |
| UI-03 | UI component | AC-07, AC-08, AC-09 | Staff detail | Role controls and distinct public/private panels | client/tests/lab-03/StaffTicketDetail.test.tsx | Pass |
| UI-04 | UI component | AC-10, AC-11, AC-12, AC-13, AC-14 | User management | List/search/filter/create/edit/safety feedback | client/tests/lab-03/UserManagement.test.tsx | Pass |
| UI-05 | UI style | AC-21, AC-22 | Zen Green and accessibility | Tokens, focus, labels, badge text, no selector remnants | client/tests/lab-03/Login.test.tsx; client/tests/lab-03/StaffTicketQueue.test.tsx; client/tests/lab-03/StaffTicketDetail.test.tsx; client/tests/lab-03/UserManagement.test.tsx | Pass |
| UNIT-01 | Unit | AC-17 | Password hashing/verification in isolation | Same password verifies; wrong password fails; hashes differ per salt | server/tests/lab-03/auth.api.test.ts | Pass |
| UNIT-02 | Unit | AC-19 | Status-transition validator in isolation | Allowed transitions pass; invalid transitions rejected without DB access | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pass |
| UNIT-03 | Unit | AC-23 | Authorization guard in isolation | Role/ownership predicate allows permitted roles and denies others | server/tests/lab-03/authorization.api.test.ts | Pass |
| REG-01 | Migration/regression | AC-15, AC-20 | Lab 2 records and ownership | Existing Tickets/Attachments survive and map to Users correctly | server/tests/lab-03/authorization.api.test.ts; migration verification | Pass |
| SEC-01 | Security/API | AC-23 | Safe failure matrix | 401/403/400/404/409/500 shapes and no protected leakage | server/tests/lab-03/authorization.api.test.ts | Pass |
| E2E-01 | E2E | AC-15, AC-18 | Requester regression | Authenticated Requester creates/views/comment/signals own ticket | client/e2e/lab-03/authentication.spec.ts | Pass |
| E2E-03 | E2E | AC-06, AC-07, AC-08, AC-09, AC-19 | Staff ticket flow | Queue to detail, assignment, priority/status, comments/notes | client/e2e/lab-03/staff-ticket-flow.spec.ts | Pass |
| E2E-04 | E2E | AC-10, AC-11, AC-12, AC-13, AC-14 | User administration | Complete minimalist admin flow | client/e2e/lab-03/user-administration.spec.ts | Pass |
| RESP-01 | Responsive | AC-22 | Desktop/tablet/mobile | No clipping, overlap, or unintended horizontal scroll | client/e2e/lab-03/staff-ticket-flow.spec.ts | Pass |
| A11Y-01 | Accessibility | AC-22 | Keyboard and focus | All controls reachable; labels and focus states present | client/e2e/lab-03/authentication.spec.ts | Pass |

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
client/e2e/lab-03/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

These files already exist as empty stubs from scaffolding; no test logic is added in this documentation branch. Visual evidence later belongs under `artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.

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
| AC-10 | API-11, API-13, E2E-04, UI-04 |
| AC-11 | API-12, UI-04 |
| AC-12 | API-14, E2E-04, UI-04 |
| AC-13 | API-14, E2E-04, UI-04 |
| AC-14 | API-15, E2E-02, E2E-04 |
| AC-15 | REG-01, E2E-01, AUTHZ-01 |
| AC-16 | API-02, SEC-01 |
| AC-17 | API-04, UI-01, UNIT-01 |
| AC-18 | API-10, E2E-01 |
| AC-19 | API-07, E2E-03, UNIT-02 |
| AC-20 | REG-01 |
| AC-21 | UI-01, UI-02, UI-03, UI-04, SEC-01 |
| AC-22 | UI-05, RESP-01, A11Y-01 |
| AC-23 | SEC-01, AUTHZ-02, UNIT-03 |

## 4. Coverage checklist

The plan covers valid/invalid login, inactive accounts, password boundaries, logout, role navigation, direct API authorization, Requester regression, ownership, queue queries, IT Priority, all eight statuses, Public Comments, Internal Notes, user administration, migration, responsive behavior, accessibility, and safe failures. All statuses and role decisions must be tested from the backend; frontend tests alone are insufficient.

## 5. Final results (`feature/lab3-e2e-integration`, 2026-09-27)

### 5.1 Unit / API / component (actually run — all pass)

- Server: `npm run test` in `server/` → **11 files, 124 tests, all pass**
  (Lab 1: health, categories; Lab 2: requesters, tickets, attachments;
  Lab 3: auth, authorization, staff-queue, staff-ticket-detail,
  comments-notes, users-admin). Covers API-01–API-15, AUTHZ-01/02,
  UNIT-01/02/03, REG-01, SEC-01. Re-verified 2026-09-28 after the
  `runSerializableTransaction` bind fix: still 124/124.
- Client: `npm run test` in `client/` → **12 files, 61 tests, all pass**
  (Lab 1/2 suites plus Lab 3 Login, ChangePassword, StaffTicketQueue,
  StaffTicketDetail, UserManagement). Covers UI-01–UI-05. Re-run **after**
  the Step 1 UI alignment (tokens file, badge/token reconciliation, avatar
  additions): still 61/61 — no test couples to classes or colors, and no
  assertion about behavior was changed. Re-verified 2026-09-28: still 61/61.
- No integration-only regressions: the merged `lab3-staging` content passes
  every prior suite unchanged, so this branch contains no functional fixes
  except the documented E2E/visual items in §5.3.

### 5.2 E2E (executed live 2026-09-28 — all pass)

29 E2E tests executed live with `npm run test:e2e` in `client/` (default
workers) against Postgres at `127.0.0.1:5434` (same credentials as
`server/.env` / `docker-compose.yml`): **29/29 pass** — 6 in
`client/e2e/lab-02.spec.ts` (Lab 2 regression, migrated to Lab 3 auth, see
§5.4) and 23 Lab 3 tests across the three planned files (plus the shared
`client/e2e/lab-03/helpers.ts` and `client/e2e/global-setup.ts`): 7 in
`authentication.spec.ts` (E2E-01/E2E-02/A11Y-01), 7 in
`staff-ticket-flow.spec.ts` (E2E-03/RESP-01), 9 in
`user-administration.spec.ts` (E2E-04). Command and flow:

```powershell
npm run test:e2e                # globalSetup runs prisma migrate deploy + reseed automatically
# E2E_SEED=0 npm run test:e2e   # skip reseed with hand-managed data
```

`globalSetup` now guarantees a migrated + freshly seeded database on every
run (all seed users on the local-dev initial password with
`mustChangePassword=true`); the Playwright `webServer` entry passes an
explicit `DATABASE_URL`/`CLIENT_URL`/`PORT` to the API so the E2E server
never boots without a database connection. Created rows use run-unique
emails/content so reruns after a reseed never collide. Each spec file owns
disjoint seed accounts (documented in `helpers.ts`, extended to
`lab-02.spec.ts` → emily.davis) so parallel workers cannot steal each
other's rotated passwords. Cross-test state (rotated passwords, mid-file
created users) is file-backed under `client/test-results/lab-03-shared/`
(cleared by `globalSetup`) because Playwright may recycle the worker
process between tests — module memory alone does not survive.

Re-verified after the Step 1 UI alignment: the alignment changed only CSS
values (no class renames, no copy changes) plus `aria-hidden` avatar spans,
so no E2E selector or text assertion is affected — `npx tsc --noEmit` is
clean and `npx playwright test --list` still collects 29 tests. The
screenshots in `artifacts/lab-03/screenshots/` were re-captured after the
alignment (timestamps verified) and now show the aligned UI.

### 5.3 Integration-branch changes (beyond E2E/docs/evidence)

1. **UI alignment to `docs/lab-03/ui-reference/toktickit-mockup.html`.**
   New `client/src/styles/zen-green-tokens.css` (reference `:root`, `.b-*`
   badges, avatar, tabs); `zen-green.css` reconciled to the reference values
   (mockup wins — override list in the PR description); avatar-circle
   initials added to comment/note headers (`aria-hidden`); auth submits
   full-width; password checklist in the green rules box. Deliberately NOT
   adopted: tab-strip restructure, admin side-by-side layout, numbered
   pager, dark mode (see `visual-checklist.md` §Outcome). No logic, API,
   route, or assertion changed; client suite still 61/61.
2. **`client/playwright.config.ts` — E2E `baseURL` `127.0.0.1` → `localhost`.**
   The API CORS/CSRF contract allows exactly one web origin (`CLIENT_URL`,
   default `http://localhost:5173`). Under the old `127.0.0.1` baseURL every
   session/authenticated call failed CORS ("Failed to fetch", captured in a
   screenshot during evidence collection). Test-harness alignment only; no
   application behavior changed.
3. **`client/src/styles/zen-green.css` — tablet table→cards.** Found via the
   visual checklist: the 9-column staff queue clipped at 834px
   (`overflow: hidden` with no fallback). At `≤991px` the list screens now
   render the stacked cards; desktop tables are untouched. See
   `docs/lab-03/visual-checklist.md`.

### 5.4 Gaps closed by the live E2E pass (2026-09-28)

- E2E live execution is done: `npm run test:e2e` → 29/29 pass on evidence
  (see §5.2). The former `Not run*` footnote (`*` = implemented +
  typechecked + collected, never executed live) no longer applies — every
  E2E/RESP/A11Y row in §1 is Pass on a real run.
- Fixes the live run required (all verified by re-running the suite, never
  by inspection alone):
  1. Real server bug: `PATCH /api/admin/users/:id` returned 500
     (`Unable to update user`) on real Postgres because
     `runSerializableTransaction` invoked a detached
     `prisma.$transaction` (lost `this` → `_engineConfig` TypeError). The
     mocked API suite could not catch it (mocks lack `$transaction` and take
     the fallback path). Fixed by binding the call; verified live (role
     edit → 200, last-admin demotion → 409 with the specified message).
  2. E2E selectors assumed label names without the required-field asterisk
     (`getByLabel("Email", {exact:true})`), but the rendered accessible name
     is `"Email *"` (probe-verified). Selectors now match reality; no app
     markup changed.
  3. Strict-mode violations fixed by scoping (`Signed-in user`, nav vs
     `main` Create Ticket, Users-table role badge with debounce-aware
     `toHaveCount`, `.first()` on duplicated guard text / Clear Filters).
  4. `page.reload()` on the staff detail view dropped (the app has no URL
     router — reload returns to the role home); the test reopens the ticket
     and asserts the persisted value instead.
  5. A11Y keyboard test tolerates Chromium's body-first Tab entry (bounded
     Tab-until-focused, order assertion unchanged).
  6. E2E environment made self-sufficient: explicit `DATABASE_URL` for the
     API `webServer` entry and `prisma migrate deploy` before seed in
     `globalSetup`, so a bare `npm run test:e2e` works on a fresh database.
- `client/e2e/lab-02.spec.ts` (Lab 2 regression) is migrated, not deleted:
  the anonymous Development Requester selector it drove was removed by
  BR-03/BR-25, so the file now signs in as seed requester emily.davis
  (disjoint account, same forced-change handling as E2E-01) and keeps every
  original assertion (create + ticket number, validation texts,
  search/clear, 3-viewport overflow via the RESP-01 DOM measurement instead
  of OS-sensitive pixel snapshots). Its 6 tests are part of the 29/29.
- `user-administration.spec.ts` documents why deactivating a *different* last
  admin is unreachable by construction (any logged-in admin actor staying
  active means the target is never last); the reachable BR-21 trigger
  (self-demotion of the sole admin → `409 At least one active Administrator
  must remain.`) is asserted in UI, and the race guard at API level is
  covered by `users-admin.api.test.ts` (API-14, Pass).
