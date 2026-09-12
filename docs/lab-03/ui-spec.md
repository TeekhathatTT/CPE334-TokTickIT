# Lab 3 UI Specification — Zen Green

## 1. Visual continuity

Reuse Lab 2's Zen Green tokens from `docs/lab-02/ui-spec.md`: primary `#006B3C`, secondary `#0B7A46`, pale green `#EAF6EF`, page `#F5F7F6`, white surfaces, charcoal-green text, editable/read-only field states, and red/amber/success feedback. Keep the existing spacing rhythm, field labels, button hierarchy, cards, badges, validation placement, and 40px controls. New screens must look like the same product.

## 2. Shell and navigation

The authenticated shell shows TokTickIT, the current user's Name and Role, role-appropriate navigation, and Logout. Requesters see My Tickets and Create Ticket. IT Staff see Ticket Queue. Administrators see User Management. A user with `mustChangePassword` sees only the Change Password flow and logout. Navigation is rendered by role for clarity but backend authorization remains mandatory. The old Development Requester selector and Change Requester action are absent.

## 3. Login and mandatory password change

Login is a focused responsive form with labelled Email and Password fields, inline validation, disabled busy submit, and a safe generic failure message. Inactive accounts receive the same non-enumerating authentication failure treatment. Change Password contains Current/Temporary Password, New Password, and Confirm New Password. A live checklist shows min 8 characters, upper case, lower case, number, and special character; it is text plus state icon, never color alone. Normal app routes remain blocked until success. Success returns the user to the correct role shell.

## 4. Requester regression

My Tickets, Create Ticket, and Ticket Detail retain Lab 2 behavior and Zen Green layout, but the authenticated session supplies identity. Ticket Detail adds a visually distinct Public Comments section and a Problem Appears Resolved action. Attachments remain ownership-protected. There is no requester selector, Change Requester control, Internal Notes section, or Actions Taken section. Public Comment is append-only with field-level length/blank validation.

## 5. IT Staff Ticket Queue

Desktop uses a readable table with Ticket Number, Created Date, Summary, Category, Requested Priority, IT Priority, Current Status, Ticket Owner, and Last Updated. The field set supports operations without a mega-grid; long descriptions are not shown in the table. Search, status/priority/category/owner filters, sortable headers, page-size select, and pagination are explicit controls. Mobile changes each row to a stacked ticket card with the key identity/status first and filters in a compact panel. Loading uses skeleton rows/cards; empty and no-results copy are distinct; forbidden and API failure are actionable and safe.

## 6. IT Staff Ticket Detail

Ticket information stays grouped and mostly read-only. Editable operations are limited to owner assignment, IT Priority, permitted status, Public Comment, and Internal Note. Assignment selects active IT Staff and supports unassigning. Status control exposes only allowed next values and explains conflicts. Public Comments and Internal Notes are separate titled panels with different borders/backgrounds and confirmation copy so private text cannot be accidentally posted publicly. Existing Attachments remain visible; Requesters' ownership rules continue.

## 7. Administrator User Management

One intentionally simple screen contains a user list with Name, Email, Role badge, Status badge, and Edit action. Search accepts name/email; one optional Role filter is available. No mandatory pagination, multi-column sorting, or compound filters. Create and edit use a clear form: Name, Email, one Role, activation state, and initial password on create. A separate Set New Initial Password action marks `mustChangePassword`. Duplicate email, invalid role, self-deactivation, and last-active-Administrator conflict feedback appears inline or in a safe alert. There is no delete, bulk action, import/export, role history, invitation, department, or advanced recovery UI.

## 8. Modes and feedback

- Login: initial, validating, busy, safe failure.
- Change Password: initial, live validation, saving, success, safe failure.
- Requester Create: initial, reference-data loading, field validation, submitting, success, failure.
- Requester List/Detail: loading, populated, empty/no-results, not-found, forbidden, API failure.
- Staff Queue: loading, populated, empty/no-results, invalid query, forbidden, API failure.
- Staff Detail: loading, read-only, saving assignment/priority/status, conflict, not-found, forbidden, API failure.
- User Management: loading, populated, create/edit, saving, validation, duplicate conflict, forbidden, safe failure.

Success and failure messages use text and icons. Preserve entered form values after network/server errors. Focus the first invalid control where practical; never leave a blank screen.

## 9. Responsive and accessibility rules

Desktop is at least 992px, tablet 768–991px, and mobile below 768px. Content uses constrained layouts without horizontal overflow. Tables become cards on mobile; controls wrap or stack; buttons and touch targets are at least 44px on mobile. Labels remain visible, controls have associated labels, errors use `aria-describedby`, dialogs use focus management, icon-only actions have accessible names/tooltips, keyboard order follows reading order, and focus rings remain visible. Status, priority, and role badges always include text. Long filenames and emails truncate with a title/full accessible value; no clipping or overlap is allowed.

## 10. Role/action summary

| Screen | Requester | IT Staff | Administrator |
|---|---|---|---|
| Login/change password | Yes | Yes | Yes |
| My Tickets/Create/own Detail | Yes | No | No |
| Ticket Queue/operational Detail | No | Yes | No |
| Public Comment | Own ticket | Yes | Yes |
| Internal Note | No | Yes | Yes |
| User Management | No | No | Yes |

## 11. Visual evidence paths for later implementation

Do not create evidence in this specification branch. Later implementation work records screenshots under:

```text
artifacts/lab-03/screenshots/
├── authentication/
├── staff-queue/
├── staff-ticket-detail/
└── user-management/
```
