# Lab 3 Specification

## 1. Sprint Goal

Deliver the first authenticated TokTickIT workflow: users can sign in securely, Requesters retain ownership of their Lab 2 tickets, IT Staff can operate a shared ticket queue, and Administrators can perform intentionally minimal user management. The result must be testable, responsive, and consistent with the existing Zen Green application.

## 2. Stakeholder Request

Replace the Lab 2 development identity selector with real role-aware access. Requesters need a safe way to submit and follow their own tickets; IT Staff need a practical queue and collaboration tools; Administrators need only the user controls required to keep access usable without turning this lab into a full identity-management product.

## 3. Scope

### 3.1 Included

- Email/password authentication, logout, current-user retrieval, secure sessions, and mandatory first-login password change.
- Three mutually exclusive roles: Requester, IT Staff, and Administrator.
- Authenticated continuation of Lab 2 ticket and attachment behavior, including ownership protection.
- Requester Public Comments and a Problem Appears Resolved action.
- IT Staff queue, search, filters, sorting, pagination, ticket detail, claim/reassign, IT Priority, permitted status changes, Public Comments, and Internal Notes.
- Minimal Administrator user list, search, optional role filter, create/edit, activation, one-role assignment, and initial-password reset.
- Migration of existing Requester ownership, Tickets, Attachments, Categories, and Related Systems without data loss.
- Idempotent local seed data, automated test plans, responsive UI, and accessibility evidence.

### 3.2 Explicitly Excluded

- Email invitations, password-reset email, multi-factor authentication, social login, and single sign-on.
- Self-registration and Requester-created accounts.
- Actions Taken by IT Staff.
- Formal SLA calculation, escalation rules, and notification services.
- Dashboards and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, and customer administration.
- Production-grade deployment or cloud infrastructure changes.
- Multiple roles assigned to one user.
- User deletion, bulk user operations, user import or export, and account-history screens.
- Department, organization, profile-photo, and other extended user-profile management.
- Email delivery of initial passwords or reset links.
- Account unlocking, administrator approval workflows, and advanced identity-management functions.
- Advanced user-list features such as mandatory pagination, multi-column sorting, and multiple simultaneous filters.

## 4. Functional Requirements

- **FR-01 Authentication:** A user can log in with email and password, log out, retrieve the current authenticated user, and change a password when required. Passwords are hashed and never returned.
- **FR-02 First login:** A user with `mustChangePassword` cannot enter normal application screens until a valid new password is saved.
- **FR-03 Account state:** Inactive users cannot authenticate or use protected endpoints; errors are safe and non-enumerating.
- **FR-04 Authorization:** Every protected operation is authorized on the server using exactly one of Requester, IT Staff, or Administrator; UI visibility is only feedback.
- **FR-05 Requester regression:** Authenticated Requesters can continue all Lab 2 ticket and attachment operations, but the authenticated identity replaces `x-requester-id`, and the Development Requester selector and Change Requester action are removed.
- **FR-06 Requester collaboration:** Requesters can add and read Public Comments on their own tickets and can select Problem Appears Resolved without formally setting Resolved or Closed.
- **FR-07 IT Staff queue:** IT Staff can retrieve a queue with search, defined filters, sorting, pagination, counts, and clear loading/empty/no-results/failure states.
- **FR-08 IT Staff operations:** IT Staff can view ticket detail, claim/assign/reassign to an active IT Staff owner, change IT Priority, and perform only permitted status transitions.
- **FR-09 Notes and comments:** IT Staff can append Public Comments and Internal Notes; Administrators can append/read Internal Notes and Public Comments only as granted by the matrix. Requesters never receive Internal Notes.
- **FR-10 Administrator list:** Administrators can list users with Name, Email, Role, Status, and Edit action; search by name/email and optionally filter by role.
- **FR-11 Administrator create/edit:** Administrators can create a user with name, email, one permitted role, activation state, and an initial password; edit name, email, role, activation state; and set a new initial password.
- **FR-12 Administrator safeguards:** Duplicate email, invalid roles, self-deactivation, and deactivation of the last active Administrator are rejected. User deactivation is used instead of deletion.
- **FR-13 Validation and errors:** Input, conflict, not-found, forbidden, unauthenticated, and unexpected failures use the documented safe error envelope.
- **FR-14 Responsive/accessibility:** Required screens work at desktop, tablet, and mobile widths, are keyboard accessible, retain visible focus, and do not clip or overflow.

## 5. Business Rules

1. **BR-01** Only an active user with valid credentials may authenticate.
2. **BR-02** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
3. **BR-03** The authenticated user identity, not a requesterId supplied by the client, determines ownership of Requester operations.
4. **BR-04** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator.
5. **BR-05** A Requester may indicate that the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed.
6. **BR-06** Invalid credentials, inactive accounts, and missing sessions return safe messages that do not reveal whether an email is registered; passwords are never stored or returned in plaintext.
7. **BR-07** Logout invalidates the server-side session; expired or invalid sessions cannot access protected resources.
8. **BR-08** Passwords use a memory-hard/slow password hash, and valid new passwords are at least 8 characters with upper and lower case letters, a number, and a special character.
9. **BR-09** Requesters can access only their own permitted Tickets and Attachments; ownership violations return `404` without confirming another user's resource.
10. **BR-10** Requesters cannot read Internal Notes and can create Public Comments only on their own Tickets.
11. **BR-11** A Ticket may initially be unassigned; its owner, when present, must be an active IT Staff or Administrator user. Only IT Staff may invoke the claim/reassign operation in the approved matrix.
12. **BR-12** Requested Priority remains the Requester value. IT Priority initially copies Requested Priority and can later be changed only by IT Staff.
13. **BR-13** Ticket status values are `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, and `Cancelled`; only the transition matrix in `api-spec.md` is valid.
14. **BR-14** Public Comments and Internal Notes are append-only. The backend records author and creation time, rejects empty/whitespace content, and limits content to 2,000 characters.
15. **BR-15** Lab 3 has no Actions Taken rule; resolution blocking based on incomplete Actions Taken is deferred to Lab 4.
16. **BR-16** IT Staff can claim an unassigned ticket or assign/reassign it only to an active IT Staff user; reassignment is server-authorized.
17. **BR-17** One user has exactly one permitted role; role values outside the three-role enum are invalid.
18. **BR-18** Email addresses are normalized for comparison and must be unique case-insensitively.
19. **BR-19** New or reset initial passwords set `mustChangePassword = true`; the initial password is communicated only through approved local-lab handling, never email.
20. **BR-20** An Administrator cannot deactivate their own account.
21. **BR-21** The last active Administrator cannot be deactivated or changed to another role; at least one active Administrator must remain.
22. **BR-22** Users are deactivated rather than deleted; their existing authored records remain attributable.
23. **BR-23** All protected endpoints enforce authorization on the backend, regardless of hidden or disabled frontend controls.
24. **BR-24** Invalid input returns `400`, missing/hidden resources return `404`, forbidden authenticated actions return `403`, duplicate/state conflicts return `409`, and unexpected failures return `500` with no stack traces.
25. **BR-25** Existing Lab 2 records and Requester ownership are preserved during migration; the temporary selector and its client state are removed only after authenticated ownership tests pass.
26. **BR-26** Seeds are idempotent and contain at least 4 active and 1 inactive Requester, 3 active and 1 inactive IT Staff, 1 active Administrator, distributed realistic tickets, and safe example comments/notes.
27. **BR-27** Administrator scope excludes deletion, bulk operations, import/export, role history, email delivery, multi-role assignment, and advanced recovery.
28. **BR-28** Queue query parameters have documented searchable/filterable/sortable fields, valid page sizes, stable default ordering, and safe invalid-parameter behavior.

## 6. Authorization Matrix

`-` means denied. Every non-public operation is enforced server-side; frontend controls are not security controls.

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Login / Logout / Change own password | Yes | Yes | Yes |
| Create Ticket | Yes | No | No |
| View own Tickets and Attachments | Yes | No | No |
| View IT Staff Queue | No | Yes | No |
| Retrieve operational Ticket Detail | No | Yes | No |
| Claim / Reassign Ticket | No | Yes | No |
| Change IT Priority | No | Yes | No |
| Change Ticket Status | No | Yes | No |
| Public Comment | Own tickets | Yes | Yes |
| Internal Note | No | Yes | Yes |
| Problem Appears Resolved | Own tickets | No | No |
| Manage Users | No | No | Yes |

This decision keeps Administrator user-management responsibility conceptually separate from IT Staff ticket operations. Administrators may see comments and notes for administration/support context, but do not automatically inherit queue, assignment, priority, or status permissions.

## 7. UI Specification Summary

Use the existing Lab 2 Zen Green tokens, field conventions, cards, badges, buttons, validation placement, and responsive breakpoints. Required screens are Login, Mandatory Change Password, authenticated shell, Requester regression/My Tickets/Create Ticket/Ticket Detail, IT Staff Ticket Queue, IT Staff Ticket Detail, and minimalist Administrator User Management. Each screen defines role navigation, editable/read-only fields, loading, saving, success, validation, empty/no-results, forbidden, not-found, conflict, and safe API-failure states. Public Comments and Internal Notes use separate, unmistakable sections. Full layout, controls, mobile behavior, keyboard access, focus, and overflow rules are in `ui-spec.md`.

## 8. Data Changes

Replace the temporary `Requester` identity boundary with a `User` model containing `id`, `name`, normalized unique `email`, `passwordHash`, `role` (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`), `isActive`, `mustChangePassword`, `createdAt`, and `updatedAt`. A User has many submitted Tickets as Requester. Ticket ownership becomes an optional `ticketOwnerId` relation to User, restricted by service logic to active IT Staff or Administrator users; only IT Staff can change that relationship through the approved API. Add `PublicComment` and `InternalNote` models with `id`, `ticketId`, `authorId`, `content`, and `createdAt`; index ticket/author/time access paths.

Extend Ticket with `problemAppearsResolvedAt` and the complete status enum, preserve requested/IT priorities, timestamps, category, related system, requester, and attachments. Preserve existing Categories, Related Systems, Tickets, Attachments, ticket numbers, and Requester ownership. Add unique normalized email, role/status/password-state indexes, Ticket requester/status/owner indexes, comment/note ticket-time indexes, and foreign keys with restrictive or explicit nullable behavior. Use an append-only Prisma migration: create Users from existing Requesters with Requester role and temporary local initial credentials, copy requester foreign keys, then add comments/notes and new constraints. Verify counts and ownership before removing the old selector path. Never store plaintext passwords.

Seed behavior is idempotent by normalized email and stable identifiers. It includes at least 4 active Requesters and 1 inactive Requester, at least 3 active IT Staff and 1 inactive IT Staff, and at least 1 active Administrator. Tickets span Requesters, all required statuses where valid, priorities, assigned/unassigned ownership, and realistic categories/systems. Public Comments and Internal Notes contain non-sensitive examples. Seed credentials are local-development-only and documented without real secrets; initial passwords force change.

## 9. API Contract

The API remains under `/api` and retains Lab 2 `{ data }` success and `{ error: { code, message, fields? } }` error envelopes. Lab 3 authentication uses an opaque, server-side session cookie such as `toktickit_session`; credentials and hashes never reach client code. See `api-spec.md` for every endpoint, shape, status, authorization, queue query rule, transition matrix, and safe-error rule. Lab 2 Requester endpoints remain available behind the authenticated session, with ownership derived from the session rather than any client requester ID.

## 10. Acceptance Criteria

- **AC-01** Given an active user with valid credentials, when the user logs in, then the backend establishes authenticated access and returns the permitted user identity and role.
- **AC-02** Given a user who must change the initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved.
- **AC-03** Given an authenticated Requester, when the client supplies another `requesterId`, then the backend still applies the authenticated identity and does not return another Requester's data.
- **AC-04** Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected without exposing note content.
- **AC-05** Logout removes authenticated access.
- **AC-06** IT Staff can use the Ticket Queue with search, filters, sorting, pagination, and queue counts.
- **AC-07** IT Staff can claim, assign, and reassign Tickets only to permitted active owners.
- **AC-08** IT Staff can update IT Priority and permitted statuses, while invalid transitions are rejected.
- **AC-09** Public Comments and Internal Notes follow visibility and append-only rules.
- **AC-10** Administrator can list, search, filter, create, edit, activate, deactivate, and reset initial passwords for users within the minimalist scope.
- **AC-11** Duplicate email and invalid role values are rejected.
- **AC-12** Administrator cannot deactivate themselves.
- **AC-13** The last active Administrator cannot be deactivated or demoted.
- **AC-14** A new initial password requires password change at next login.
- **AC-15** Lab 2 Requester functionality continues to work using authenticated identity and preserves Ticket/Attachment ownership.
- **AC-16** Inactive accounts cannot log in or call protected endpoints.
- **AC-17** Password boundary validation enforces the documented rules and safe error responses.
- **AC-18** Requester Public Comments and Problem Appears Resolved work only on owned Tickets.
- **AC-19** IT Staff status transitions follow New/Open/In Progress/Waiting for Requester/Resolved/Closed/Reopened/Cancelled rules.
- **AC-20** Existing Lab 2 data survives migration with correct Requester ownership and no selector state.
- **AC-21** Required screens provide correct loading, empty/no-results, forbidden, not-found, conflict, and API-failure feedback.
- **AC-22** All required screens are responsive, keyboard accessible, visibly focused, and free of clipping/overflow.
- **AC-23** Safe errors distinguish unauthenticated, forbidden, invalid, missing, conflict, and unexpected failures without protected-resource disclosure.

## 11. Definition of Done

- [ ] FR-01–FR-14 and BR-01–BR-28 are implemented and server-enforced.
- [ ] All AC-01–AC-23 map to planned tests and have passing evidence before product completion.
- [ ] Authentication secrets and password hashes are absent from frontend responses and source control.
- [ ] Prisma migration preserves existing records and ownership; idempotent seed counts meet Section 8.
- [ ] API responses and safe errors match `api-spec.md`.
- [ ] All required screens match `ui-spec.md` at desktop, tablet, and mobile widths.
- [ ] No Development Requester selector or Change Requester action remains.
- [ ] Accessibility, authorization, migration/regression, and E2E tests are automated and passing.
- [ ] README/run instructions and visual evidence paths are updated by the later implementation branch.

## 12. Assumptions and Decisions

- Server-side opaque sessions in an HTTP-only, SameSite cookie are selected over browser-stored bearer tokens because this is a same-origin local web application. Production deployment hardening is out of scope.
- CSRF protection is required for cookie-authenticated state-changing routes through SameSite policy plus an origin/CSRF-token check; safe CORS remains configured explicitly.
- `403` means authenticated but forbidden; `404` hides another user's protected Ticket, Attachment, or Internal Note. `409` is used for duplicate email and administrator safety conflicts.
- Wire enum values are uppercase with underscores (`WAITING_FOR_REQUESTER`, etc.); UI labels use spaces and title case.
- Administrators can read/write Public Comments and Internal Notes but do not receive IT Staff queue permissions unless a future approved contract changes the matrix.
- Local seed initial passwords are printed/documented only for development and always require change. No email delivery is attempted.
