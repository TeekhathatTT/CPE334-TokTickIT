# Lab 2 UI Specification — Zen Green Theme

## 1. Color Tokens

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#006B3C` | App header background, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active nav tab, focus ring accent, links, hover states |
| `--color-pale-green` | `#EAF6EF` | Selected rows, success surfaces, subtle section backgrounds |
| `--color-bg-page` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards/panels, with 1px `#E1E7E3` border and a restrained shadow (`0 1px 3px rgba(0,0,0,0.06)`) |
| `--color-text` | `#1F2A24` | Body text (dark charcoal-green, not pure black) |
| `--color-field-editable-bg` | `#FFFFFF` | Editable field background, border `#C9D3CD` |
| `--color-field-readonly-bg` | `#F1F3EE` | Read-only field background (gray-green), border `#DCE2DC`, text slightly muted |
| `--color-error` | `#B3261E` | Error text/border |
| `--color-warning` | `#B98900` | Warning callouts/badges only, never decorative |
| `--color-success` | `#0B7A46` | Success confirmation text/border (paired with a check icon, not color alone) |

## 2. Typography and Spacing

- Font: system UI stack (`-apple-system, "Segoe UI", Roboto, sans-serif`).
- Base size 16px; labels 14px semibold; section headings 18–20px semibold in
  `--color-primary`.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32px. Field vertical rhythm: 16px between fields, 8px
  between label and control, 4px between control and validation message.
- All interactive controls (inputs, selects, buttons) share a 40px height, except multiline
  Description (min-height 120px, resizable vertically only, capped so it cannot overflow its
  container).

## 3. Field and Control States

| State | Visual Rule |
|---|---|
| Editable | White bg, `#C9D3CD` border, `--color-secondary` border on focus with visible outline ring |
| Read-only | `--color-field-readonly-bg`, no focus ring, cursor `not-allowed`, no placeholder text |
| Invalid | `--color-error` border (2px), error message directly beneath the field, red inline icon |
| Disabled | Reduced opacity (0.5), `--color-field-readonly-bg` background, cursor `not-allowed` |
| Focused (keyboard) | 2px `--color-secondary` outline offset 2px — never removed via `outline: none` without a replacement |

Required-field marker: red asterisk immediately after the label text (`Summary *`). The
asterisk never substitutes for the validation message; the message always renders on
blur/submit attempt.

## 4. Button Hierarchy

| Style | Use | Visual |
|---|---|---|
| Primary | Submit, Continue, Create Ticket | Solid `--color-primary` bg, white text |
| Secondary | Cancel, Back, Clear Filters | White bg, `--color-primary` border and text |
| Tertiary | Inline text actions (e.g., "Change Requester") | No border, `--color-secondary` text, underline on hover |
| Destructive | Remove Attachment | White bg, `--color-error` border and text; confirmation required before action fires |
| Disabled | Any button in an invalid/blocked state | 0.5 opacity, no hover/active feedback, `cursor: not-allowed` |
| Busy | Submit while request in flight | Primary style + inline spinner + label changes to "Submitting…"; button `disabled` |

## 5. Attachment Selection and Error Presentation

- Drop zone / file input styled as a dashed-border card inside the pale-green surface when
  empty; switches to a white surface once files are attached.
- Each selected file shows: filename, size, a small type icon, and a remove (✕) control before
  upload.
- Rejected files (wrong type/oversize) never enter the list — instead an inline error line
  appears directly under the drop zone naming the file and the specific reason (e.g.,
  "invoice.docx — unsupported file type. Allowed: JPG, PNG, WEBP, PDF").
- A running count "3 of 5 attachments" is shown once at least one file is present; it turns
  `--color-warning` at 5/5 and blocks further additions with a tooltip on the disabled "Add"
  control.

## 6. Screen States (all screens)

Every Create/List/Detail screen implements, at minimum:

1. **Initial** — form/list ready for input, no data yet fetched-dependent errors.
2. **Loading** — skeleton rows (list) or a centered spinner with label (form reference data)
   inside the surface, never a blank white screen.
3. **Validation** — inline messages per invalid field, focus moves to the first invalid field
   on submit attempt.
4. **Submitting/Busy** — primary action busy state (Section 4); form remains editable-looking
   but inputs are disabled to prevent mid-submit edits.
5. **Success** — pale-green confirmation panel (Create Ticket: Ticket Number + "View Ticket" /
   "Create Another" actions).
6. **Failure** — error panel with `--color-error` accent, human-readable message, a Retry
   action, and (for Create Ticket) all field values still populated.
7. **Empty** — used when a Requester genuinely has zero tickets; friendly icon + "Create your
   first ticket" CTA.
8. **No results** — used when filters/search return nothing; distinct copy ("No tickets match
   your filters") + a "Clear Filters" action, no CTA to create a ticket.

## 7. Application Shell

- Header bar (`--color-primary` background, white text): TokTickIT wordmark/icon (left), "My
  Tickets" and "Create Ticket" nav items (center-left), current Requester name + chevron
  "Profile ⌄" menu exposing **Change Requester** (right).
- Active nav item underlined in white with a 2px indicator; non-active items at 80% opacity.
- Breadcrumb row below header on sub-screens (e.g., `My Tickets > Ticket Details`), using
  `--color-secondary` for the current page and `--color-text` muted for ancestors.
- **Mobile (<768px):** nav collapses into a hamburger menu; Requester name/Change Requester
  moves into the same menu; breadcrumb becomes a single "← Back to My Tickets" button.

## 8. Development Requester Selection Screen

- Centered card (max-width 480px) on the pale-green page background.
- Icon + "Select Development Requester" heading + one-sentence explanation that this is a
  Lab 2 testing mechanism, not login (per BR-03).
- Single required dropdown, `Development Requester *`, populated from `GET /api/requesters`
  (active only, per BR-04).
- Informational pale-green note: "Only active development requesters are shown."
- Secondary neutral callout: "Authentication coming in Lab 3."
- Primary "→ Continue" button (disabled until a Requester is chosen) + secondary "Cancel".
- **Loading:** dropdown replaced by a skeleton bar while requesters load.
- **Empty:** if the API returns zero active Requesters, the dropdown is replaced by an error
  panel: "No active development requesters are available. Contact an administrator." Continue
  is disabled.
- **API failure:** same error panel pattern with a Retry button.
- All controls keyboard-operable (native `<select>`, native `<button>`), visible focus ring.

## 9. Create Ticket Screen

**Layout (desktop, top → bottom):**
1. System-generated row (read-only styling): Ticket Number ("Generated after submission"),
   Ticket Date (today, read-only), Requester (from selected identity, read-only).
2. Classification row: Category *(select)*, Related System *(select)*, Requested Priority
   *(select: Low/Medium/High, defaulting to none selected)*.
3. Summary *(single-line, full width)*.
4. Description *(multiline, full width, resizable vertically, 120px min-height)*.
5. Attachments panel (Section 5 rules), full width.
6. Action row: primary **Create Ticket** (right), secondary **Cancel** (left).

**Tablet (768–991px):** Classification row becomes two columns instead of three; everything
else stacks the same as desktop.

**Mobile (<768px):** All fields stack in a single column, full width; action buttons stack
full-width with primary on top; Attachments drop zone remains tap-friendly (min 44px touch
target).

**Success state:** replaces the form with a pale-green confirmation panel showing the Ticket
Number in large `--color-primary` text, a summary of what was submitted, and "View Ticket" /
"Create Another Ticket" actions.

## 10. My Tickets Screen

**Desktop table columns** (left→right): Ticket No., Created Date, Summary, Category,
Requested Priority (badge), IT Priority (badge), Current Status (badge), Last Updated. Ticket
No. and Last Updated are sortable via clickable header + sort-direction icon.

**Top bar:** Page title + subtitle, "Clear Filters" (secondary) and "Create Ticket" (primary)
top-right.

**Filter row:** Search input (Ticket Number/Summary), Category select, Requested Priority
select, IT Priority select, Current Status select — all defaulting to "All ___".

**Pagination footer:** "Showing X to Y of Z tickets" (left), Previous / page numbers / Next
(right), with the permitted page-size options exposed via a small select at the far right.

**Mobile (<768px):** table becomes a stacked card per ticket — Ticket No. + Status badge on
the card header row, Summary below, Category/Priority/Last Updated as a 2-column mini-grid
inside the card; filters collapse into a single "Filters" button opening a bottom-sheet-style
panel; pagination becomes a simple Previous/Next pair with "Page X of Y" centered between them.

**Badges (priority/status)** share one pill shape (`border-radius: 999px`, 12px/6px padding,
14px text) and use color + label text together (never color alone):
- Requested/IT Priority: Low = pale-green bg/`--color-secondary` text; Medium = amber bg/dark
  text; High = light-red bg/`--color-error` text.
- Current Status: New = pale-green; Open = light-blue; In Progress = amber; Resolved = green
  solid with white text; Pending = gray.

## 11. Requester Ticket Detail Screen

**Layout:** Breadcrumb (`My Tickets > Ticket Details`) + "← Back to My Tickets" action, top
right.

**Info grid** (read-only field styling throughout, 4-column desktop / 2-column tablet /
1-column mobile): Ticket No., Ticket Date, Category, Related System, Requester, Requested
Priority (badge), IT Priority (badge), Current Status (badge), Ticket Owner. Below the grid,
full-width Summary and Description (read-only text blocks, not input boxes).

**Attachments panel** (tabbed or sectioned, clearly separate from the info grid above):
- **Active** list: filename, size, uploaded date, Download action, Remove (destructive)
  action opening a confirmation dialog requiring a removal reason (5–200 chars) before
  confirming.
- **Removed** list (collapsed by default, "Show removed (N)" toggle): filename, size, removed
  date, removal reason, no Download/Preview control — replaced by a muted "Unavailable" label.
- "Add Attachment" control at the top of the panel, disabled with a tooltip once 5 active
  attachments exist (BR-19).

No Public Comments, Internal Notes, or Actions Taken UI appears anywhere on this screen, per
scope exclusions.

## 12. Responsive Requirements

| Viewport | Behavior |
|---|---|
| Desktop ≥ 992px | Full multi-column layouts as specified above; page content centered with `max-width: 1200px`. |
| Tablet 768–991px | Two-column layout where practical; Summary/Description keep full available width. |
| Mobile < 768px | Fields stack vertically; buttons ≥44px touch target; no horizontal page scroll under any state. |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, attachment filenames truncate with ellipsis + full name in a tooltip/title attribute rather than being cut off silently. |

## 13. Accessibility

- All form controls have an associated `<label>` (visible, not placeholder-only).
- Icon-only controls (e.g., remove ✕, sort arrows) carry `aria-label` and a visible tooltip.
- Focus order follows visual/reading order; no positive `tabindex` values.
- Color is never the sole indicator of state — badges and messages always pair color with
  text/icon.
- Error messages are associated with their field via `aria-describedby`.

## 14. Screenshot Evidence Paths

```
artifacts/lab-02/screenshots/
├── create-ticket/{mobile,tablet,desktop}.png   (initial, validation, success, failure)
├── my-tickets/{mobile,tablet,desktop}.png      (populated, empty, no-results)
└── ticket-detail/{mobile,tablet,desktop}.png   (active + removed attachments shown)
```