# Lab 3 Visual Consistency Checklist

Completed on `feature/lab3-e2e-integration` **after Step 1 UI alignment**,
against the freshly re-captured screenshots in
`artifacts/lab-03/screenshots/` (20 PNGs, all captured post-alignment —
timestamps verified — and reviewed readable at native size).

Reference: `docs/lab-03/ui-reference/toktickit-mockup.html` (canonical) and
`client/src/styles/zen-green-tokens.css` (extracted tokens).
Legend: ✅ pass · ⚠️ pass with noted deviation · ❌ fail (none open).

## Capture method

- `authentication/login-*`: live backend (real `401` → `LoginPage`).
- Authenticated screens: real frontend build with stubbed API responses
  mirroring the seed shapes (no database in the capture environment).
- Breakpoints: desktop `1280×900`, tablet `834×1112`, mobile `375×812`.
- Behavioral coverage of the same screens: `client/e2e/lab-03/*.spec.ts`
  (live seeded backend, incl. no-overflow assertions per breakpoint).

## 1. Login (`authentication/login-desktop|tablet|mobile.png`)

| Item | D | T | M |
|---|---|---|---|
| Tokens match `zen-green-tokens.css`, no ad-hoc colors | ✅ | ✅ | ✅ |
| Role nav: none pre-login (correct) | ✅ | ✅ | ✅ |
| Labels muted, full-width green submit, red errbox per mockup | ✅ | ✅ | ✅ |
| Editable vs read-only distinguishable | ✅ | ✅ | ✅ |
| Validation messages below their field | ✅ | ✅ | ✅ |
| Focus states visible (token `--focus` outline) | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

## 2. Change Password (`authentication/change-password-desktop|tablet|mobile.png`)

| Item | D | T | M |
|---|---|---|---|
| Tokens match, no ad-hoc colors | ✅ | ✅ | ✅ |
| Gated shell: no role nav, no logout until saved (FR-02) | ✅ | ✅ | ✅ |
| Password-rules checklist in green-tinted box with checkmarks, text + state | ✅ | ✅ | ✅ |
| Editable vs read-only distinguishable | ✅ | ✅ | ✅ |
| Validation messages below their field | ✅ | ✅ | ✅ |
| Focus states visible | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

## 3. Staff Ticket Queue (`staff-queue/*`, incl. filtered, no-results)

| Item | D | T | M |
|---|---|---|---|
| Tokens match; header is exact reference green (`#14532d`) | ✅ | ✅ | ✅ |
| Role nav shows Ticket Queue only for IT Staff | ✅ | ✅ | ✅ |
| Priority/Status badges use reference pairs (amber MEDIUM, red HIGH, blue OPEN, green NEW) | ✅ | ✅ | ✅ |
| Table header muted, row borders/padding per mockup | ✅ | ✅ (cards) | ✅ (cards) |
| Editable (search/filters/sort) vs read-only cells | ✅ | ✅ | ✅ |
| Validation/empty states in consistent positions | ✅ | ✅ | ✅ |
| Focus states visible | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

Tablet note: the 9-column table cannot render readably at 834px, so tablet
uses the stacked cards (same CSS fix as the prior pass, retained through the
alignment). Desktop keeps the table.

## 4. Staff Ticket Detail (`staff-ticket-detail/detail-desktop|mobile.png`, `detail-comments-desktop.png`, `detail-notes-desktop.png`)

| Item | D | M |
|---|---|---|
| Tokens match, no ad-hoc colors | ✅ | ✅ |
| Role nav shows Ticket Queue only for IT Staff | ✅ | ✅ |
| Public Comments vs Internal Notes visually distinct (white thread + avatar vs amber `🔒 staff only` panel — safety cue preserved, now token-exact) | ✅ | ✅ |
| Comment headers carry avatar-circle-with-initials per mockup (green requester, blue staff, `aria-hidden`) | ✅ | ✅ |
| Read-only context (gray boxes) vs editable operations grouped | ✅ | ✅ |
| Resolved-signal warning is text + icon, not color alone | ✅ | ✅ |
| Validation/conflict messages in consistent positions | ✅ | ✅ |
| Focus states visible | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ |

Deliberately not adopted: the mockup's Comments/Notes/Attachments **tab
strip** — hiding safety-relevant threads behind tabs would remove
functionality and break E2E visibility assertions. The `.tabs` style is
extracted into the tokens file as a shared piece for future use; Lab 3 keeps
the stacked sections (code + component tests + E2E unchanged).

## 5. User Management (`user-management/list-desktop|tablet|mobile.png`, `create-form-desktop.png`, `edit-form-desktop.png`)

| Item | D | T | M |
|---|---|---|---|
| Tokens match, no ad-hoc colors | ✅ | ✅ | ✅ |
| Role nav shows User Management only for Administrators | ✅ | ✅ | ✅ |
| Role/Account badges match mockup (purple admin, blue staff, gray requester, green Active, **red Inactive**) | ✅ | ✅ | ✅ |
| Self-row Active box disabled + helper (guard state visible) | ✅ | ✅ | ✅ |
| Validation/conflict messages below fields + dialog-level alert | ✅ | ✅ | ✅ |
| Focus states visible; dialog `aria-modal` | ✅ | ✅ | ✅ |
| No clipping / overlap / horizontal overflow | ✅ | ✅ | ✅ |

Deliberately not adopted: the mockup's side-by-side Users/Create panel layout
and numbered pager — the real screen keeps its modal drawer (focus
management, E2E `dialog` role) and Prev/Next + range pagination. Only colors,
badges, table and dialog-panel styling were aligned.

## 6. Requester screens (no dedicated mockup section — same tokens/components)

`MyTicketsPage`, `TicketDetailPage`, `CreateTicketPage` inherit the aligned
header, badges, tables, cards, labels, buttons, and focus tokens through the
shared stylesheet; no Requester-specific markup was changed. Covered by the
E2E requester flows and the responsive assertions.

## Outcome

No open failures. Intentional deviations from the mockup (no tab-strip
restructure, no admin side-by-side restructure, no numbered pager, no
dark-mode, product copy/brand kept) are listed above with rationale: each
would have removed functionality or changed behavior, which Step 1 forbids.
