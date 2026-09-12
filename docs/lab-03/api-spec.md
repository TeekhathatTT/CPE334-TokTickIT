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

### `POST /api/auth/logout`

Authentication: valid session. Body: none. `204` clears the cookie and invalidates the server-side session. Missing/expired session returns `401`.

### `GET /api/auth/me`

Authentication: valid session. `200` returns the same safe user shape as login. `401` for absent/expired session. It never returns `passwordHash`.

### `POST /api/auth/change-password`

Authentication: valid session, including a `mustChangePassword` session. Body: `{ "currentPassword": string, "newPassword": string, "confirmPassword": string }`. `200` returns the safe user shape, clears `mustChangePassword`, and rotates the session. `400` covers mismatch/password rules; `401` covers an invalid current password/session. A user with `mustChangePassword` can call only this route, `me`, and logout until success.

## 2. Authenticated Lab 2 continuation

`GET /api/categories`, `GET /api/related-systems`, `POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`, `POST /api/tickets/:id/attachments`, `GET /api/attachments/:id`, `GET /api/attachments/:id/download`, and `PATCH /api/attachments/:id/remove` retain the Lab 2 shapes and validation. They now require a valid session with role Requester and derive the Requester from the session. A supplied `requesterId` is rejected as invalid or ignored. Requester-owned resource mismatch returns `404`; no other user's data is included.

## 3. IT Staff queue and ticket operations

### `GET /api/staff/tickets`

Authentication/role: active IT Staff. Query parameters:

| Parameter | Rule |
|---|---|
| `search` | Case-insensitive partial match on ticket number, summary, description, requester name, or requester email; max 120 chars |
| `status` | One or repeated values from `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED` |
| `requestedPriority`, `itPriority` | `LOW`, `MEDIUM`, or `HIGH` |
| `categoryId`, `ownerId` | Positive integer; `ownerId=unassigned` is supported |
| `sort` | `ticketNumber`, `createdAt`, `updatedAt`, `requestedPriority`, `itPriority`, `status`, or `owner` |
| `order` | `asc` or `desc`; default `desc` |
| `page` | Integer >= 1; invalid values return `400` |
| `pageSize` | 10, 20, or 50; default 20; invalid values return `400` |

Default ordering is `updatedAt desc`, then `id desc` for stable ties. `200` returns `{ data: [ticketSummary], meta: { page, pageSize, totalItems, totalPages, queueTotal, isEmpty, isNoResults } }`. `queueTotal` is the count before filters; `isEmpty` means no tickets exist in the queue and `isNoResults` means filters/search matched none. Invalid query values return `400` with fields. `401/403/500` follow the common rules.

### `GET /api/staff/tickets/:id`

Authentication/role: active IT Staff. `200` returns full operational detail: ticket fields, requester safe identity, owner, attachments, Public Comments, Internal Notes, and permitted actions metadata. Missing ticket returns `404`. Internal Notes are included only for IT Staff and Administrator routes.

### `PATCH /api/staff/tickets/:id/assignment`

Authentication/role: active IT Staff. Body `{ "ownerId": number | null }`; `null` unassigns. Owner must be an active IT Staff or Administrator user. `200` returns the updated ticket; invalid owner `400/404`, invalid state `409`.

### `PATCH /api/staff/tickets/:id/priority`

Authentication/role: active IT Staff. Body `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" }`. `200` returns the updated priority/ticket. Invalid input `400`, missing ticket `404`.

### `PATCH /api/staff/tickets/:id/status`

Authentication/role: active IT Staff. Body `{ "status": status }`. `200` returns the updated ticket. Invalid transition `409`; invalid enum `400`; missing ticket `404`.

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

The Requester Problem Appears Resolved action records the signal but does not perform a status transition.

## 4. Comments and notes

### `GET /api/tickets/:id/comments` and `POST /api/tickets/:id/comments`

Authentication: Requester may access only an owned Ticket; IT Staff and Administrator may access permitted tickets. POST body `{ "content": string }`. `201` returns `{ data: { id, ticketId, author: { id, name, role }, content, createdAt } }`; GET returns `{ data: [...] }`. Empty/whitespace or over-2,000-character content returns `400`. Entries cannot be edited/deleted. Requester access to another ticket returns `404`.

### `GET /api/staff/tickets/:id/notes` and `POST /api/staff/tickets/:id/notes`

Authentication/role: active IT Staff or Administrator. Body and response use the same content/entry shape as comments. `201`/`200` success, `400` validation, `403` Requester access, `404` missing/hidden ticket. No note content is returned to Requesters.

### `POST /api/tickets/:id/problem-appears-resolved`

Authentication/role: active Requester owning the ticket. No body. `200` returns `{ data: { ticketId, problemAppearsResolvedAt } }`. Repeated calls may return the existing signal idempotently. Other roles or ownership mismatch are denied according to the matrix.

## 5. Administrator user management

### `GET /api/admin/users`

Authentication/role: active Administrator. Query: `search` (name/email partial, max 120 chars) and optional `role` enum. No pagination, multi-column sorting, or multiple simultaneous filters. `200` returns `{ data: [{ id, name, email, role, isActive, mustChangePassword, createdAt, updatedAt }] }`; no hashes. Invalid query `400`, non-Administrator `403`.

### `POST /api/admin/users`

Authentication/role: Administrator. Body `{ name, email, role, isActive, initialPassword }`. One role is required. `201` returns the safe user shape with `mustChangePassword: true`. Duplicate normalized email `409`; validation/role/password failure `400`.

### `PATCH /api/admin/users/:id`

Authentication/role: Administrator. Body may contain `name`, `email`, `role`, and `isActive`; omitted fields remain unchanged. `200` returns the safe user. Duplicate email `409`; invalid role/body `400`; self-deactivation or last-active-Administrator removal `409`; missing user `404`.

### `POST /api/admin/users/:id/initial-password`

Authentication/role: Administrator. Body `{ "initialPassword": string }`. `200` returns the safe user with `mustChangePassword: true`. The password is hashed server-side and is never returned or emailed. Invalid password `400`, missing user `404`.

No delete, bulk, import/export, role history, email invitation, or advanced recovery endpoint exists in Lab 3.

## 6. Safe failure rules

Every protected route distinguishes `401`, `403`, `400`, `404`, `409`, and `500` as above. Protected Ticket, Attachment, and Internal Note lookups combine the resource and authorization predicate so an unauthorized caller receives the same `404` whether the resource is absent or belongs to another user. Unexpected errors log server-side with correlation context but return only `INTERNAL_ERROR` and a generic message.

## 7. Authentication decisions

The session store is server-side and keyed by a random opaque cookie; sessions expire after a documented inactivity/absolute lifetime selected by implementation configuration. Logout destroys the server record and clears the cookie. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when HTTPS is enabled. SameSite plus an Origin/CSRF-token check protects state changes. Initial-password behavior is local-lab only and never sends credentials through email. Secrets and session keys come from environment configuration and are never committed.
