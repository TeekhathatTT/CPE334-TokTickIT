# Lab 4 UI Specification — Zen Green

## 1. Visual continuity

Reuse Lab 3's Zen Green tokens, cards, badges, tabs, buttons, validation placement, and 40px controls (`docs/lab-03/ui-spec.md` §1, `zen-green-tokens.css`). **No new palette is introduced.** New Lab 4 surfaces reuse existing tokens only:

| Element | Mapping (existing tokens only) |
|---|---|
| Actions Taken thread panel | white card, same shape as comments/notes; **green left-border accent** (`--color-secondary`) + wrench/clipboard icon + "Actions Taken" title — distinct from Public Comments (neutral card) and Internal Notes (amber-tinted panel + lock icon + "staff only" copy) |
| Follow-up badge (pending) | amber bg / dark text + "Follow-up required" text (reuses Waiting-for-Requester amber language; never color alone) |
| Follow-up badge (resolved) | pale-green bg / `--color-secondary` text + "Follow-up resolved" text |
| Result badge | light-blue bg / `--color-primary` text + result label text (`RESOLVED_STEP` → "Resolved step", etc.) |
| Resolution-gate banner | amber `warning-panel` (same component as the Lab 3 resolved-signal flag) with blocking copy + pending count |
| Dashboard metric cards | white cards with large numeric value, label, helper line, and drill-down link for roles with queue access; zero-state cards keep layout, show empty copy, and keep the link enabled for those roles. For Administrator viewers (no queue access per Lab 3) the same cards render **without** a link and with an explanatory helper instead (see §2.2) — never a dead link (BR-13) |
| Dashboards reuse role/queue/status/priority badges unchanged from Lab 3 | no new badge colors |

The three threads on Staff Ticket Detail must never blur together: each keeps its own titled panel, own border/background, own icon, and own confirmation copy ("Posting as public comment…" vs "Saving as internal note — staff only…" vs "Recording staff action…"). Order on the page is fixed: Public Comments, then Internal Notes, then Actions Taken.

## 2. Screens

### 2.1 Requester Dashboard (new; FR-06)

Route/shell: Requester shell gains a "Dashboard" nav item (alongside My Tickets, Create Ticket). Content: four metric cards (`openTickets`, `awaitingMyResponse`, `recentlyResolved`, `totalSubmitted`) in a 4→2→1 responsive grid, each showing label, numeric value, one-line helper (the BR-08 empty copy when zero), and a drill-down link ("View tickets →" to the specified My Tickets filter; "Create a ticket →" for zero `totalSubmitted`). Below: "Recently updated" strip (up to 5 tickets, number + summary + status badge + updated date, linking to Ticket Detail).

### 2.2 IT Staff Dashboard (new; FR-07, IT Staff UI; Administrator API-only)

Only the IT Staff shell gains a "Dashboard" nav item (alongside Ticket Queue). Six metric cards (`unassignedActive`, `assignedToMe`, `waitingForRequester`, `pendingFollowUp`, `resolvedPendingClose`, `newToday`) appear in a 3→2→1 responsive grid with the same label/value/helper/link anatomy; `pendingFollowUp` cards link to the exact drill-down `?hasPendingFollowUp=true` (not an id list — the 200-id cap never truncates the drill-down); every card's value equals its drill-down's row count (BR-08). The Administrator role can read the same aggregates through the dashboard API, but the Lab 4 client does not expose a Dashboard screen or navigation item to Administrators; this is intentionally API-only and outside the UI scope. Administrators do not have queue/detail/assignment/status controls (Lab 3 matrix unchanged), and Lab 4 does not add an admin surface for Staff Ticket Detail / Actions Taken create-edit-resolve. Rendering a link to the staff queue for an admin would be dead UI and is forbidden.

### 2.3 Actions Taken area of Staff Ticket Detail (extends FR-08/FR-09 screen; IT Staff route only — Administrator powers API-only)

Appended below Internal Notes per §1 ordering. This route remains **IT-Staff-only** per Lab 3 (administrators have no queue/detail access, so Lab 4 adds no admin UI surface here; Administrator any-row edit / any-row resolve powers from spec BR-06 are exercised via API only and never render in this UI). Components (all role checks below are therefore IT-Staff-only in practice):

- **List:** chronological entries; each row shows action date (server `actionDate`, locale-formatted), author name + role badge, `description`, `result` badge, `attachmentNotes` line (when present, quoted with a paperclip icon and "attachment reference" helper — never a download button), follow-up badge (pending/resolved with note text and resolver/when line), and row actions: **Edit** (visible only to the author while still active IT Staff; others see no Edit control — the Administrator any-row-edit case never renders here because admins never open this route) and **Mark follow-up resolved** (visible to any IT Staff only while the row is pending — the Administrator resolve case is API-only).
- **Create form:** `description` textarea with live 5–2,000 counter, `result` select (5 controlled values), `followUpRequired` checkbox, conditional `followUpNote` textarea (appears and becomes required when checked; hidden and cleared when unchecked — the required-when rule is **visibly enforced**: submit disabled with inline error until satisfied, not just backend-validated), `attachmentNotes` optional input (≤500, helper: "Name a file already attached to this ticket — this does not upload anything"). Submit disables while in-flight ("Recording…"); success appends the row and clears the draft; failure preserves the draft with Retry.
- **Edit mode:** inline per-row form with the same field rules; shows "Last updated …" audit line; requires `expectedUpdatedAt` under the hood; on `409 VERSION_CONFLICT` shows "Someone else changed this entry — Reload entry / Keep my text" (draft preserved, never discarded).
- **Resolution-gate banner:** while the ticket is in `OPEN`/`IN_PROGRESS`/`WAITING_FOR_REQUESTER` **and** `pendingFollowUpCount > 0` (sourced from `GET /api/staff/tickets/:id.pendingFollowUpCount` on page load — never derived by counting the list client-side), an amber banner above the Status control reads: "Resolution blocked — N follow-up action(s) still pending. Resolve each item below before marking Resolved." The Status select still offers Resolved (matrix-legal) but choosing it surfaces the server `RESOLUTION_BLOCKED` message inline if forced.

### 2.4 Requester Ticket Detail — read-only Actions Taken (extends FR-06 screen)

Same list rows as §2.3 **without** create form, Edit, or Resolve controls (full shape including `followUpNote`/`attachmentNotes` per `api-spec.md` — staff must write requester-safe wording). A helper line reads "Recorded by IT — read-only." Forced writes are server-`403` (AC-09).

## 3. Modes and feedback

- Dashboards: loading (skeleton cards), populated, zero/empty (per-card empty copy, layout preserved), forbidden (`403` — e.g. Requester on staff dashboard), API failure (safe panel + Retry, entered state preserved — dashboards hold no drafts so Retry simply re-fetches).
- Actions Taken list: loading (skeleton rows), populated, empty ("No actions recorded yet." + staff-only create nudge; requester sees read-only variant), load failure (panel + Retry).
- Actions Taken create/edit/resolve: initial, field validation (live counters, conditional required), saving (disabled + busy copy), success (inline confirmation + row update), validation failure (inline `aria-describedby` errors, focus to first invalid), conflict (`VERSION_CONFLICT` copy + reload/keep choice; `RESOLUTION_BLOCKED` copy on status), safe API failure (draft preserved + Retry).
- Ticket status/assignment/priority: Lab 3 states plus conflict state (`VERSION_CONFLICT` copy + "Reload ticket" that refreshes `updatedAt` and preserves the user's intended value for one-click retry).

Success/failure copy uses text + icon (never color alone). Focus moves to the first invalid control or the failure panel heading on error; never a blank screen.

## 4. Responsive and accessibility rules

Breakpoints identical to Lab 3 (desktop ≥992px, tablet 768–991px, mobile <768px):

- Dashboard grids collapse 4→2→1 (requester) and 3→2→1 (staff); cards never clip; numeric values wrap; drill-down links stay ≥44px touch targets on mobile.
- Staff Ticket Detail threads stack full-width; tables already become cards per the Lab 3 tablet fix; Actions Taken rows render as stacked cards at ≤991px with author/date first.
- Filters/drill-down controls wrap or collapse into the compact panel pattern from the queue; no horizontal overflow at any breakpoint.
- Accessibility: full keyboard reachability in reading order; visible focus rings; every input labeled; errors via `aria-describedby`; dialogs/drawers trap and return focus; icon-only actions carry accessible names; status/result/follow-up badges always include text; long filenames/emails truncate with `title` + full accessible value.
- Zero console errors/warnings on happy paths; no dead UI — every rendered button/link either acts or is disabled with an explained reason.

## 5. Role/action summary (extends Lab 3 §10)

| Surface | Requester | IT Staff | Administrator |
|---|---|---|---|
| Requester Dashboard | Yes (own data, links enabled) | No | No |
| IT Staff Dashboard aggregates | No | Yes (cards link to exact drill-downs) | Yes (read-only aggregates; cards render **without** links + reason "Sign in as IT Staff to open the queue"; no queue/detail/assignment/status powers) |
| Staff Ticket Detail route (incl. Actions Taken area) | No | Yes | No (no UI surface; API-only) |
| Actions Taken list | Own tickets, read-only (full shape incl. notes; staff must write requester-safe wording) | Yes | API-only (no UI surface) |
| Actions Taken create | No | Yes (any ticket, UI + API) | Yes (API-only; no UI surface) |
| Actions Taken edit (fields) | No | Author-while-active only (UI + API) | Yes (any row, API-only; no UI surface) |
| Follow-up resolve | No | Yes (any row, UI + API) | Yes (any row, API-only; no UI surface) |

## 6. Visual evidence paths for later implementation

Do not create evidence in this specification branch. Later implementation work records screenshots under:

```text
artifacts/lab-04/screenshots/
├── requester-dashboard/
├── staff-dashboard/
└── actions-taken/
```
