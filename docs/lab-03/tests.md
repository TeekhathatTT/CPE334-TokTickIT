# Lab 3 Test DD / TDD Plan

This plan is written before Lab 3 implementation. Every row starts as `Planned`; no result is claimed until an automated run produces evidence.

## 1. Planned tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Valid login | Authenticated response; safe user data | server/tests/lab-03/auth.api.test.ts | Planned |
| API-08 | API | AC-04 | Requester requests Internal Notes | Forbidden; no note data returned | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| E2E-02 | E2E | AC-02 | Initial password login and change | Normal app opens only after valid change | e2e/lab-03/authentication.spec.ts | Planned |
| API-02 | API | AC-01, AC-16 | Invalid credentials and inactive account | Same safe 401 response; no account enumeration | server/tests/lab-03/auth.api.test.ts | Planned |
| API-03 | API | AC-05 | Logout | Session invalidated; protected call returns 401 | server/tests/lab-03/auth.api.test.ts | Planned |
| API-04 | API | AC-17 | Password boundaries | Rules enforced at minimum and invalid values rejected | server/tests/lab-03/auth.api.test.ts | Planned |
| AUTHZ-01 | Security/API | AC-03, AC-15 | Client requesterId tampering | Session identity controls ownership; other data returns 404 | server/tests/lab-03/authorization.api.test.ts | Planned |
| AUTHZ-02 | Security/API | AC-04, AC-09 | Direct role authorization | Requester cannot read notes; permitted roles can | server/tests/lab-03/authorization.api.test.ts | Planned |
| API-05 | API | AC-06 | Staff queue queries | Search, filters, sort, pagination, counts, invalid query | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-06 | API | AC-07 | Claim/reassign | Only active IT Staff owner accepted | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-07 | API | AC-08, AC-19 | Priority/status transitions | Allowed transitions succeed; invalid transitions conflict | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-09 | API | AC-09 | Comment/note append-only | Valid content records backend author/time; blank/edit/delete rejected | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-10 | API | AC-18 | Problem Appears Resolved | Own Requester can signal; no formal Resolved/Closed transition | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-11 | API | AC-10 | Administrator user listing/search/filter | Safe fields only; non-admin forbidden | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-12 | API | AC-11 | User creation and duplicate email | One role accepted; normalized duplicate returns 409 | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-13 | API | AC-10 | User edit and activation | Name/email/role/status updates persist | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-14 | API | AC-12, AC-13 | Administrator safety | Self-deactivation and last-admin removal return 409 | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-15 | API | AC-14 | Reset initial password | Hash changes and must-change flag is true | server/tests/lab-03/users-admin.api.test.ts | Planned |
| UI-01 | UI component | AC-01, AC-02, AC-17 | Login/password screens | Validation, busy state, checklist, safe failure | client/tests/lab-03/Login.test.tsx; client/tests/lab-03/ChangePassword.test.tsx | Planned |
| UI-02 | UI component | AC-06 | Staff queue | Controls, loading, empty/no-results, responsive representation | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned |
| UI-03 | UI component | AC-07, AC-08, AC-09 | Staff detail | Role controls and distinct public/private panels | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned |
| UI-04 | UI component | AC-10, AC-11, AC-12, AC-13, AC-14 | User management | List/search/filter/create/edit/safety feedback | client/tests/lab-03/UserManagement.test.tsx | Planned |
| UI-05 | UI style | AC-21, AC-22 | Zen Green and accessibility | Tokens, focus, labels, badge text, no selector remnants | client/tests/lab-03/visual-accessibility.test.tsx | Planned |
| REG-01 | Migration/regression | AC-15, AC-20 | Lab 2 records and ownership | Existing Tickets/Attachments survive and map to Users correctly | server/tests/lab-03/authorization.api.test.ts; migration verification | Planned |
| SEC-01 | Security/API | AC-23 | Safe failure matrix | 401/403/400/404/409/500 shapes and no protected leakage | server/tests/lab-03/authorization.api.test.ts | Planned |
| E2E-01 | E2E | AC-15, AC-18 | Requester regression | Authenticated Requester creates/views/comment/signals own ticket | e2e/lab-03/authentication.spec.ts | Planned |
| E2E-03 | E2E | AC-06, AC-07, AC-08, AC-09, AC-19 | Staff ticket flow | Queue to detail, assignment, priority/status, comments/notes | e2e/lab-03/staff-ticket-flow.spec.ts | Planned |
| E2E-04 | E2E | AC-10, AC-11, AC-12, AC-13, AC-14 | User administration | Complete minimalist admin flow | e2e/lab-03/user-administration.spec.ts | Planned |
| RESP-01 | Responsive | AC-22 | Desktop/tablet/mobile | No clipping, overlap, or unintended horizontal scroll | e2e/lab-03/staff-ticket-flow.spec.ts | Planned |
| A11Y-01 | Accessibility | AC-22 | Keyboard and focus | All controls reachable; labels and focus states present | e2e/lab-03/authentication.spec.ts | Planned |

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
e2e/lab-03/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

These implementation/test files are not created in the documentation branch. Visual evidence later belongs under `artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.

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
| AC-17 | API-04, UI-01 |
| AC-18 | API-10, E2E-01 |
| AC-19 | API-07, E2E-03 |
| AC-20 | REG-01 |
| AC-21 | UI-01, UI-02, UI-03, UI-04, SEC-01 |
| AC-22 | UI-05, RESP-01, A11Y-01 |
| AC-23 | SEC-01, AUTHZ-02 |

## 4. Coverage checklist

The plan covers valid/invalid login, inactive accounts, password boundaries, logout, role navigation, direct API authorization, Requester regression, ownership, queue queries, IT Priority, all eight statuses, Public Comments, Internal Notes, user administration, migration, responsive behavior, accessibility, and safe failures. All statuses and role decisions must be tested from the backend; frontend tests alone are insufficient.
