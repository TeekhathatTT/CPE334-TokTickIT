# Lab 4 API Contract

## 0. Conventions

- Base path: `/api`; timestamps are ISO-8601 UTC strings.
- Success uses `{ "data": ... }`; errors use `{ "error": { "code": "...", "message": "...", "fields": { ... } } }` — identical to Lab 3.
- Authentication is the Lab 3 opaque server-side session in the HTTP-only, SameSite cookie `toktickit_session`. State-changing requests require the configured Origin/CSRF protection. Nothing in Lab 4 changes the auth mechanism.
- Common codes: `400 VALIDATION_ERROR` (bad input, incl. legacy `PENDING`, malformed `expectedUpdatedAt`, and any client-supplied `actionDate`/`performedById`/`followUpResolvedAt`/`followUpResolvedById`), `401 UNAUTHENTICATED`, `403 FORBIDDEN` (authenticated but not permitted, incl. Requester writes to Actions Taken and non-author edits including mixed bodies), `404 NOT_FOUND` (missing **or** intentionally hidden — Requester access to another user's ticket/Actions Taken returns `404`, never `403`; entry not belonging to the ticket returns `404`), `409` conflicts below, `500 INTERNAL_ERROR` (never a stack trace).
- Lab 4 conflict codes (all `409`, distinguished by `code`):
  - `RESOLUTION_BLOCKED` — the BR-07 gate stopped a `→ Resolved` transition (evaluated only after the matrix passes).
  - `INVALID_STATUS_TRANSITION` — the Lab 3 matrix disallows the edge (gate not evaluated). This code is **unchanged from Lab 3** (Lab 3 `staff.controller.ts` already returns it); Lab 4 does **not** rename it, so Lab 1–3 suites pass unmodified.
  - `VERSION_CONFLICT` — `expectedUpdatedAt` did not match current `updatedAt`; response includes `data: { currentUpdatedAt }`.
  - `FOLLOW_UP_ALREADY_RESOLVED` — resolve requested on an already-resolved row (`S.followUpResolvedAt IS NOT NULL`).
- `409` (not `400`) is used for the resolution gate because the request is well-formed and the edge is matrix-legal — it is the ticket's *current state* (pending follow-up) that forbids it, exactly the Lab 3 BR-24 meaning of "duplicate/state conflicts". `400` stays reserved for malformed input (including malformed `expectedUpdatedAt`, which is always `400`, never silently ignored).
- Changed Lab 3 behavior is called out explicitly under each affected endpoint and is limited to: gate precondition, optional `expectedUpdatedAt`, additive `pendingFollowUpCount` on detail/status responses, and additive list filters. The matrix-illegal `409` code is unchanged.

## 1. Actions Taken

Shared entry shape (all responses):

```json
{ "data": {
  "id": 12,
  "ticketId": 34,
  "actionDate": "2026-10-09T08:15:00.000Z",
  "description": "Restarted the print spooler and re-ran the queued job.",
  "result": "RESOLVED_STEP",
  "followUpRequired": true,
  "followUpNote": "Confirm with requester tomorrow that paper jam is cleared.",
  "followUpResolvedAt": null,
  "resolvedBy": null,
  "attachmentNotes": "spooler-log-2026-10-09.png",
  "performedBy": { "id": 7, "name": "Sam Staff", "role": "IT_STAFF" },
  "createdAt": "2026-10-09T08:15:00.000Z",
  "updatedAt": "2026-10-09T08:15:00.000Z"
} }
```

`result` is one of `RESOLVED_STEP | WORKAROUND | INFO_REQUESTED | ESCALATED | NO_FURTHER_ACTION` (spec BR-03). `createdAt` is a **response-only alias equal to `actionDate`** (there is no `createdAt` column; implementations serialize `createdAt: actionDate.toISOString()`); it equals `actionDate` on create and never changes. `updatedAt` bumps on every edit/resolve. `resolvedBy` is `{ id, name, role }` or `null`. No password hash ever appears.

Validation summary (spec BR-02/BR-03/BR-05/BR-01): `description` required, trimmed 5–2,000 chars; `result` required enum; `followUpRequired` boolean (default `false`); `followUpNote` required trimmed 5–1,000 chars iff merged `followUpRequired = true`, and any non-empty client-supplied value with merged `followUpRequired = false` → `400` (with the resolved-history exemption: stored note retained, client must omit/empty); `attachmentNotes` optional, trimmed, max 500 chars; client-supplied `actionDate`/`performedById`/`followUpResolvedAt`/`followUpResolvedById` (any value including `null`, on POST or PATCH) → `400 VALIDATION_ERROR` (strict rejection, never silent ignore and never honored).

### `POST /api/staff/tickets/:id/actions-taken`

Create one entry on ticket `:id`.

- Related: FR-01; BR-01…BR-06, BR-09, BR-10.
- Auth: valid session, role IT Staff (active) or Administrator (active). Any ticket (assigned/unassigned/other-owned) is acceptable — ownership ≠ authorship. Requester → `403`. Missing ticket → `404`.
- Body: `{ "description": string, "result": enum, "followUpRequired"?: boolean, "followUpNote"?: string|null, "attachmentNotes"?: string|null }`. No `expectedUpdatedAt` on create. Supplying `actionDate`/`performedById`/`followUpResolvedAt`/`followUpResolvedById` → `400`. The insert runs in a transaction that first locks the parent ticket (`SELECT 1 FROM "Ticket" WHERE id = $1 FOR UPDATE`) per BR-07, so a concurrent `→ Resolved` cannot slip between insert and gate check.
- Success: `201` with the entry shape above (`actionDate` = `getNow()` passed explicitly by app code — never the DB default — and `createdAt` = same value, `performedBy` = session user).
- Errors: `400` validation failure (`VALIDATION_ERROR` + `fields`, incl. unknown `result`, short/long `description`, missing `followUpNote` when required, supplied `followUpNote` when not required, oversized `attachmentNotes`, any server-owned field supplied); `401` no/invalid session; `403` Requester or inactive role; `404` ticket missing; `500` unexpected.

### `GET /api/staff/tickets/:id/actions-taken`

List a ticket's entries, chronological (`actionDate asc, id asc`).

- Related: FR-02; BR-06, BR-10.
- Auth: valid session, role IT Staff or Administrator. Missing ticket → `404`.
- Success: `200` `{ data: [entry, …] }` (empty array when none — never `404` for "no entries").
- Errors: `401`; `403` non-staff/admin role; `404` ticket missing; `500` unexpected.

### `GET /api/tickets/:id/actions-taken`

Requester read-only list of their **own** ticket's entries (same shape/order as above — deliberate full shape including `followUpNote` and `attachmentNotes` per spec BR-10; staff MUST write requester-safe wording, internal deliberation belongs in Internal Notes).

- Related: FR-02; BR-06, BR-10.
- Auth: valid session, role Requester; ownership from session. Another user's ticket → `404` (not `403`, per safe-failure rules).
- Success: `200` `{ data: […] }`.
- Errors: `401`; `403` non-Requester role calling this route; `404` missing/not-owned; `500` unexpected.

### `PATCH /api/staff/tickets/:id/actions-taken/:actionId`

Edit correctable fields and/or explicitly resolve the row's pending follow-up (spec BR-06/BR-07/BR-09). No DELETE exists.

- Related: FR-03; BR-06, BR-07, BR-09, BR-10.
- Auth: valid session, role IT Staff (active) or Administrator (active). Ticket must exist (`404`); entry must belong to the ticket (`404` otherwise, to avoid cross-ticket id oracle).
- Body (all optional, at least one of the field keys or `markFollowUpResolved` required, else `400` empty-body):
  - `{ "description"?: string, "result"?: enum, "followUpRequired"?: boolean, "followUpNote"?: string|null, "attachmentNotes"?: string|null }` — correctable-field edit. Allowed only for the **original author (still active IT Staff)** or **any active Administrator**; anyone else → `403 FORBIDDEN` as a whole with no partial application (use POST for a new entry instead). Field presence is decided by **key presence** (`"key" in body` on the parsed JSON body), **including `null` values** — e.g. `{ attachmentNotes: null }` counts as a field edit (a clear to NULL), not as resolve-only; keys dropped by JSON parsing (e.g. `undefined`) count as absent. Merging applies each present key (null writes NULL for `followUpNote`/`attachmentNotes`, then validated; null/wrong-type for `description`/`result` or non-boolean for `followUpRequired` → `400`, never silently ignored). Supplying any server-owned field (`actionDate`/`performedById`/`followUpResolvedAt`/`followUpResolvedById`) → `400`.
  - `{ "markFollowUpResolved"?: true }` — explicit resolution. Allowed for **any** active IT Staff or Administrator **only when the body contains no correctable key at all** (fields-free resolve-only body: no own-property `description`/`result`/`followUpRequired`/`followUpNote`/`attachmentNotes`, even with `null` values); a mixed body (any correctable key present, even `null`, + `markFollowUpResolved`) requires author/admin and a non-author mixed body → `403` as a whole (BR-06 key-presence rule). Only `markFollowUpResolved: true` is accepted (`false`/other → `400`). Requires merged `followUpRequired = true AND` stored `followUpResolvedAt IS NULL` (evaluated per BR-06 order §(5)); sets both server-side. Already-resolved (`S.followUpResolvedAt IS NOT NULL`) → `409 FOLLOW_UP_ALREADY_RESOLVED` regardless of merged flag; merged `followUpRequired = false` with stored `NULL` → `400` (nothing to resolve; see T1 — resolve first with flag still `true`, then flip in a second call).
  - `{ "expectedUpdatedAt"?: string }` — optimistic precondition (BR-09, checked after the row locks). Malformed (non-string/unparseable/empty) → `400`; mismatch → `409 VERSION_CONFLICT` + `data: { currentUpdatedAt }`; no write occurs.
  - **Stored-vs-merged (normative):** validation in step (4) runs on the **merged** row M; the resolve test in step (5) requires `M.followUpRequired = true` and `S.followUpResolvedAt IS NULL`. Hence `followUpRequired: false + markFollowUpResolved: true` in one call always → `400` (it cannot both flip and resolve). Flip transitions T1–T4 per spec BR-06 apply **only on an explicit boolean `followUpRequired` flip** (key present with a boolean value differing from S; non-boolean including `null` → `400`, never a flip): T1 (explicit pending `true→false`) → `400`; T2 (explicit resolved `true→false`) allowed with history preserved (client omits/empty note); T3 (explicit all-clear `false→true`) requires fresh supplied note (new pending); T4 (explicit resolved `false→true`) clears `followUpResolvedAt/By → NULL` with fresh supplied note (re-arms). Field-only edits (flag key absent, e.g. `{ description: "fix typo" }`) and redundant same-value sends never touch resolution state — `{ description: "fix typo" }` on a resolved `true` row → `200` with resolution preserved. A `followUpNote`-only correction on a resolved row (no flag flip) is author/admin-only, preserves resolution, and validates the merged note (explicit `null`/empty or invalid replacement when `M.followUpRequired = true` → `400`; non-empty supplied note when `M.followUpRequired = false` → `400`); a field-only edit on a pending row without a flip preserves the pending state (`followUpResolvedAt` stays `NULL`) with the replacement note validated. Resolve sets `followUpResolvedAt = getNow()` explicitly (injectable clock, never DB clock). The transaction first locks the parent ticket (`SELECT … FOR UPDATE`) and the action row (`SELECT … FOR UPDATE`) per BR-07, then re-reads before the version/validation/resolve checks.
- Success: `200` with the updated entry shape (new `updatedAt`; `followUpResolvedAt`/`resolvedBy` populated when resolved).
- Errors: `400` validation (`VALIDATION_ERROR` + `fields`, incl. empty body, bad shapes, server-owned fields supplied, `followUpNote` required/prohibited rule re-evaluated on the merged row with history exemption, `false+resolve` in one call, `markFollowUpResolved: false`); `401`; `403` non-author field edit (incl. mixed body) or Requester; `404` ticket/entry missing or mismatched; `409` `VERSION_CONFLICT` / `FOLLOW_UP_ALREADY_RESOLVED`; `500` unexpected.

## 2. Ticket writes with gate + concurrency (Lab 3 changed behavior)

### `PATCH /api/staff/tickets/:id/status` — **CHANGED from Lab 3**

Same path, roles, and matrix as Lab 3 `api-spec.md` §3, **plus**:

1. **Resolution gate (spec BR-07):** when the requested `status` is `RESOLVED` and current status is `OPEN`, `IN_PROGRESS`, or `WAITING_FOR_REQUESTER`, the server runs the pending-follow-up `EXISTS` query in the same transaction as the write, **after first locking the parent ticket row** (`BEGIN; SELECT 1 FROM "Ticket" WHERE id = $1 FOR UPDATE;` … `COMMIT` per BR-07, with the row re-read after the lock). A bare `EXISTS`-then-`UPDATE` under `READ COMMITTED` is insufficient — the `FOR UPDATE` lock (held in both this transaction and all Actions Taken create/edit transactions) is the normative anti-race mechanism; `expectedUpdatedAt` alone does not stop a concurrent insert. If any pending row exists → `409`:

   ```json
   { "error": { "code": "RESOLUTION_BLOCKED",
     "message": "Ticket has unresolved follow-up actions and cannot be marked Resolved.",
     "fields": { "pendingFollowUpCount": 2 } } }
   ```

   (`pendingFollowUpCount` is advisory; the normative condition is existence ≥ 1.) Matrix-illegal edges still return Lab 3's `409 INVALID_STATUS_TRANSITION` (code **unchanged**, not renamed) and never reach the gate check — order is, after auth and after acquiring the `FOR UPDATE` lock and re-reading: `400` enum check → `404` ticket check → matrix check (`INVALID_STATUS_TRANSITION`) → gate check (`RESOLUTION_BLOCKED`) → concurrency check (`VERSION_CONFLICT`, malformed `expectedUpdatedAt` → `400`) → write.
2. **`expectedUpdatedAt` (spec BR-09):** optional body field. `PATCH …/status` body becomes `{ "status": enum, "expectedUpdatedAt"?: string }`. Malformed → `400 VALIDATION_ERROR`; mismatch against the post-lock re-read (or equivalently 0 rows from an atomic `UPDATE … WHERE id = $1 AND "updatedAt" = $expected`) → `409 { code: "VERSION_CONFLICT", data: { currentUpdatedAt } }`; no write occurs in either case. Every `PATCH …/status` runs in the `FOR UPDATE` transaction above — including non-gate edges — so the version check is a real lost-update guard, not a lock-free read-compare-write (Lab 3 handlers gain a transaction in Lab 4).

- Related: FR-04, FR-05, FR-08; BR-07, BR-09, BR-10, BR-11.
- Auth: unchanged (active IT Staff only; Administrators do not gain status power).
- Success: `200` updated ticket (same Lab 3 shape, now also embedding additive `pendingFollowUpCount` and the ticket `updatedAt` the client must echo back next time).
- Full matrix (shape identical to Lab 3, code `INVALID_STATUS_TRANSITION` unchanged; ★ = gate applies):

  | Current | Allowed next statuses |
  |---|---|
  | New | Open, Cancelled |
  | Open | In Progress, Waiting for Requester, Resolved ★, Cancelled |
  | In Progress | Waiting for Requester, Resolved ★, Cancelled |
  | Waiting for Requester | In Progress, Resolved ★, Cancelled |
  | Resolved | Closed, Reopened |
  | Closed | Reopened |
  | Reopened | Open, In Progress, Cancelled |
  | Cancelled | Reopened |

### `PATCH /api/staff/tickets/:id/assignment` — **CHANGED (concurrency only)**

Lab 3 behavior unchanged (owner must be an active IT Staff id or `null`; Administrator/inactive targets → `400`; only IT Staff may invoke), **plus** optional `expectedUpdatedAt` with identical `409 VERSION_CONFLICT` semantics (malformed → `400`). Concurrency is a real guard: the handler MUST run `BEGIN; SELECT 1 FROM "Ticket" WHERE id = $1 FOR UPDATE;` first, re-read, then run target validation and the version compare against the post-lock row (compliant alternative: atomic `UPDATE … WHERE id = $1 AND "updatedAt" = $expected`, 0 rows → `409`); lock-free read-compare-write is forbidden.

- Related: FR-08; BR-09, BR-10 (Lab 3 BR-11/BR-16 preserved).
- Body: `{ "ownerId": number | null, "expectedUpdatedAt"?: string }`.

### `PATCH /api/staff/tickets/:id/priority` — **CHANGED (concurrency only)**

Lab 3 behavior unchanged (`itPriority` enum; IT Staff only), **plus** optional `expectedUpdatedAt` with identical `409 VERSION_CONFLICT` semantics (malformed → `400`). Same locking rule as assignment: `BEGIN; SELECT … FOR UPDATE;` re-read → validate → version-compare (or atomic conditional `UPDATE`), never lock-free read-compare-write.

- Related: FR-08; BR-09, BR-10.
- Body: `{ "itPriority": "LOW" | "MEDIUM" | "HIGH", "expectedUpdatedAt"?: string }`.

### `GET /api/staff/tickets/:id` — **CHANGED (additive `pendingFollowUpCount` only)**

Lab 3 shape unchanged, **plus** an additive top-level `pendingFollowUpCount: number` (count of pending follow-up rows per BR-07 for this ticket, `0` when none). This is the gate banner's page-load source — the client MUST NOT derive the banner by counting the Actions Taken list client-side (the list may be paginated/partial in future; the count is authoritative). Omitting clients are unaffected (additive field). Auth/roles unchanged (active IT Staff only; Administrators gain no detail access).

- Related: FR-04; BR-07, BR-10.
- Success: `200` Lab 3 detail shape + `pendingFollowUpCount`.

### `GET /api/tickets` and `GET /api/staff/tickets` — **CHANGED (additive drill-down filters only)**

Lab 3 defaults, ordering, pagination, and `meta` semantics unchanged, **plus** the additive optional filters from spec BR-08 (all optional; invalid ISO → `400 VALIDATION_ERROR`; omitting them yields exactly Lab 3 behavior):
- `GET /api/tickets` (Requester): repeated `?status=` (`IN` semantics) and `?updatedSince=` (ISO-8601).
- `GET /api/staff/tickets` (IT Staff): `?hasPendingFollowUp=true|false`, `?createdSince=` (ISO-8601), `?updatedSince=` (ISO-8601) — repeated `?status=` and `?ownerId=unassigned` support confirmed unchanged from Lab 3.

- Related: FR-06, FR-07; BR-08, BR-10.

## 3. Dashboards

Both endpoints return UTC ISO-8601 timestamps and the server-computed counts defined normatively in spec BR-08/BR-14. Time bounds are computed in app code from the injectable clock (`getNow()`) and passed as bound query parameters — dashboard SQL MUST NOT contain `now()`, `CURRENT_TIMESTAMP`, `CURRENT_DATE`, or `INTERVAL`. Query definitions are not repeated here — this section binds each response field to its BR-08 query and defines exact drill-down parameters. **Guarantee: each card's count equals its drill-down list's `meta.totalItems`** when fetched with the documented filters (asserted with a frozen JS clock in tests — sufficient precisely because no SQL clock is consulted).

Common: `401` no/invalid session; wrong role → `403`; `500` unexpected. Counts are exact (no sampling/caching headers in Lab 4).

### `GET /api/dashboard/requester`

- Related: FR-06; BR-08, BR-10, BR-14.
- Auth: valid session, role Requester.
- Success `200`:

  ```json
  { "data": {
    "openTickets": 5,
    "awaitingMyResponse": 2,
    "recentlyResolved": 1,
    "recentlyResolvedSince": "2026-09-09T12:00:00.000Z",
    "totalSubmitted": 9,
    "recentTickets": [ { "id": 34, "ticketNumber": "TT-0034", "summary": "…", "status": "OPEN", "updatedAt": "…" } ]
  } }
  ```

  - `openTickets` := BR-08 requester `openTickets` query. Drill-down (exact): `GET /api/tickets?status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED`.
  - `awaitingMyResponse` := BR-08 `awaitingMyResponse`. Drill-down (exact): `GET /api/tickets?status=WAITING_FOR_REQUESTER`.
  - `recentlyResolved` := BR-08 `recentlyResolved` (`WHERE "updatedAt" >= $recentlyResolvedSince`, app-computed `getNow() − 30 days`, UTC; never SQL `now() - INTERVAL`). `recentlyResolvedSince` is the exact bound used. Drill-down (exact): `GET /api/tickets?status=RESOLVED&status=CLOSED&updatedSince=<recentlyResolvedSince>`.
  - `totalSubmitted` := BR-08 `totalSubmitted`. Drill-down (exact): `GET /api/tickets` (no filter) or Create Ticket when zero.
  - `recentTickets`: up to 5 own tickets ordered `updatedAt desc, id desc` (display convenience only; not a metric).

### `GET /api/dashboard/staff`

- Related: FR-07; BR-08, BR-10, BR-14.
- Auth: valid session, role IT Staff **or** Administrator. Administrator use is aggregate read-only and confers no queue/detail/status/assignment power (Lab 3 matrix unchanged).
- Success `200`:

  ```json
  { "data": {
    "unassignedActive": 4,
    "assignedToMe": 3,
    "waitingForRequester": 6,
    "pendingFollowUp": 2,
    "pendingFollowUpTicketIds": [11, 27],
    "resolvedPendingClose": 5,
    "newToday": 1,
    "newTodaySince": "2026-10-09T00:00:00.000Z"
  } }
  ```

  - `unassignedActive` := BR-08 `unassignedActive`. Drill-down (exact): `GET /api/staff/tickets?ownerId=unassigned&status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED`.
  - `assignedToMe` := BR-08 `assignedToMe` (session user). Drill-down (exact): `GET /api/staff/tickets?ownerId=<session.user.id>&status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=RESOLVED&status=REOPENED`.
  - `waitingForRequester` := BR-08 `waitingForRequester`. Drill-down (exact): `GET /api/staff/tickets?status=WAITING_FOR_REQUESTER`.
  - `pendingFollowUp` := BR-08 `pendingFollowUp` (distinct tickets with ≥1 pending row). `pendingFollowUpTicketIds`: up to 200 such ticket ids (`updatedAt desc`) for client link-construction convenience only — the 200-cap never truncates the count. Drill-down (exact, normative): `GET /api/staff/tickets?hasPendingFollowUp=true` (its `meta.totalItems` equals `pendingFollowUp`).
  - `resolvedPendingClose` := BR-08 `resolvedPendingClose`. Drill-down (exact): `GET /api/staff/tickets?status=RESOLVED`.
  - `newToday` := BR-08 `newToday` (`WHERE "createdAt" >= $newTodaySince`, app-computed `startOfUtcDay(getNow())` per BR-14; never SQL `now()`/`CURRENT_DATE`). `newTodaySince` is the exact start-of-UTC-day bound used. Drill-down (exact): `GET /api/staff/tickets?status=NEW&createdSince=<newTodaySince>`.

## 4. Safe failure rules (unchanged + Lab 4 codes)

Lab 3 §6 rules carry forward. Lab 4 codes fit the same envelope: `RESOLUTION_BLOCKED` (new; gate stopped a matrix-legal `→ Resolved`), `VERSION_CONFLICT` (with `data.currentUpdatedAt`), `FOLLOW_UP_ALREADY_RESOLVED`, and the unchanged Lab 3 `INVALID_STATUS_TRANSITION` (matrix-illegal; **not** renamed, so clients branch gate vs matrix vs staleness and Lab 1–3 suites pass unmodified). Requester-forced Actions Taken writes return `403` (the route exists but the role is forbidden); Requester access to another user's tickets or their Actions Taken returns `404` (hidden, never confirmed).

## 5. Endpoint to requirement map

| Endpoint | FR | BR |
|---|---|---|
| `POST /api/staff/tickets/:id/actions-taken` | FR-01 | BR-01…BR-06, BR-07 (locking), BR-10 |
| `GET /api/staff/tickets/:id/actions-taken` | FR-02 | BR-06, BR-10 |
| `GET /api/tickets/:id/actions-taken` | FR-02 | BR-06, BR-10 (full shape, requester-safe wording) |
| `PATCH /api/staff/tickets/:id/actions-taken/:actionId` | FR-03 | BR-06, BR-07, BR-09, BR-10 |
| `PATCH /api/staff/tickets/:id/status` (+ gate + concurrency) | FR-04, FR-05, FR-08 | BR-07, BR-09, BR-10, BR-11 |
| `PATCH /api/staff/tickets/:id/assignment` (+ concurrency) | FR-08 | BR-09, BR-10 |
| `PATCH /api/staff/tickets/:id/priority` (+ concurrency) | FR-08 | BR-09, BR-10 |
| `GET /api/staff/tickets/:id` (+ additive `pendingFollowUpCount`) | FR-04 | BR-07, BR-10 |
| `GET /api/tickets` / `GET /api/staff/tickets` (+ additive drill-down filters) | FR-06, FR-07 | BR-08, BR-10 |
| `GET /api/dashboard/requester` | FR-06 | BR-08, BR-10, BR-14 |
| `GET /api/dashboard/staff` | FR-07 | BR-08, BR-10, BR-14 |

All other Lab 3 endpoints are unchanged and keep their Lab 3 contract.
