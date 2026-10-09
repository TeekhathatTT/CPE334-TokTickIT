# Lab 4 API Contract

## 0. Conventions

- Base path: `/api`; timestamps are ISO-8601 UTC strings.
- Success uses `{ "data": ... }`; errors use `{ "error": { "code": "...", "message": "...", "fields": { ... } } }` — identical to Lab 3.
- Authentication is the Lab 3 opaque server-side session in the HTTP-only, SameSite cookie `toktickit_session`. State-changing requests require the configured Origin/CSRF protection. Nothing in Lab 4 changes the auth mechanism.
- Common codes: `400 VALIDATION_ERROR` (bad input, incl. legacy `PENDING` and bad `expectedUpdatedAt` shape), `401 UNAUTHENTICATED`, `403 FORBIDDEN` (authenticated but not permitted, incl. Requester writes to Actions Taken and non-author edits), `404 NOT_FOUND` (missing **or** intentionally hidden — Requester access to another user's ticket/Actions Taken returns `404`, never `403`), `409` conflicts below, `500 INTERNAL_ERROR` (never a stack trace).
- Lab 4 conflict codes (all `409`, distinguished by `code`):
  - `RESOLUTION_BLOCKED` — the BR-07 gate stopped a `→ Resolved` transition.
  - `INVALID_TRANSITION` — the Lab 3 matrix disallows the edge (gate not evaluated).
  - `VERSION_CONFLICT` — `expectedUpdatedAt` did not match current `updatedAt`; response includes `data: { currentUpdatedAt }`.
  - `FOLLOW_UP_ALREADY_RESOLVED` — resolve requested on an already-resolved row.
- `409` (not `400`) is used for the resolution gate because the request is well-formed and the edge is matrix-legal — it is the ticket's *current state* (pending follow-up) that forbids it, exactly the Lab 3 BR-24 meaning of "duplicate/state conflicts". `400` stays reserved for malformed input.
- Changed Lab 3 behavior is called out explicitly under each affected endpoint.

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

`result` is one of `RESOLVED_STEP | WORKAROUND | INFO_REQUESTED | ESCALATED | NO_FURTHER_ACTION` (spec BR-03). `createdAt` equals `actionDate` on create and never changes; `updatedAt` bumps on every edit/resolve. `resolvedBy` is `{ id, name, role }` or `null`. No password hash ever appears.

Validation summary (spec BR-02/BR-03/BR-05): `description` required, trimmed 5–2,000 chars; `result` required enum; `followUpRequired` boolean (default `false`); `followUpNote` required trimmed 5–1,000 chars iff `followUpRequired = true`, and any non-empty value with `followUpRequired = false` → `400`; `attachmentNotes` optional, trimmed, max 500 chars; client-supplied `actionDate`/`performedById`/`followUpResolvedAt` are ignored or rejected with `400` (never honored).

### `POST /api/staff/tickets/:id/actions-taken`

Create one entry on ticket `:id`.

- Related: FR-01; BR-01…BR-06, BR-09, BR-10.
- Auth: valid session, role IT Staff (active) or Administrator (active). Any ticket (assigned/unassigned/other-owned) is acceptable — ownership ≠ authorship. Requester → `403`. Missing ticket → `404`.
- Body: `{ "description": string, "result": enum, "followUpRequired"?: boolean, "followUpNote"?: string|null, "attachmentNotes"?: string|null }`. No `expectedUpdatedAt` on create.
- Success: `201` with the entry shape above (`actionDate` = server `now()`, `performedBy` = session user).
- Errors: `400` validation failure (`VALIDATION_ERROR` + `fields`, incl. unknown `result`, short/long `description`, missing `followUpNote` when required, supplied `followUpNote` when not required, oversized `attachmentNotes`); `401` no/invalid session; `403` Requester or inactive role; `404` ticket missing; `500` unexpected.

### `GET /api/staff/tickets/:id/actions-taken`

List a ticket's entries, chronological (`actionDate asc, id asc`).

- Related: FR-02; BR-06, BR-10.
- Auth: valid session, role IT Staff or Administrator. Missing ticket → `404`.
- Success: `200` `{ data: [entry, …] }` (empty array when none — never `404` for "no entries").
- Errors: `401`; `403` non-staff/admin role; `404` ticket missing; `500` unexpected.

### `GET /api/tickets/:id/actions-taken`

Requester read-only list of their **own** ticket's entries (same shape/order as above).

- Related: FR-02; BR-06, BR-10.
- Auth: valid session, role Requester; ownership from session. Another user's ticket → `404` (not `403`, per safe-failure rules).
- Success: `200` `{ data: […] }`.
- Errors: `401`; `403` non-Requester role calling this route; `404` missing/not-owned; `500` unexpected.

### `PATCH /api/staff/tickets/:id/actions-taken/:actionId`

Edit correctable fields and/or explicitly resolve the row's pending follow-up (spec BR-06/BR-07/BR-09). No DELETE exists.

- Related: FR-03; BR-06, BR-07, BR-09, BR-10.
- Auth: valid session, role IT Staff (active) or Administrator (active). Ticket must exist (`404`); entry must belong to the ticket (`404` otherwise, to avoid cross-ticket id oracle).
- Body (all optional, at least one required):
  - `{ "description"?: string, "result"?: enum, "followUpRequired"?: boolean, "followUpNote"?: string|null, "attachmentNotes"?: string|null }` — correctable-field edit. Allowed only for the **original author (still active IT Staff)** or **any active Administrator**; anyone else → `403 FORBIDDEN` (use POST for a new entry instead). Changing `followUpRequired true → false` does **not** resolve the row: if `followUpResolvedAt` is already non-null it stays (history preserved); if it is null and the row was pending, flipping the flag to `false` without `markFollowUpResolved` → `400` (the pending item must be explicitly resolved, preserving the audit trail — set the flag and resolve in one call by also sending `markFollowUpResolved: true`).
  - `{ "markFollowUpResolved"?: true }` — explicit resolution. Allowed for **any** active IT Staff or Administrator (BR-06 exception). Requires the row to have `followUpRequired = true AND followUpResolvedAt IS NULL`; sets both server-side. Already-resolved → `409 FOLLOW_UP_ALREADY_RESOLVED`; `followUpRequired = false` → `400` (nothing to resolve).
  - `{ "expectedUpdatedAt"?: string }` — optimistic precondition (BR-09). Mismatch → `409 VERSION_CONFLICT` + `data: { currentUpdatedAt }`; no write occurs.
- Success: `200` with the updated entry shape (new `updatedAt`; `followUpResolvedAt`/`resolvedBy` populated when resolved).
- Errors: `400` validation (`VALIDATION_ERROR` + `fields`, incl. empty body, bad shapes, `followUpNote` required/prohibited rule re-evaluated on the merged row); `401`; `403` non-author field edit or Requester; `404` ticket/entry missing or mismatched; `409` `VERSION_CONFLICT` / `FOLLOW_UP_ALREADY_RESOLVED`; `500` unexpected.

## 2. Ticket writes with gate + concurrency (Lab 3 changed behavior)

### `PATCH /api/staff/tickets/:id/status` — **CHANGED from Lab 3**

Same path, roles, and matrix as Lab 3 `api-spec.md` §3, **plus**:

1. **Resolution gate (spec BR-07):** when the requested `status` is `RESOLVED` and current status is `OPEN`, `IN_PROGRESS`, or `WAITING_FOR_REQUESTER`, the server runs the pending-follow-up `EXISTS` query in the same transaction as the write. If any pending row exists → `409`:

   ```json
   { "error": { "code": "RESOLUTION_BLOCKED",
     "message": "Ticket has unresolved follow-up actions and cannot be marked Resolved.",
     "fields": { "pendingFollowUpCount": 2 } } }
   ```

   (`pendingFollowUpCount` is advisory; the normative condition is existence ≥ 1.) Matrix-illegal edges still return `409 INVALID_TRANSITION` and never reach the gate check — order is: `400` enum check → `404` ticket check → matrix check (`INVALID_TRANSITION`) → gate check (`RESOLUTION_BLOCKED`) → concurrency check (`VERSION_CONFLICT`) → write, all after auth.
2. **`expectedUpdatedAt` (spec BR-09):** optional body field. `PATCH …/status` body becomes `{ "status": enum, "expectedUpdatedAt"?: string }`. Mismatch → `409 { code: "VERSION_CONFLICT", data: { currentUpdatedAt } }`; no write occurs.

- Related: FR-04, FR-05, FR-08; BR-07, BR-09, BR-10, BR-11.
- Auth: unchanged (active IT Staff only; Administrators do not gain status power).
- Success: `200` updated ticket (same Lab 3 shape, now also embedding `pendingFollowUpCount` and the ticket `updatedAt` the client must echo back next time).
- Full matrix (shape identical to Lab 3; ★ = gate applies):

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

Lab 3 behavior unchanged (owner must be an active IT Staff id or `null`; Administrator/inactive targets → `400`; only IT Staff may invoke), **plus** optional `expectedUpdatedAt` with identical `409 VERSION_CONFLICT` semantics.

- Related: FR-08; BR-09, BR-10 (Lab 3 BR-11/BR-16 preserved).
- Body: `{ "ownerId": number | null, "expectedUpdatedAt"?: string }`.

### `PATCH /api/staff/tickets/:id/priority` — **CHANGED (concurrency only)**

Lab 3 behavior unchanged (`itPriority` enum; IT Staff only), **plus** optional `expectedUpdatedAt` with identical `409 VERSION_CONFLICT` semantics.

- Related: FR-08; BR-09, BR-10.
- Body: `{ "itPriority": "LOW" | "MEDIUM" | "HIGH", "expectedUpdatedAt"?: string }`.

## 3. Dashboards

Both endpoints return UTC ISO-8601 timestamps and the server-computed counts defined normatively in spec BR-08. Query definitions are not repeated here — this section binds each response field to its BR-08 query and defines drill-down parameters.

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
    "totalSubmitted": 9,
    "recentTickets": [ { "id": 34, "ticketNumber": "TT-0034", "summary": "…", "status": "OPEN", "updatedAt": "…" } ]
  } }
  ```

  - `openTickets` := BR-08 requester `openTickets` query. Drill-down: `GET /api/tickets` (no filter).
  - `awaitingMyResponse` := BR-08 `awaitingMyResponse`. Drill-down: `GET /api/tickets?status=WAITING_FOR_REQUESTER`.
  - `recentlyResolved` := BR-08 `recentlyResolved` (server `now() - 30 days`, UTC). Drill-down: `GET /api/tickets?status=RESOLVED&status=CLOSED`.
  - `totalSubmitted` := BR-08 `totalSubmitted`. Drill-down: `GET /api/tickets` (no filter) or Create Ticket when zero.
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
    "newToday": 1
  } }
  ```

  - `unassignedActive` := BR-08 `unassignedActive`. Drill-down: `GET /api/staff/tickets?ownerId=unassigned`.
  - `assignedToMe` := BR-08 `assignedToMe` (session user). Drill-down: `GET /api/staff/tickets?ownerId=<session.user.id>`.
  - `waitingForRequester` := BR-08 `waitingForRequester`. Drill-down: `GET /api/staff/tickets?status=WAITING_FOR_REQUESTER`.
  - `pendingFollowUp` := BR-08 `pendingFollowUp` (distinct tickets with ≥1 pending row). `pendingFollowUpTicketIds`: up to 200 such ticket ids (`updatedAt desc`) for client link construction. Drill-down: staff queue filtered to those ids.
  - `resolvedPendingClose` := BR-08 `resolvedPendingClose`. Drill-down: `GET /api/staff/tickets?status=RESOLVED`.
  - `newToday` := BR-08 `newToday` (server UTC day boundary per BR-14). Drill-down: `GET /api/staff/tickets?status=NEW`.

## 4. Safe failure rules (unchanged + Lab 4 codes)

Lab 3 §6 rules carry forward. New codes fit the same envelope: `RESOLUTION_BLOCKED`, `VERSION_CONFLICT` (with `data.currentUpdatedAt`), `FOLLOW_UP_ALREADY_RESOLVED`, `INVALID_TRANSITION` (replaces the previously undifferentiated transition `409` so clients can branch gate vs matrix vs staleness). Requester-forced Actions Taken writes return `403` (the route exists but the role is forbidden); Requester access to another user's tickets or their Actions Taken returns `404` (hidden, never confirmed).

## 5. Endpoint to requirement map

| Endpoint | FR | BR |
|---|---|---|
| `POST /api/staff/tickets/:id/actions-taken` | FR-01 | BR-01…BR-06, BR-10 |
| `GET /api/staff/tickets/:id/actions-taken` | FR-02 | BR-06, BR-10 |
| `GET /api/tickets/:id/actions-taken` | FR-02 | BR-06, BR-10 |
| `PATCH /api/staff/tickets/:id/actions-taken/:actionId` | FR-03 | BR-06, BR-07, BR-09, BR-10 |
| `PATCH /api/staff/tickets/:id/status` (+ gate + concurrency) | FR-04, FR-05, FR-08 | BR-07, BR-09, BR-10, BR-11 |
| `PATCH /api/staff/tickets/:id/assignment` (+ concurrency) | FR-08 | BR-09, BR-10 |
| `PATCH /api/staff/tickets/:id/priority` (+ concurrency) | FR-08 | BR-09, BR-10 |
| `GET /api/dashboard/requester` | FR-06 | BR-08, BR-10, BR-14 |
| `GET /api/dashboard/staff` | FR-07 | BR-08, BR-10, BR-14 |

All other Lab 3 endpoints are unchanged and keep their Lab 3 contract.
