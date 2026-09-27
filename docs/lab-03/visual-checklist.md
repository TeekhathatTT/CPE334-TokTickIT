# Lab 3 Visual Consistency Checklist

Completed on `feature/lab3-e2e-integration` against the screenshots in
`artifacts/lab-03/screenshots/` (20 PNGs, reviewed readable at native size).

## Capture method (read before citing a shot as live evidence)

- `authentication/login-*` were captured against the **live backend** (real
  `401` from `GET /api/auth/me` renders `LoginPage` with no database needed).
- All authenticated screens were captured with the **real frontend build**
  (vite dev + express API running locally) and **stubbed API responses that
  mirror the seed shapes** (`server/prisma/seed.mjs` rows mapped through the
  `client/src/api.ts` types). No database was available in the capture
  environment, so session, queue, detail, comments, notes, staff-directory,
  and admin-list payloads were fulfilled by route interception with
  representative seed content (e.g. `TKT-2026-000001…000005`, Priya Patel,
  Alice Admin). Component styling, layout, badges, breakpoints, and copy are
  the production code paths, not mockups.
- Breakpoints follow the Lab 2 E2E sizes: desktop `1280×900`, tablet
  `834×1112`, mobile `375×812` (ui-spec §9 bands: desktop ≥992px, tablet
  768–991px, mobile <768px).
- Behavioral (not just visual) coverage of the same screens lives in
  `client/e2e/lab-03/*.spec.ts`, which runs against the live seeded backend,
  including no-horizontal-overflow assertions at all three breakpoints.

## Per-screen results

Legend: ✅ pass · ⚠️ pass with note · ❌ fail (none open).

### 1. Login (`authentication/login-desktop|tablet|mobile.png`)

| Item | Desktop | Tablet | Mobile |
|---|---|---|---|
| Zen Green tokens only (no ad-hoc colors) | ✅ | ✅ | ✅ |
| Role-based navigation (none before login — correct) | ✅ | ✅ | ✅ |
| Status/Priority/Role badges n/a (none on screen) | ✅ | ✅ | ✅ |
| Editable vs read-only fields distinguishable | ✅ | ✅ | ✅ |
| Validation messages below their field (`field-error`) | ✅ (code + `Login.test.tsx`) | ✅ | ✅ |
| Focus states visible (2px `--color-secondary` outline) | ✅ (`zen-green.css` + E2E Tab-order test) | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

### 2. Change Password (`authentication/change-password-desktop|tablet|mobile.png`)

| Item | Desktop | Tablet | Mobile |
|---|---|---|---|
| Zen Green tokens only | ✅ | ✅ | ✅ |
| Gated shell: no role nav, no logout until saved (FR-02) | ✅ | ✅ | ✅ |
| Rule checklist is text + icon, never color alone | ✅ (`(met)`/`(not met)` copy in shot) | ✅ | ✅ |
| Editable vs read-only distinguishable | ✅ | ✅ | ✅ |
| Validation messages below their field | ✅ (code + `ChangePassword.test.tsx`) | ✅ | ✅ |
| Focus states visible | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

### 3. Staff Ticket Queue (`staff-queue/queue-populated-desktop|tablet|mobile.png`, `queue-filtered-desktop.png`, `queue-noresults-desktop.png`)

| Item | Desktop | Tablet | Mobile |
|---|---|---|---|
| Zen Green tokens only | ✅ | ✅ | ✅ |
| Role nav shows Ticket Queue only for IT Staff | ✅ | ✅ | ✅ |
| Priority/Status badges consistent with ui-spec §1 | ✅ (MEDIUM/amber, HIGH/red, NEW/pale-green, OPEN/blue) | ✅ | ✅ |
| Editable (search/filters/sort) vs read-only cells | ✅ | ✅ | ✅ |
| Validation/empty states in consistent positions | ✅ (no-results panel + `Clear Filters`) | ✅ | ✅ |
| Focus states visible | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ fixed* | ✅ |

\* **Tablet fix in this branch (small CSS issue, fixed inline):** the
9-column queue table clipped the Owner/Last-Updated columns at 834px because
`.ticket-table-wrap` used `overflow: hidden` with no fallback
(`queue-populated-tablet.png` before the fix showed `Unassigne`/`Priya Pate`).
Fix in `client/src/styles/zen-green.css` (`@media (max-width: 991px)`):
tablet now renders the same stacked ticket cards as mobile, desktop keeps the
table. Re-captured shot confirms all owners/dates/badges readable; E2E
`expectNoHorizontalOverflow` still asserts zero page-level overflow at all
three breakpoints. The shared classes also fix the 8-column My Tickets table
the same way. The 5-column User Management table already fit at tablet
(`user-management/list-tablet.png` — no change needed).

### 4. Staff Ticket Detail (`staff-ticket-detail/detail-desktop|mobile.png`, `detail-comments-desktop.png`, `detail-notes-desktop.png`)

| Item | Desktop | Mobile |
|---|---|---|
| Zen Green tokens only (amber notes panel per ui-spec §6) | ✅ | ✅ |
| Role nav shows Ticket Queue only for IT Staff | ✅ | ✅ |
| Resolved-signal warning uses text + icon, not color alone | ✅ (`⚠ Requester flagged…`) | ✅ |
| Public Comments vs Internal Notes visually unmistakable | ✅ (white thread vs amber `🔒 staff only` panel) | ✅ (stacked) |
| Editable (owner/priority/status/comment/note) vs read-only context | ✅ (detail grid read-only; operations grouped) | ✅ |
| Validation/conflict messages in consistent positions | ✅ (`error-panel` above each operation group; code + component tests) | ✅ |
| Focus states visible | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ |

### 5. User Management (`user-management/list-desktop|tablet|mobile.png`, `create-form-desktop.png`, `edit-form-desktop.png`)

| Item | Desktop | Tablet | Mobile |
|---|---|---|---|
| Zen Green tokens only | ✅ | ✅ | ✅ |
| Role nav shows User Management only for Administrators | ✅ | ✅ | ✅ |
| Role/Status badges consistent (ADMIN solid, staff blue, requester pale, Active green/Inactive gray) | ✅ | ✅ | ✅ |
| Editable vs read-only distinguishable (self Active box disabled + helper) | ✅ (`edit-form-desktop.png` shows the guard state) | ✅ | ✅ |
| Validation/conflict messages below fields + dialog-level alert | ✅ (code + `UserManagement.test.tsx`) | ✅ | ✅ |
| Focus states visible; dialog traps focus (`aria-modal`) | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

## Outcome

No open failures. One small CSS defect (tablet queue clipping) was found
through this checklist and fixed in this branch as described above; the
before/after evidence is the tablet queue screenshot plus the E2E responsive
assertions. Everything else passes per screen per breakpoint.
