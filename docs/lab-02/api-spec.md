# Lab 2 API Contract

## 0. Conventions

- Base path: `/api`.
- All Ticket/Attachment endpoints require header `x-requester-id: <int>` — the Lab 2
  stand-in for authentication (BR-03). Missing or non-existent header value → `401`.
- Ownership violations return **404** (never 403), so a Requester cannot distinguish "doesn't
  exist" from "belongs to someone else" (BR-08).
- All error responses share the shape:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Summary is required.", "fields": { "summary": "Summary is required." } } }
  ```
  `fields` is omitted when the error isn't field-specific.
- Timestamps are ISO-8601 UTC strings.

## 1. `GET /api/categories`

Retrieve active Categories for the Create Ticket classification controls.

- **Response 200**
  ```json
  { "data": [ { "id": 1, "name": "Hardware" }, { "id": 2, "name": "Software" } ] }
  ```
- **500** safe unexpected-error body on DB failure.

## 2. `GET /api/related-systems`

Retrieve active Related Systems.

- **Response 200**
  ```json
  { "data": [ { "id": 1, "name": "Corporate Laptop" }, { "id": 2, "name": "Campus Wi-Fi" } ] }
  ```

## 3. `GET /api/requesters`

Retrieve active Development Requesters for the Selection screen (BR-04).

- **Response 200**
  ```json
  { "data": [ { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" } ] }
  ```
- Inactive Requesters are excluded server-side, not merely hidden client-side.

## 4. `POST /api/tickets`

Create one Ticket for the Requester identified by `x-requester-id`.

- **Request** (`multipart/form-data` to allow attachments in the same call)
  - Fields: `categoryId` (int, required), `relatedSystemId` (int, required), `summary`
    (string, required), `description` (string, required), `requestedPriority` (`LOW` |
    `MEDIUM` | `HIGH`, required)
  - Files: `attachments[]` (0–5 files, JPG/PNG/WEBP/PDF, ≤5MB each)
- **Response 201**
  ```json
  {
    "data": {
      "id": 101,
      "ticketNumber": "TKT-2026-000101",
      "requesterId": 1,
      "categoryId": 1,
      "relatedSystemId": 3,
      "summary": "Laptop battery drains quickly",
      "description": "My laptop battery is draining much faster than usual...",
      "requestedPriority": "MEDIUM",
      "itPriority": null,
      "status": "NEW",
      "createdAt": "2026-08-19T09:14:00Z",
      "attachments": [
        { "id": 501, "originalFilename": "screenshot.png", "sizeBytes": 240000, "uploadFailed": false }
      ]
    }
  }
  ```
- **400** — validation failure (missing/invalid `summary`, `description`, `categoryId`,
  `relatedSystemId`, `requestedPriority`, invalid enum value); body includes `fields`.
- **401** — missing/unknown `x-requester-id`.
- **404** — `categoryId`/`relatedSystemId` doesn't reference an active row.
- **207-style partial success within 201** — if the Ticket is created but one or more
  attachments fail (type/size/storage), the Ticket is still returned with `201`, and each
  attachment entry includes `"uploadFailed": true` and a `"reason"` string (BR-16). No
  separate status code is used; the client reads the per-file flags.
- **500** — safe unexpected-error body; no partial Ticket row is left committed.

## 5. `GET /api/tickets`

Retrieve the selected Requester's own tickets — search, filter, sort, paginate.

- **Query parameters**

  | Param | Type | Notes |
  |---|---|---|
  | `search` | string | Matches `ticketNumber` (partial) or `summary` (partial, case-insensitive) |
  | `category` | int | Category ID filter |
  | `requestedPriority` | `LOW\|MEDIUM\|HIGH` | |
  | `itPriority` | `LOW\|MEDIUM\|HIGH` | |
  | `status` | `NEW\|OPEN\|IN_PROGRESS\|RESOLVED\|PENDING` | |
  | `sort` | `createdAt\|updatedAt\|ticketNumber` | default `createdAt` |
  | `order` | `asc\|desc` | default `desc` |
  | `page` | int ≥1 | default 1; invalid → 1 |
  | `pageSize` | `10\|20\|50` | default 10; invalid → 10 |

- **Response 200**
  ```json
  {
    "data": [ { "id": 101, "ticketNumber": "TKT-2026-000101", "summary": "...", "category": "Hardware", "requestedPriority": "MEDIUM", "itPriority": null, "status": "NEW", "createdAt": "...", "updatedAt": "..." } ],
    "meta": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5, "isEmpty": false, "isNoResults": false }
  }
  ```
  `isEmpty` is true only when the Requester has zero tickets overall (BR-27); `isNoResults` is
  true when filters/search produced zero of an otherwise non-empty set.
- **401** — missing/unknown `x-requester-id`.

## 6. `GET /api/tickets/:id`

Retrieve one owned Ticket with full detail and attachment metadata (active + removed).

- **Response 200**
  ```json
  {
    "data": {
      "id": 101, "ticketNumber": "TKT-2026-000101", "createdAt": "...", "category": "Hardware",
      "relatedSystem": "Corporate Laptop", "requester": "Jennifer Anderson",
      "requestedPriority": "MEDIUM", "itPriority": null, "status": "NEW",
      "ticketOwner": null, "summary": "...", "description": "...",
      "attachments": {
        "active": [ { "id": 501, "originalFilename": "screenshot.png", "sizeBytes": 240000, "uploadedAt": "..." } ],
        "removed": [ { "id": 499, "originalFilename": "old.pdf", "sizeBytes": 120000, "removedAt": "...", "removalReason": "Wrong file attached" } ]
      }
    }
  }
  ```
- **401** — missing/unknown `x-requester-id`.
- **404** — Ticket doesn't exist, or exists but belongs to a different Requester (BR-08,
  AC-03/AC-24).

## 7. `POST /api/tickets/:id/attachments`

Add one permitted attachment to an owned Ticket.

- **Request** `multipart/form-data`, single field `file`.
- **Response 201**
  ```json
  { "data": { "id": 502, "originalFilename": "invoice.pdf", "sizeBytes": 310000, "uploadedAt": "..." } }
  ```
- **400** — unsupported file type (`UNSUPPORTED_TYPE`) or limit reached (`LIMIT_REACHED`,
  BR-19).
- **413** — file exceeds 5MB (BR-18).
- **404** — Ticket not found or not owned by `x-requester-id`.

## 8. `GET /api/attachments/:id`

Retrieve one attachment's metadata (active or removed).

- **Response 200**
  ```json
  { "data": { "id": 501, "ticketId": 101, "originalFilename": "screenshot.png", "sizeBytes": 240000, "uploadedAt": "...", "removedAt": null, "removalReason": null } }
  ```
- **404** — attachment not found, or its parent Ticket isn't owned by `x-requester-id`.

## 9. `GET /api/attachments/:id/download`

Download an **active** attachment's file bytes.

- **Response 200** — binary stream, `Content-Disposition: attachment; filename="..."`, correct
  `Content-Type`.
- **404** — not found / not owned.
- **410** — attachment exists and is owned, but has been soft-removed (BR-20, AC-18).

## 10. `PATCH /api/attachments/:id/remove`

Soft-remove an owned, currently-active attachment.

- **Request**
  ```json
  { "reason": "Wrong file attached" }
  ```
- **Response 200**
  ```json
  { "data": { "id": 501, "removedAt": "2026-08-19T10:02:00Z", "removalReason": "Wrong file attached" } }
  ```
- **400** — `reason` missing or outside 5–200 chars (BR-21).
- **404** — attachment not found / not owned.
- **409** — attachment is already removed (idempotency guard against double-removal).

## 11. HTTP Status Summary

| Status | Meaning in this API |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Ticket or Attachment created |
| 400 | Validation failure (field-level or business-rule, e.g. limit reached) |
| 401 | Missing/unknown `x-requester-id` |
| 404 | Resource missing or not owned by the requesting identity |
| 409 | Conflict (e.g., removing an already-removed attachment) |
| 410 | Resource existed but is soft-removed and no longer retrievable in full (download only) |
| 413 | Uploaded file exceeds the 5MB limit |
| 500 | Unexpected server error; response body never leaks stack traces or internals |