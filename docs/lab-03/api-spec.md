# Lab 3 API Contract

## 0. Conventions

- Base path: `/api`; timestamps are ISO-8601 UTC strings.
- Success uses `{ "data": ... }`; errors use `{ "error": { "code": "...", "message": "...", "fields": { ... } } }`.
- Authentication is an opaque server-side session in an HTTP-only, SameSite cookie `toktickit_session`. The browser never receives a password hash or secret. State-changing requests require the configured Origin and CSRF protection.
- `401` means no valid session, `403` means an authenticated role is forbidden, `404` means missing or intentionally hidden protected data, `409` means a state/uniqueness conflict, and `500` never exposes stack traces.
- For protected Requester resources, the session user determines ownership. Client `requesterId` values are ignored/rejected.

## 1. Authentication

### `POST /api/auth/login`

Authentication: none. Body: `{ "email": string, "password": string }`. On success, `200` returns `{ data: { user: { id, name, email, role, isActive, mustChangePassword } } }` and sets the session cookie. Invalid credentials and inactive accounts both return `401` with `AUTHENTICATION_FAILED` and a generic message. Invalid body returns `400` with field errors. Rate limiting is a later deployment concern, not a Lab 3 feature.

- Related: FR-01; BR-01, BR-06, BR-08.
- Errors: `400` invalid body (`VALIDATION_ERROR` + `fields`); `401` invalid credentials or inactive account (`AUTHENTICATION_FAILED`, generic non-enumerating message); `500` unexpected (`INTERNAL_ERROR`).

### `POST /api/auth/logout`

Authentication: valid session. Body: none. `204` clears the cookie and invalidates the server-side session. Missing/expired session returns `401`.

- Related: FR-01; BR-07.
- Errors: `401` missing/expired/invalid session (`UNAUTHENTICATED`); `500` unexpected (`INTERNAL_ERROR`).

### `GET /api/auth/me`

Authentication: valid session. `200` returns the same safe user shape as login. `401` for absent/expired session. It never returns `passwordHash`.

- Related: FR-01; BR-06.
- Errors: `401` absent/expired session (`UNAUTHENTICATED`); `500` unexpected (`INTERNAL_ERROR`).

### `POST /api/auth/change-password`

Authentication: valid session, including a `mustChangePassword` session. Body: `{ "currentPassword": string, "newPassword": string, "confirmPassword": string }`. `200` returns the safe user shape, clears `mustChangePassword`, and rotates the session. `400` covers mismatch/password rules; `401` covers an invalid current password/session. A user with `mustChangePassword` can call only this route, `me`, and logout until success.

- Related: FR-01, FR-02; BR-02, BR-08.
- Errors: `400` mismatch/confirmation or password-policy failure (`VALIDATION_ERROR` + `fields`); `401` invalid current password or invalid session (`AUTHENTICATION_FAILED` / `UNAUTHENTICATED`); `403` `mustChangePassword` gate violation when calling other routes (documented here for completeness); `500` unexpected (`INTERNAL_ERROR`).

## 2. Authenticated Lab 2 continuation (per-endpoint)

Lab 2 request/response shapes and validation are retained (see Lab 2 `api-spec.md` for field-level detail). The only Lab 3 change is authentication/ownership: every endpoint below requires a valid session with role Requester and derives ownership from the session user (Lab 2 `x-requester-id` is removed; any client-supplied `requesterId` is ignored or rejected with `400`). Ownership mismatch returns `404` without disclosing another user's data.

### `GET /api/categories`

Retrieve active Categories for ticket classification.

- Related: FR-05; BR-25 (reference-data preservation).
- Auth: valid session, role Requester.
- Success: `200` `{ data: [{ id, name }] }`.
- Errors: `401` no/invalid session; `403` non-Requester role; `500` DB failure (`INTERNAL_ERROR`).

### `GET /api/related-systems`

Retrieve active Related Systems.

- Related: FR-05; BR-25.
- Auth: valid session, role Requester.
- Success: `200` `{ data: [{ id, name }] }`.
- Errors: `401` no/invalid session; `403` non-Requester role; `500` unexpected.

### `GET /api/requesters`

Retained (authenticated) for active-requester reference data only; the Development Requester Selection UI and Change Requester action are removed.

- Related: FR-05; BR-25, BR-26.
- Auth: valid session, role Requester. Inactive requesters excluded server-side.
- Success: `200` `{ data: [{ id, name, email }] }`.
- Errors: `401` no/invalid session; `403` non-Requester role; `500` unexpected.

### `POST /api/tickets`

Create one Ticket for the session Requester (`multipart/form-data`, fields `categoryId`, `relatedSystemId`, `summary`, `description`, `requestedPriority`, files `attachments[]` 0–5, JPG/JPEG/PNG/WEBP/PDF ≤5MB each).

- Related: FR-05; BR-03, BR-09, BR-24.
- Auth: valid session, role Requester.
- Success: `201` ticket + per-file `uploadFailed/reason` flags for partial attachment failure (Lab 2 BR-16 behavior preserved).
- Errors: `400` validation failure (`VALIDATION_ERROR` + `fields`); `401` no/invalid session; `403` non-Requester role; `404` `categoryId`/`relatedSystemId` not active; `413` file exceeds 5MB; `500` unexpected with no partial Ticket committed.

### `GET /api/tickets`

Search/filter/sort/paginate the session Requester's own tickets. Query, defaults, and `isEmpty` vs `isNoResults` semantics match Lab 2.

- Related: FR-05; BR-09, BR-28.
- Auth: valid session, role Requester.
- Success: `200` `{ data: [...], meta: { page, pageSize, totalItems, totalPages, isEmpty, isNoResults } }`.
- Errors: `400` invalid query value; `401` no/invalid session; `403` non-Requester role; `500` unexpected.

### `GET /api/tickets/:id`

Retrieve one owned Ticket with active + removed attachment metadata.

- Related: FR-05; BR-09.
- Auth: valid session, role Requester; ownership from session.
- Success: `200` full ticket detail (Internal Notes never included).
- Errors: `401` no/invalid session; `403` non-Requester role; `404` missing or not owned; `500` unexpected.

### `POST /api/tickets/:id/attachments`

Add one attachment to an owned Ticket (`multipart/form-data`, field `file`).

- Related: FR-05; BR-09.
- Auth: valid session, role Requester.
- Success: `201` attachment metadata.
- Errors: `400` unsupported type (`UNSUPPORTED_TYPE`) or 5-active limit reached (`LIMIT_REACHED`); `401` no/invalid session; `403` non-Requester role; `404` ticket missing/not owned; `413` file exceeds 5MB; `500` unexpected.

### `GET /api/attachments/:id`

Retrieve one attachment's metadata (active or removed).

- Related: FR-05; BR-09.
- Auth: valid session, role Requester; ownership via parent Ticket.
- Success: `200` metadata.
- Errors: `401` no/invalid session; `403` non-Requester role; `404` missing or parent not owned; `500` unexpected.

### `GET /api/attachments/:id/download`

Download an active attachment's bytes.

- Related: FR-05; BR-09.
- Auth: valid session, role Requester; ownership via parent Ticket.
- Success: `200` binary stream (`Content-Disposition: attachment`, correct `Content-Type`).
- Errors: `401` no/invalid session; `403` non-Requester role; `404` missing/not owned; `410` soft-removed (`GONE`); `500` unexpected.

### `PATCH /api/attachments/:id/remove`

Soft-remove an owned active attachment. Body `{ "reason": string (5–200 chars) }`.

- Related: FR-05; BR-09.
- Auth: valid session, role Requester.
- Success: `200` `{ data: { id, removedAt, removalReason } }`.
- Errors: `400` missing/invalid `reason`; `401` no/invalid session; `403` non-Requester role; `404` missing/not owned; `409` already removed; `500` unexpected.

## 3. IT Staff queue and ticket operations

### `GET /api/staff/tickets`

Authentication/role: active IT Staff. Query parameters:

| Parameter | Rule |
|---|---|
| `search` | Case-insensitive partial match on ticket number, summary, description, requester name, or requester email; max 120 chars |
| `status` | One or repeated values from `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED` (exactly the 8 post-migration values; legacy `PENDING` is rejected with `400` — see `specification.md` BR-13) |
| `requestedPriority`, `itPriority` | `LOW`, `MEDIUM`, or `HIGH` |
| `categoryId`, `ownerId` | Positive integer; `ownerId=unassigned` is supported (`ownerId` refers to an active IT Staff user id; Administrators cannot be ticket owners per BR-11/BR-16) |
| `sort` | `ticketNumber`, `createdAt`, `updatedAt`, `requestedPriority`, `itPriority`, `status`, or `owner` |
| `order` | `asc` or `desc`; default `desc` |
| `page` | Integer >= 1; invalid values return `400` |
| `pageSize` | 10, 20, or 50; default 20; invalid values return `400` |

Default ordering is `updatedAt desc`, then `id desc` for stable ties. `200` returns `{ data: [ticketSummary], meta: { page, pageSize, totalItems, totalPages, queueTotal, isEmpty, isNoResults } }`. `queueTotal` is the count before filters; `isEmpty` means no tickets exist in the queue and `isNoResults` means filters/search matched none. Invalid query values return `400` with fields. `401/403/500` follow the common rules.

- Related: FR-04, FR-07; BR-28.
- Errors: `400` invalid query (`VALIDATION_ERROR` + `fields`, including legacy `PENDING` as status); `401` no/invalid session; `403` non-IT-Staff role; `500` unexpected (`INTERNAL_ERROR`).

### `GET /api/staff/tickets/:id`

Authentication/role: active IT Staff. `200` returns full operational detail: ticket fields, requester safe identity, owner, attachments, Public Comments, Internal Notes, and permitted actions metadata. Missing ticket returns `404`. Internal Notes are included only for IT Staff and Administrator routes.

- Related: FR-04, FR-08; BR-11.
- Errors: `401` no/invalid session; `403` non-IT-Staff role; `404` ticket missing; `500` unexpected.

### `PATCH /api/staff/tickets/:id/assignment`

Authentication/role: active IT Staff. Body `{ "ownerId": number | null }`; `null` unassigns. Owner, when present, must be an active IT Staff user only — Administrators cannot be assigned as Ticket Owner (BR-11/BR-16); only IT Staff may invoke this operation. `200` returns the updated ticket; invalid owner `400/404`, invalid state `409`.

- Related: FR-04, FR-08; BR-11, BR-16.
- Errors: `400` invalid `ownerId` shape or inactive/Administrator target (`VALIDATION_ERROR`); `401` no/invalid session; `403` non-IT-Staff role; `404` ticket or owner user missing; `409` invalid assignment state; `500` unexpected.

### `PATCH /api/staff/tickets/:id/priority`

Authentication/role: active IT Staff. Body `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" }`. `200` returns the updated priority/ticket. Invalid input `400`, missing ticket `404`.

- Related: FR-04, FR-08; BR-12.
- Errors: `400` invalid enum/body; `401` no/invalid session; `403` non-IT-Staff role; `404` ticket missing; `500` unexpected.

### `PATCH /api/staff/tickets/:id/status`

Authentication/role: active IT Staff. Body `{ "status": status }` where `status` is one of the 8 values in BR-13 (legacy `PENDING` is not accepted). `200` returns the updated ticket. Invalid transition `409`; invalid enum `400`; missing ticket `404`.

- Related: FR-04, FR-08; BR-13.
- Errors: `400` invalid enum/body (including `PENDING`); `401` no/invalid session; `403` non-IT-Staff role; `404` ticket missing; `409` disallowed transition; `500` unexpected.

The allowed transition matrix is:

| Current | Allowed next statuses |
|---|---|
| New | Open, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | Open, In Progress, Cancelled |
| Cancelled | Reopened |

The Requester Problem Appears Resolved action records the signal but does not perform a status transition. Migration note: any Lab 2 `PENDING` row is backfilled to `WAITING_FOR_REQUESTER` before the enum drops `PENDING`; thereafter `PENDING` is rejected with `400` in filters and status writes and never appears in responses.

## 4. Comments and notes

### `GET /api/tickets/:id/comments` and `POST /api/tickets/:id/comments`

Authentication: Requester may access only an owned Ticket; IT Staff may access queue tickets; Administrator may access permitted tickets for support context (no queue/detail permission implied). POST body `{ "content": string }`. `201` returns `{ data: { id, ticketId, author: { id, name, role }, content, createdAt } }`; GET returns `{ data: [...] }`. Empty/whitespace or over-2,000-character content returns `400`. Entries cannot be edited/deleted. Requester access to another ticket returns `404`.

- Related: FR-04, FR-06, FR-09; BR-04, BR-14.
- Errors: `400` empty/whitespace or >2,000 chars (`VALIDATION_ERROR`); `401` no/invalid session; `403` forbidden role for the route used; `404` ticket missing or not owned/hidden; `409` none (append-only, no conflict); `500` unexpected.

### `GET /api/staff/tickets/:id/notes` and `POST /api/staff/tickets/:id/notes`

Authentication/role: active IT Staff or Administrator. Body and response use the same content/entry shape as comments. `201`/`200` success, `400` validation, `403` Requester access, `404` missing/hidden ticket. No note content is returned to Requesters.

- Related: FR-04, FR-09; BR-04, BR-14.
- Errors: `400` empty/whitespace or >2,000 chars; `401` no/invalid session; `403` Requester role or otherwise forbidden; `404` ticket missing/hidden; `500` unexpected.

### `POST /api/tickets/:id/problem-appears-resolved`

Authentication/role: active Requester owning the ticket. No body. `200` returns `{ data: { ticketId, problemAppearsResolvedAt } }`. Repeated calls may return the existing signal idempotently. Other roles or ownership mismatch are denied according to the matrix.

- Related: FR-06; BR-05.
- Errors: `401` no/invalid session; `403` non-Requester role; `404` ticket missing or not owned; `500` unexpected.

## 5. Administrator user management

### `GET /api/admin/users`

Authentication/role: active Administrator. Query: `search` (name/email partial, max 120 chars) and optional `role` enum. No pagination, multi-column sorting, or multiple simultaneous filters. `200` returns `{ data: [{ id, name, email, role, isActive, mustChangePassword, createdAt, updatedAt }] }`; no hashes. Invalid query `400`, non-Administrator `403`.

- Related: FR-04, FR-10; BR-17, BR-18.
- Errors: `400` invalid query (`VALIDATION_ERROR`); `401` no/invalid session; `403` non-Administrator role; `500` unexpected.

### `POST /api/admin/users`

Authentication/role: Administrator. Body `{ name, email, role, isActive, initialPassword }`. One role is required. `201` returns the safe user shape with `mustChangePassword: true`. Duplicate normalized email `409`; validation/role/password failure `400`.

- Related: FR-04, FR-11; BR-17, BR-18, BR-19.
- Errors: `400` validation/role/password-policy failure (`VALIDATION_ERROR` + `fields`); `401` no/invalid session; `403` non-Administrator role; `409` duplicate normalized email (`CONFLICT`); `500` unexpected.

### `PATCH /api/admin/users/:id`

Authentication/role: Administrator. Body may contain `name`, `email`, `role`, and `isActive`; omitted fields remain unchanged. `200` returns the safe user. Duplicate email `409`; invalid role/body `400`; self-deactivation or last-active-Administrator removal `409`; missing user `404`.

- Related: FR-04, FR-11, FR-12; BR-17, BR-18, BR-20, BR-21, BR-22.
- Errors: `400` invalid body/role/email format; `401` no/invalid session; `403` non-Administrator role; `404` user missing; `409` duplicate email, self-deactivation, or last-active-Administrator removal/demotion (`CONFLICT`); `500` unexpected.

### `POST /api/admin/users/:id/initial-password`

Authentication/role: Administrator. Body `{ "initialPassword": string }`. `200` returns the safe user with `mustChangePassword: true`. The password is hashed server-side and is never returned or emailed. Invalid password `400`, missing user `404`.

- Related: FR-04, FR-11; BR-19 (hashing per BR-08).
- Errors: `400` password-policy failure; `401` no/invalid session; `403` non-Administrator role; `404` user missing; `500` unexpected.

No delete, bulk, import/export, role history, email invitation, or advanced recovery endpoint exists in Lab 3.

## 6. Safe failure rules

Every protected route distinguishes `401`, `403`, `400`, `404`, `409`, and `500` as above. Protected Ticket, Attachment, and Internal Note lookups combine the resource and authorization predicate so an unauthorized caller receives the same `404` whether the resource is absent or belongs to another user. Unexpected errors log server-side with correlation context but return only `INTERNAL_ERROR` and a generic message.

## 7. Authentication decisions

The session store is process-local and server-side, keyed by a random opaque cookie; sessions expire after 30 minutes idle or 8 hours absolute, whichever comes first (local-lab values; a server restart clears all sessions). Logout destroys the server record and clears the cookie. Passwords use scrypt exactly as frozen in `specification.md` BR-08: `crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 MiB })` with per-password `crypto.randomBytes(16)` salt, stored as a single `User.passwordHash` TEXT value in format `scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>` (hex-encoded salt + 64-byte key) and verified with `crypto.timingSafeEqual`; plaintext is never stored or returned. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when HTTPS is enabled. SameSite plus an Origin/CSRF-token check protects state changes. Initial-password behavior is local-lab only and never sends credentials through email. Secrets and session keys come from environment configuration and are never committed.

## 8. Endpoint to requirement map (summary index)

The authoritative Related FR/BR and error codes for each endpoint are listed directly under that endpoint in Sections 1–5 above. The table below is a summary index only.

| Endpoint | FR | BR |
|---|---|---|
| `POST /api/auth/login` | FR-01 | BR-01, BR-06, BR-08 |
| `POST /api/auth/logout` | FR-01 | BR-07 |
| `GET /api/auth/me` | FR-01 | BR-06 |
| `POST /api/auth/change-password` | FR-01, FR-02 | BR-02, BR-08 |
| `GET /api/categories` | FR-05 | BR-25 |
| `GET /api/related-systems` | FR-05 | BR-25 |
| `GET /api/requesters` | FR-05 | BR-25, BR-26 |
| `POST /api/tickets` | FR-05 | BR-03, BR-09, BR-24 |
| `GET /api/tickets` | FR-05 | BR-09, BR-28 |
| `GET /api/tickets/:id` | FR-05 | BR-09 |
| `POST /api/tickets/:id/attachments` | FR-05 | BR-09 |
| `GET /api/attachments/:id` | FR-05 | BR-09 |
| `GET /api/attachments/:id/download` | FR-05 | BR-09 |
| `PATCH /api/attachments/:id/remove` | FR-05 | BR-09 |
| `GET /api/staff/tickets` | FR-04, FR-07 | BR-28 |
| `GET /api/staff/tickets/:id` | FR-04, FR-08 | BR-11 |
| `PATCH /api/staff/tickets/:id/assignment` | FR-04, FR-08 | BR-11, BR-16 |
| `PATCH /api/staff/tickets/:id/priority` | FR-04, FR-08 | BR-12 |
| `PATCH /api/staff/tickets/:id/status` | FR-04, FR-08 | BR-13 |
| `/api/tickets/:id/comments` (GET, POST) | FR-04, FR-06, FR-09 | BR-04, BR-14 |
| `/api/staff/tickets/:id/notes` (GET, POST) | FR-04, FR-09 | BR-04, BR-14 |
| `POST /api/tickets/:id/problem-appears-resolved` | FR-06 | BR-05 |
| `GET /api/admin/users` | FR-04, FR-10 | BR-17, BR-18 |
| `POST /api/admin/users` | FR-04, FR-11 | BR-17, BR-18, BR-19 |
| `PATCH /api/admin/users/:id` | FR-04, FR-11, FR-12 | BR-17, BR-18, BR-20, BR-21, BR-22 |
| `POST /api/admin/users/:id/initial-password` | FR-04, FR-11 | BR-19 |
