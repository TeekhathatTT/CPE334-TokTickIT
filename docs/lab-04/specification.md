# Lab 4 Specification

## 1. Sprint Goal

Deliver Lab 4 as the operational closure of the TokTickIT ticket lifecycle: IT Staff record structured **Actions Taken** on any ticket, a server-enforced **resolution gate** blocks premature `→ Resolved` transitions while follow-up work is still pending (completing the rule deferred by Lab 3 BR-15), and Requester and IT Staff **dashboards** give each role an at-a-glance, drill-down-backed view of their work — all without regressing Labs 1–3, and hardened for accessibility, failure safety, and concurrency correctness.

## 2. Stakeholder Request

Lab 3 deferred one load-bearing rule: *"Lab 3 has no Actions Taken rule; resolution blocking based on incomplete Actions Taken is deferred to Lab 4"* (Lab 3 specification, BR-15). Stakeholders now ask for that rule to become real and auditable: every significant thing IT does on a ticket must be recorded as a structured Actions Taken entry (what was done, what resulted, whether follow-up is still required); a ticket with unresolved follow-up **cannot** be marked Resolved no matter which button the UI shows; and both Requesters ("what needs me?") and IT Staff ("what needs us?") get simple dashboards that answer that question in one glance and link straight into the queues they already know. This specification is the engineering contract every other Lab 4 branch builds on — it resolves every judgment call (edit policy, gate shape, concurrency mechanism, metric definitions, timezone rule) so implementation branches never have to guess.

## 3. Scope

### 3.1 Included

- Actions Taken CRUD (create + controlled update) on staff tickets, with a documented shape, validation rules, authorship rule, and edit policy.
- The resolution gate: a server-side precondition on the `→ Resolved` edges of the Lab 3 transition matrix.
- The complete 8-state transition matrix with the gate applied (matrix shape unchanged from Lab 3).
- Requester dashboard (`GET /api/dashboard/requester`) and IT Staff dashboard (`GET /api/dashboard/staff`, reused by Administrator).
- Optimistic-concurrency (`expectedUpdatedAt` → `409`) on Ticket status/owner/priority writes and Actions Taken edits.
- Requester read-only visibility of Actions Taken on their own tickets.
- Full Labs 1–3 regression (auth, Requester ticket/attachment flows, staff queue/detail, comments, notes, admin user management) still green and unmodified.
- Final hardening: accessibility, zero console errors, no dead UI, duplicate-click/retry safety, data-preserving failure recovery.

### 3.2 Explicitly Excluded

Baseline is handout §4.2; Lab 4 adds no:

- SLA clocks, timers, escalation rules, or due-date computation.
- Notifications (email, in-app, or otherwise).
- Inventory, asset, or billing linkage.
- Multi-level approval workflows.
- BI tools, exports, or analytics beyond the dashboard cards defined in §5/BR-08.
- Multi-tenant organizations or departments.
- New file-upload mechanisms (Attachment Notes is a free-text pointer only, BR-05).
- User-management changes beyond Lab 3 (no new roles, no new admin screens).
- Deletion of Actions Taken (no DELETE endpoint exists; see BR-06).
- Changes to the 8-state enum itself or the matrix shape (only a precondition is added).

## 4. Functional Requirements

- **FR-01 Actions Taken create:** Authenticated active IT Staff and active Administrators can create an Actions Taken entry on any ticket (assigned or unassigned — ownership ≠ authorship, BR-06). Requesters cannot create.
- **FR-02 Actions Taken read:** IT Staff and Administrators can list a ticket's Actions Taken in chronological order. Requesters can list Actions Taken on their **own** tickets read-only (no create/edit controls rendered or honored).
- **FR-03 Actions Taken update:** The original author (while still active IT Staff) or any active Administrator can edit an entry's correctable fields (BR-06). Any active IT Staff or Administrator can explicitly resolve any entry's pending follow-up (BR-07). All edits carry an optimistic-concurrency check (BR-09).
- **FR-04 Resolution gate:** The server blocks `OPEN → RESOLVED`, `IN_PROGRESS → RESOLVED`, and `WAITING_FOR_REQUESTER → RESOLVED` while the ticket has at least one unresolved follow-up (BR-07). The block returns a distinct `409 RESOLUTION_BLOCKED` error, not the generic disallowed-transition error.
- **FR-05 Transition matrix with gate:** The Lab 3 8-state matrix is unchanged in shape; the gate is a precondition applied to exactly the three `→ Resolved` edges above. All other edges behave exactly as in Lab 3.
- **FR-06 Requester dashboard:** An authenticated Requester gets aggregate cards over their own tickets with exact queries (BR-08), empty states, and drill-down links into My Tickets.
- **FR-07 IT Staff dashboard:** Authenticated active IT Staff get aggregate cards over the shared queue with exact queries (BR-08), empty states, and drill-down links into the staff queue. Active Administrators reuse the same endpoint in read-only aggregate form (no queue/detail permission implied beyond Lab 3).
- **FR-08 Concurrency safety:** Ticket status/assignment/priority writes and Actions Taken edits accept an `expectedUpdatedAt` precondition and return `409 VERSION_CONFLICT` (with current `updatedAt`) on staleness (BR-09). The UI surfaces the conflict and preserves user input.
- **FR-09 Labs 1–3 regression:** Every Lab 1–3 flow (authentication incl. `mustChangePassword`, Requester ticket/attachment flows on session identity, staff queue/detail, Public Comments, Internal Notes, admin user management, `problemAppearsResolvedAt` signaling) continues to pass unmodified.
- **FR-10 Hardening:** All Lab 4 screens meet the accessibility rules (keyboard, labels, focus, `aria-describedby`, badge text), produce no console errors, contain no dead UI (every button/link resolves to a working action or a documented disabled state with reason), disable during in-flight requests with retry safety (no duplicate creates on double-click), and preserve entered data across network/server failures with an explicit Retry path.

### FR → BR index

| FR | Governing BRs |
|---|---|
| FR-01 | BR-01…BR-06, BR-10 |
| FR-02 | BR-04, BR-06, BR-10 |
| FR-03 | BR-06, BR-09, BR-10 |
| FR-04 | BR-07, BR-10 |
| FR-05 | BR-07, BR-11 |
| FR-06 | BR-08, BR-10 |
| FR-07 | BR-08, BR-10 |
| FR-08 | BR-09, BR-10 |
| FR-09 | BR-11, BR-12 |
| FR-10 | BR-10, BR-13 |

## 5. Business Rules

1. **BR-01 Action Date/Time is server-set.** `actionDate` is assigned by the server as `now()` at creation and is never accepted from the client (any client-supplied value is ignored or rejected with `400`). Rationale: matches the `createdAt` pattern of `PublicComment`/`InternalNote`, prevents backdating/forward-dating, and keeps dashboard "today/recent" queries on a single trustworthy clock. The immutable `actionDate` doubles as the display timestamp; `updatedAt` records later corrections (BR-06).
2. **BR-02 Action Description is required and bounded.** Required, trimmed, length 5–2,000 characters (after trim). Empty/whitespace-only or >2,000 chars → `400 VALIDATION_ERROR`. The 2,000-char ceiling matches comments/notes so the same UI counter conventions apply; the 5-char floor rejects junk single-character rows while staying testable.
3. **BR-03 Result is a required controlled vocabulary.** `result` is required and must be exactly one of `RESOLVED_STEP | WORKAROUND | INFO_REQUESTED | ESCALATED | NO_FURTHER_ACTION` (wire values uppercase with underscores; UI labels title-cased). Free-text narrative belongs in `description`. Rationale: a controlled vocabulary is queryable (dashboards and tests can count "how many escalations"), prevents vague prose from becoming the de-facto status, and keeps validation to a single enum check. Unknown values → `400`.
4. **BR-04 Performed-by is always the authenticated actor.** `performedById` is derived server-side from the session user and never accepted from the client (mirrors Lab 3 BR-03's identity rule). The response embeds a safe author shape `{ id, name, role }`; hashes are never exposed.
5. **BR-05 Follow-Up Required + Follow-up Note + Attachment Notes.**
   - `followUpRequired` is a required boolean, default `false` when omitted on create.
   - `followUpNote`: **required (trimmed, 5–1,000 chars) when `followUpRequired = true`; prohibited when `followUpRequired = false`.** If `followUpRequired = false` and a non-empty `followUpNote` is supplied, the server rejects with `400 VALIDATION_ERROR` (strict rejection, **not** silent ignore). Rationale: silent-ignore drops user intent without feedback and creates "I typed a note and it vanished" bugs; strict rejection forces the client to make the intent explicit and is trivially testable in both directions.
   - `attachmentNotes` is an **optional free-text pointer** (trimmed, max 500 chars) naming/describing a file already attached through the Lab 2 attachment flow (e.g. `"screenshot FW-log-2026-10-01.png"`). It creates no upload path, stores no bytes, and never references a path outside the ticket's existing attachments. Lab 4 adds no file-upload scope.
6. **BR-06 Authorship and edit policy (ownership ≠ authorship).**
   - **Create:** any **active** IT Staff member or any active Administrator may create an Actions Taken entry on **any** ticket, whether assigned, unassigned, or owned by someone else. The handout states an Action Taken *"may be by a different IT Staff member"* — this rule adopts that sentence literally. Ticket ownership is never a precondition for authoring. Requesters cannot create (server `403`; the Requester UI renders no create/edit controls).
   - **Edit (correctable fields):** an entry, once created, **can** be edited — Lab 4 is **not** strictly append-only (the handout says "create and update", and operational records legitimately need correction, unlike the conversational record of comments/notes). Editable: `description`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes`. Immutable: `id`, `ticketId`, `performedById`, `actionDate`. Every edit bumps `updatedAt` and requires the concurrency precondition (BR-09).
   - **Who may edit correctable fields:** only the **original author while still active IT Staff**, or **any active Administrator**. Other IT Staff (including the Ticket Owner) must add a **new** entry rather than rewriting a colleague's record. Rationale: preserves accountability in a shared queue without freezing legitimate corrections; administrators retain a correction path for deactivated-author rows.
   - **Follow-up resolution is the exception:** **any** active IT Staff or active Administrator may resolve **any** entry's pending follow-up via the explicit resolve operation (BR-07), because follow-up work is routinely completed by a different staffer than the one who flagged it.
   - **No delete:** no DELETE endpoint exists. Deactivation of the author never removes or reattributes rows (mirrors Lab 3 BR-22).
7. **BR-07 Resolution gate (the single most important rule in Lab 4).**
   - **Precondition (normative, testable with one query):** a ticket in `OPEN`, `IN_PROGRESS`, or `WAITING_FOR_REQUESTER` **cannot** transition to `RESOLVED` while the following query returns any row:

     ```sql
     SELECT 1 FROM "ActionTaken"
     WHERE "ticketId" = :ticketId
       AND "followUpRequired" = TRUE
       AND "followUpResolvedAt" IS NULL
     LIMIT 1;
     ```

     If the query returns a row, `PATCH /api/staff/tickets/:id/status` with `{ "status": "RESOLVED" }` is rejected with **`409` + `code: "RESOLUTION_BLOCKED"`** (distinct body from the plain disallowed-transition error; see `api-spec.md`). If it returns no rows — including the case of **zero Actions Taken entries at all** — the transition proceeds subject only to the Lab 3 matrix.
   - **What "resolves" a pending follow-up:** exactly one mechanism — an explicit resolve operation (`PATCH …/actions-taken/:actionId` with `{ "markFollowUpResolved": true, "expectedUpdatedAt": … }`) on the **pending row itself**, which sets `followUpResolvedAt = now()` (server clock) and `followUpResolvedById = <authenticated actor>`. Creating a **new** Actions Taken row with `followUpRequired = false` does **not** auto-resolve older pendings. Rationale: auto-resolution ("any new row clears all flags") is ambiguous about *which* pending item was actually completed and lets a trivial new row silently unlock resolution; explicit per-row resolution is unambiguous, auditable (who/when per item), and enforceable with the single query above.
   - **Double-resolve** of an already-resolved row → `409` (`FOLLOW_UP_ALREADY_RESOLVED`). **Resolving a row whose `followUpRequired = false`** → `400` (nothing to resolve).
   - **Scope:** the gate applies to exactly the three `→ Resolved` edges (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`). No other edge gains a precondition. `RESOLVED → CLOSED`, reopens, cancellations, and all other transitions behave exactly as in Lab 3.
   - **Atomicity:** the gate check and the status write execute in a single transaction; the `expectedUpdatedAt` precondition (BR-09) is evaluated in the same transaction so a concurrent follow-up flag cannot slip between check and write.
   - **Lab 3 compatibility note:** this rule **changes** Lab 3 behavior by adding a precondition to an existing transition (Lab 3 BR-15 explicitly deferred it). The matrix shape does not change.
8. **BR-08 Dashboard metric definitions (normative; each is one query).** All counts are exact; `session.user.id` is the authenticated actor. "Active ticket" (staff open-set) means `status NOT IN ('RESOLVED','CLOSED','CANCELLED')`. "Mine" (requester) means `requesterUserId = session.user.id`. Times use the server clock; "today" means the UTC calendar day (BR-14). Every card defines its empty state and drill-down target (a queue/list filter the card links to).

   **Requester dashboard** (`GET /api/dashboard/requester`, role Requester only):
   - `openTickets` = `COUNT Ticket WHERE requesterUserId = me AND status NOT IN (RESOLVED, CLOSED, CANCELLED)`. Empty: `"You have no open tickets."` Drill-down: My Tickets, no filter.
   - `awaitingMyResponse` = `COUNT Ticket WHERE requesterUserId = me AND status = WAITING_FOR_REQUESTER`. Empty: `"Nothing is waiting on you."` Drill-down: My Tickets `?status=WAITING_FOR_REQUESTER`.
   - `recentlyResolved` = `COUNT Ticket WHERE requesterUserId = me AND status IN (RESOLVED, CLOSED) AND updatedAt >= now() - INTERVAL '30 days'`. Empty: `"No tickets resolved in the last 30 days."` Drill-down: My Tickets `?status=RESOLVED&status=CLOSED`.
   - `totalSubmitted` = `COUNT Ticket WHERE requesterUserId = me`. Empty: `"You have not submitted any tickets yet."` (new-user state; card links to Create Ticket). Drill-down: My Tickets, no filter.

   **IT Staff dashboard** (`GET /api/dashboard/staff`, roles IT Staff and Administrator; Administrator use is aggregate read-only and implies no queue/detail/status permission beyond Lab 3):
   - `unassignedActive` = `COUNT Ticket WHERE ticketOwnerId IS NULL AND status NOT IN (RESOLVED, CLOSED, CANCELLED)`. Empty: `"Queue is fully assigned."` Drill-down: staff queue `?ownerId=unassigned`.
   - `assignedToMe` = `COUNT Ticket WHERE ticketOwnerId = session.user.id AND status NOT IN (CLOSED, CANCELLED)` (includes RESOLVED so staff see what they still need to close). Empty: `"Nothing is assigned to you."` Drill-down: staff queue `?ownerId=<me>`. For Administrator callers this counts tickets owned by the calling admin (normally zero, since admins cannot be owners per Lab 3 BR-11) — the card still renders with the same empty state rather than erroring.
   - `waitingForRequester` = `COUNT Ticket WHERE status = WAITING_FOR_REQUESTER`. Empty: `"No tickets are waiting on requesters."` Drill-down: staff queue `?status=WAITING_FOR_REQUESTER`.
   - `pendingFollowUp` = `COUNT DISTINCT Ticket WHERE EXISTS (pending-follow-up row per BR-07 for that ticket)`. Empty: `"No pending follow-ups."` Drill-down: staff queue filtered to the returned `pendingFollowUpTicketIds` list (response includes up to 200 ids for link construction; see `api-spec.md`).
   - `resolvedPendingClose` = `COUNT Ticket WHERE status = RESOLVED`. Empty: `"Nothing is waiting to be closed."` Drill-down: staff queue `?status=RESOLVED`.
   - `newToday` = `COUNT Ticket WHERE status = NEW AND createdAt >= <start of current UTC day>`. Empty: `"No new tickets today."` Drill-down: staff queue `?status=NEW`.
9. **BR-09 Concurrency / stale-update handling.** Optimistic locking on `Ticket.updatedAt` and `ActionTaken.updatedAt`:
   - Mutating endpoints (`PATCH /api/staff/tickets/:id/status`, `…/assignment`, `…/priority`, `PATCH …/actions-taken/:actionId`, including the resolve operation) accept an optional `expectedUpdatedAt` (ISO-8601 string of the `updatedAt` the client last saw).
   - If supplied and `expectedUpdatedAt !== current updatedAt` (millisecond-exact string comparison on the canonical ISO form), the server rejects with **`409` + `code: "VERSION_CONFLICT"`** and includes `data: { currentUpdatedAt }` so the client can re-fetch without losing user input.
   - If omitted, the write proceeds (backward-compatible with Lab 3 clients). The UI always sends it (it always has a last-seen `updatedAt`).
   - Rationale: `updatedAt` already exists on `Ticket` (Prisma `@updatedAt`) and is added to `ActionTaken`; no ETag/version-column infrastructure is needed, and string comparison on the canonical ISO form is deterministic across the JS/Postgres boundary. Applies to Ticket status/owner/priority writes **and** Actions Taken edits/resolves alike.
10. **BR-10 Authorization, validation, and safe-error baseline (Lab 3 carried forward).**
    - Requester: read own tickets + own Actions Taken; create/read Public Comments on own tickets; Problem Appears Resolved on own tickets. **No** Actions Taken write, **no** Internal Notes, **no** dashboard-staff access, **no** status/assignment/priority writes.
    - IT Staff (active): full Actions Taken create/list/resolve + author-scoped edit; dashboards-staff; queue/detail/assignment/priority/status (gated by BR-07/BR-09); comments + notes. Inactive IT Staff: no authenticated access at all.
    - Administrator (active): Actions Taken create/list/**any-row edit**/resolve; **staff-dashboard aggregates read-only**; comments + notes; user management per Lab 3. Administrators do **not** gain queue/detail/assignment-target/status/priority powers and remain invalid as `ticketOwnerId` (Lab 3 BR-11/BR-16 unchanged; assignment of an Administrator or inactive user → `400`).
    - Status codes follow Lab 3 BR-24: `400` invalid input, `401` no/invalid session, `403` authenticated-but-forbidden, `404` missing-or-hidden (ownership violations stay `404`), `409` state conflicts (`RESOLUTION_BLOCKED`, `VERSION_CONFLICT`, disallowed transitions), `500` unexpected with `INTERNAL_ERROR` only.
11. **BR-11 Status enum and matrix continuity.** Ticket status remains exactly the Lab 3 8-value enum; legacy `PENDING` remains rejected with `400` everywhere. The allowed-transition matrix is byte-identical to Lab 3 `api-spec.md` §3; Lab 4 adds only the BR-07 precondition on the three `→ Resolved` edges. The Requester Problem Appears Resolved signal (`Ticket.problemAppearsResolvedAt`) still never performs a status transition; dashboards **read** that field where relevant and never reimplement it.
12. **BR-12 Migration and regression safety.** The Lab 4 migration is strictly additive (new `ActionTaken` table + indexes only). It alters, backfills, renames, or drops no Lab 1–3 table, column, index, or enum value. Seed data is idempotent (stable identifiers) and includes Actions Taken rows exercising: zero-action tickets, all-clear tickets, and pending-follow-up tickets. All Lab 1–3 tests must pass unmodified after the migration.
13. **BR-13 Hardening rules.** Every Lab 4 screen: full keyboard reachability with visible focus; associated labels and `aria-describedby` errors; badge/icon meaning never carried by color alone; zero console errors or warnings in the happy path; no dead UI (disabled controls explain why); in-flight buttons disable to prevent duplicate POSTs; failed creates never clear the user's draft; every failure panel offers Retry; responsive at the three breakpoints in `ui-spec.md`.
14. **BR-14 Timezone/date-boundary rule.** The server is the sole clock. "Today" (`newToday`) and "recent" (`recentlyResolved`) boundaries are computed in **UTC** (`00:00–23:59 UTC` day slices; `now() - INTERVAL '30 days'` on the server clock). The API returns UTC ISO-8601 timestamps; the client formats them in the viewer's locale but never computes day boundaries itself and never supplies a timezone offset. Rationale: UTC boundaries are deterministic across developer machines and CI, need no per-request offset plumbing, and match the existing UTC-ISO convention.

## 6. UI Specification Summary

Screens (full layout, states, and responsive/accessibility rules in `ui-spec.md`):

1. **Requester Dashboard** — four metric cards (`openTickets`, `awaitingMyResponse`, `recentlyResolved`, `totalSubmitted`) + recent-tickets strip; each card links to its drill-down.
2. **IT Staff Dashboard** (Administrator sees the same aggregates) — six metric cards (`unassignedActive`, `assignedToMe`, `waitingForRequester`, `pendingFollowUp`, `resolvedPendingClose`, `newToday`); each card links to its drill-down queue filter.
3. **Actions Taken area of Staff Ticket Detail** — third thread below Public Comments / Internal Notes with its own card/tab convention: chronological list, create form, inline edit mode (author/admin only), per-row Resolve control for pending follow-ups, and a visible resolution-gate banner when `→ Resolved` is currently blocked.
4. **Requester Ticket Detail (read-only Actions Taken)** — same thread rendered without any write controls.

All Lab 4 UI reuses existing Zen Green tokens, badges, cards, tabs, and the `PublicComments`/`InternalNotes` component conventions; no new palette is introduced.

## 7. Data Changes

New Prisma model `ActionTaken` (singular model name follows the `PublicComment`/`InternalNote` convention; prose and REST refer to it as "Actions Taken" / `actions-taken`):

```prisma
model ActionTaken {
  id                   Int       @id @default(autoincrement())
  ticketId             Int
  performedById        Int
  actionDate           DateTime  @default(now())   // server-set, immutable (BR-01)
  description          String    @db.Text          // required, 5–2000 chars (BR-02)
  result               String                      // controlled vocabulary (BR-03); CHECK constraint in migration
  followUpRequired     Boolean   @default(false)   // (BR-05)
  followUpNote         String?   @db.Text          // required iff followUpRequired (BR-05)
  followUpResolvedAt   DateTime?                   // NULL = still pending (BR-07)
  followUpResolvedById Int?                        // actor that resolved (BR-07)
  attachmentNotes      String?                     // free-text pointer ≤500 chars (BR-05)
  updatedAt            DateTime  @updatedAt        // edit audit + optimistic lock (BR-06/BR-09)

  ticket       Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  performedBy  User   @relation(fields: [performedById], references: [id], onDelete: Restrict, onUpdate: Cascade)
  resolvedBy   User?  @relation("ActionTakenResolver", fields: [followUpResolvedById], references: [id], onDelete: SetNull, onUpdate: Cascade)

  @@index([ticketId])
  @@index([ticketId, actionDate])
  @@index([performedById])
}
```

- `User` gains back-relations `actionsTaken ActionTaken[]` and `resolvedFollowUps ActionTaken[] @relation("ActionTakenResolver")`; `Ticket` gains `actionsTaken ActionTaken[]`. No other Lab 1–3 model is touched.
- `result` values are enforced by a migration-level `CHECK (result IN (...))` plus service-layer validation (defense in depth; Prisma-native enum avoided so a future vocabulary addition stays a data migration, not an enum rewrite).
- `followUpResolvedAt`/`followUpResolvedById` are the **only** resolution-gate bookkeeping fields, and they live on `ActionTaken` — **no new column is added to `Ticket`** for the gate (the gate is a derived `EXISTS` query, BR-07). Dashboards read the existing `Ticket.problemAppearsResolvedAt` field; they do not reinvent it.
- Optimistic concurrency reuses `Ticket.updatedAt` (already present) and the new `ActionTaken.updatedAt` — no separate version column.
- Indexes mirror the `PublicComment`/`InternalNote` pattern (`[ticketId]`, `[ticketId, createdAt-equivalent]`) plus `[performedById]` for author audit queries.
- **The migration must not alter or drop any Lab 1–3 table, column, index, or enum value.** Verification: Labs 1–3 suites pass unmodified post-migration (tests.md REG rows).

## 8. API Contract (summary)

Base `/api`; `{ data }` / `{ error: { code, message, fields? } }` envelopes and session-cookie auth per Lab 3. Full shapes in `api-spec.md`:

| Method + path | Auth | Purpose |
|---|---|---|
| `POST /api/staff/tickets/:id/actions-taken` | IT Staff, Administrator | Create an Actions Taken entry (BR-01…BR-06) |
| `GET /api/staff/tickets/:id/actions-taken` | IT Staff, Administrator | List a ticket's entries, chronological (FR-02) |
| `GET /api/tickets/:id/actions-taken` | Requester (own tickets only) | Read-only list of own ticket's entries (FR-02) |
| `PATCH /api/staff/tickets/:id/actions-taken/:actionId` | IT Staff (author-or-resolve), Administrator | Edit correctable fields and/or explicitly resolve follow-up (BR-06/BR-07/BR-09) |
| `PATCH /api/staff/tickets/:id/status` | IT Staff | Same endpoint as Lab 3 **plus** BR-07 gate (`409 RESOLUTION_BLOCKED`) and BR-09 `expectedUpdatedAt` (`409 VERSION_CONFLICT`) |
| `PATCH /api/staff/tickets/:id/assignment` | IT Staff | Lab 3 behavior **plus** BR-09 `expectedUpdatedAt` |
| `PATCH /api/staff/tickets/:id/priority` | IT Staff | Lab 3 behavior **plus** BR-09 `expectedUpdatedAt` |
| `GET /api/dashboard/requester` | Requester | Four requester cards with exact queries (BR-08) |
| `GET /api/dashboard/staff` | IT Staff, Administrator | Six staff cards with exact queries (BR-08); admin use is aggregate read-only |

Changed Lab 3 behavior is stated explicitly wherever it occurs (the status precondition, the optional `expectedUpdatedAt` field). Nothing else in the Lab 3 contract changes.

## 9. Acceptance Criteria

- **AC-01** Given an active IT Staff member (owner or not) or Administrator, when they POST a valid Actions Taken entry, then the server records it with server-set `actionDate`, session-derived `performedBy`, and returns `201` with the entry shape.
- **AC-02** Given invalid Actions Taken input (blank/short/long description, unknown `result`, missing `followUpNote` when required, supplied `followUpNote` when not required, oversized `attachmentNotes`), when posted, then the server rejects with `400 VALIDATION_ERROR` and field errors, and no row is created.
- **AC-03** Given a Requester, when they attempt to create or edit Actions Taken (any ticket), then the server rejects with `403` and no row changes; their own ticket's list endpoint remains readable.
- **AC-04** Given a ticket in `OPEN`/`IN_PROGRESS`/`WAITING_FOR_REQUESTER` with ≥1 pending follow-up (`followUpRequired = true AND followUpResolvedAt IS NULL`), when IT Staff requests `→ Resolved`, then the server rejects with `409 RESOLUTION_BLOCKED` and the ticket status is unchanged.
- **AC-05** Given the ticket in AC-04 after every pending follow-up has been explicitly resolved per BR-07, when IT Staff requests `→ Resolved`, then the transition succeeds (`200`); and given a ticket with zero Actions Taken at all, `→ Resolved` is **not** blocked by the gate (matrix rules alone apply).
- **AC-06** Given a non-author IT Staff member (not an Administrator), when they attempt to edit another author's correctable fields, then the server rejects with `403`; the same actor **may** resolve that row's pending follow-up (`200` with `followUpResolvedAt`/`resolvedBy` set).
- **AC-07** Given a stale `expectedUpdatedAt` on a Ticket status/assignment/priority write or an Actions Taken edit/resolve, when submitted, then the server rejects with `409 VERSION_CONFLICT` including `currentUpdatedAt`, and no write occurs; retry after re-fetch succeeds.
- **AC-08** Given an assignment target that is inactive or an Administrator, when submitted, then the server rejects with `400` and ownership is unchanged (Lab 3 BR-11/BR-16 preserved).
- **AC-09** Given an authenticated Requester viewing their own ticket, when the Actions Taken area renders, then entries are visible but no create/edit/resolve controls exist or function (server `403` if forced).
- **AC-10** Given seeded data with known tickets/follow-ups, when each dashboard endpoint is called, then every card value equals its BR-08 query result, empty states render for zero counts, and each card links to its documented drill-down.
- **AC-11** Given any other (non-`→ Resolved`) transition, when requested, then Lab 3 matrix behavior is unchanged (gate never fires off its three edges).
- **AC-12** Given the full Labs 1–3 suite run after the Lab 4 migration, when executed, then all prior tests pass unmodified and no Lab 1–3 row was altered or lost.
- **AC-13** Given each Lab 4 screen at desktop/tablet/mobile widths with keyboard only, when exercised, then content is reachable with visible focus, labeled controls, no clipping/overflow, no console errors, no dead UI, duplicate clicks create exactly one row, and failures preserve input with a Retry path.

### 9.1 FR → AC traceability (every FR maps to ≥1 AC; every AC traces to ≥1 FR)

| FR | Covering AC(s) | Note |
|---|---|---|
| FR-01 Actions Taken create | AC-01, AC-02, AC-03 | Happy path + validation + requester forbidden |
| FR-02 Actions Taken read | AC-03, AC-09, AC-10 | Staff/admin list, requester read-only |
| FR-03 Actions Taken update | AC-06, AC-07 | Author/admin edit, anyone-staff resolve, 409 on stale |
| FR-04 Resolution gate | AC-04, AC-05 | Blocked premature resolve; allowed once resolved |
| FR-05 Matrix with gate | AC-05, AC-11 | Zero-action not blocked; other edges unchanged |
| FR-06 Requester dashboard | AC-10 | Four cards vs seeded data + drill-downs |
| FR-07 IT Staff dashboard | AC-10 | Six cards vs seeded data + drill-downs; admin reuse |
| FR-08 Concurrency | AC-07 | 409 on stale ticket + action writes |
| FR-09 Regression | AC-08, AC-12 | Inactive-assignee rejection; full prior suites green |
| FR-10 Hardening | AC-13 | A11y/responsive/console/dead-UI/duplicate/retry |

## 10. Definition of Done

- [ ] FR-01–FR-10 and BR-01–BR-14 are implemented and **server-enforced** (UI hiding alone is never sufficient).
- [ ] All AC-01–AC-13 trace to passing tests in `tests.md` (unit / API-integration / UI component / UI style / responsive / authorization / workflow / migration-regression / performance-smoke / E2E), including: gate rejection (AC-04), gate release + zero-action pass-through (AC-05), stale-update `409` on both Ticket and Actions Taken writes (AC-07), inactive-assignee rejection (AC-08), and Requester read-only Actions Taken (AC-09).
- [ ] Full Labs 1–3 suites (server + client + E2E) still pass **unmodified** after the Lab 4 migration; seed remains idempotent.
- [ ] Dashboards return exactly the BR-08 queries against seeded data, with empty states and working drill-downs at all three breakpoints.
- [ ] No console errors or warnings in happy paths; no dead UI; duplicate-click safe; failures preserve input with Retry.
- [ ] API responses and safe errors match `api-spec.md` (`RESOLUTION_BLOCKED` vs disallowed-transition vs `VERSION_CONFLICT` distinguishable by `code`).
- [ ] Screens match `ui-spec.md` at desktop/tablet/mobile; accessibility checks pass.
- [ ] README/run instructions, seed docs, and visual-evidence paths are current.

## 11. Assumptions and Decisions

1. **Action Date/Time is server-set, never client-supplied** (BR-01) — prevents backdating; matches comment/note `createdAt` conventions.
2. **Description required, 5–2,000 chars** (BR-02) — floor rejects junk, ceiling reuses the comment/note counter UI.
3. **Result is a controlled 5-value vocabulary, not free text** (BR-03) — queryable, validatable, keeps narrative in `description`.
4. **Performed-by is always the session actor** (BR-04) — mirrors Lab 3 BR-03; no client identity input.
5. **Follow-up Note required-when-true and rejected-when-false** (BR-05) — strict rejection over silent ignore so no typed intent silently vanishes.
6. **Attachment Notes is a ≤500-char free-text pointer, not an upload** (BR-05) — Lab 4 adds no file-upload scope.
7. **Any active IT Staff (or Administrator) may author on any ticket; ownership ≠ authorship** (BR-06) — adopts the handout's "different IT Staff member" sentence literally.
8. **Actions Taken are editable (not append-only), author-or-Administrator for correctable fields, any-staff for follow-up resolution, no delete** (BR-06) — operational records need correction; accountability preserved by restricting rewrites while letting any staffer complete follow-up work.
9. **Resolution gate = single `EXISTS (followUpRequired AND followUpResolvedAt IS NULL)` query; only explicit per-row resolve clears it; new rows never auto-clear; zero rows never block; `409 RESOLUTION_BLOCKED`** (BR-07) — unambiguous, auditable, one-query enforceable, transactionally atomic with the status write.
10. **Concurrency = optional `expectedUpdatedAt` → `409 VERSION_CONFLICT` with `currentUpdatedAt`, on Ticket and Actions Taken writes alike** (BR-09) — reuses existing `updatedAt`, no new version infrastructure, backward-compatible when omitted.
11. **Dashboard metrics are exact COUNT queries with UTC day boundaries, defined empty states, and drill-down targets** (BR-08, BR-14) — no vague "open" or "recent"; UTC keeps server and CI deterministic.
12. **No new `Ticket` column for the gate; `problemAppearsResolvedAt` is read, not reinvented; migration is strictly additive** (Data Changes, BR-11/BR-12) — zero-touch on Labs 1–3 tables.
13. **Administrator reuses the staff dashboard endpoint as aggregate read-only; gains no queue/detail/status powers and stays an invalid owner** (BR-08/BR-10) — per handout §4.6 and Lab 3 BR-11/BR-16.
