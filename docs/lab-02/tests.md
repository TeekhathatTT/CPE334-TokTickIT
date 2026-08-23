# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are planned from `specification.md` before implementation, following Test DD/TDD: for
each Issue, the mapped tests are written first (and confirmed failing for the expected reason)
before the corresponding feature code is implemented. Coverage spans six levels: unit, API/
integration, UI component, UI style/visual, responsive, and end-to-end (E2E). Every Acceptance
Criterion (AC-01–AC-25) must map to at least one test below, and every test row names its real
test-file path.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01 | Ticket Number generator format/uniqueness | Returns `TKT-YYYY-NNNNNN`, unique across calls | `server/tests/lab-02/ticket-number.unit.test.ts` | Pending |
| UNIT-02 | Unit | BR-09, BR-10 | Summary/Description trim + length validators | Rejects <5/<10 chars and >120/>2000 chars after trim | `server/tests/lab-02/validators.unit.test.ts` | Pending |
| UNIT-03 | Unit | BR-17, BR-18 | Attachment type/size validator | Accepts JPG/PNG/WEBP/PDF ≤5MB; rejects others | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pending |
| API-01 | API | AC-01, FR-05, FR-06, BR-01, BR-02 | `POST /api/tickets` valid create | 201; ticket persisted with `NEW` status and unique Ticket Number | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-02 | API | AC-04, BR-09 | `POST /api/tickets` missing Summary | 400 with field-level error, no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-03 | API | BR-11 | `POST /api/tickets` invalid/inactive Category | 400 referencing invalid Category | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-04 | API | AC-09, BR-15 | `POST /api/tickets` DB failure simulated | 500 safe error, no partial row committed | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-05 | API | AC-10, FR-07, BR-08 | `GET /api/tickets` scoping by `x-requester-id` | Only requesting Requester's tickets returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-06 | API | FR-08, BR-24 | `GET /api/tickets?search=` | Matches Summary/Ticket Number, case-insensitive | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-07 | API | FR-09 | `GET /api/tickets?category=&status=&priority=` | Correct filtered subset returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-08 | API | FR-10, BR-25 | `GET /api/tickets?sort=` | Correct ordering; default sort applied when omitted | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-09 | API | AC-13, FR-11, BR-26 | `GET /api/tickets?page=&pageSize=` | Correct page slice + pagination metadata; invalid values fall back to defaults | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-10 | API | AC-12, BR-27 | `GET /api/tickets` zero tickets for Requester | Empty array + `isEmpty: true` metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-11 | API | AC-24, AC-03, FR-13, BR-08 | `GET /api/tickets/:id` cross-Requester access | 404, no ticket data leaked | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-12 | API | AC-14, FR-14 | `GET /api/tickets/:id` owned | 200 with full read-only ticket + attachment metadata | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-13 | API | AC-08, BR-19 | `POST /api/tickets/:id/attachments` at 5-active limit | 400 limit-reached, no row created | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-14 | API | BR-17, BR-18 | `POST /api/tickets/:id/attachments` invalid type/size | 400/413 with specific reason | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-15 | API | AC-15, FR-16 | `GET /api/attachments/:id/download` active | 200 with file stream | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-16 | API | AC-18, BR-20 | `GET /api/attachments/:id/download` removed | 410 Gone | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-17 | API | AC-16, BR-21 | `PATCH /api/attachments/:id/remove` no reason | 400 validation error, attachment stays active | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-18 | API | AC-17, FR-17, FR-18, BR-20 | `PATCH /api/attachments/:id/remove` valid reason | 200; `removedAt`/`removalReason` set; metadata retained | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-19 | API | BR-22 | Attachment action by non-owning Requester | 404 on both add and remove | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-20 | API | BR-04, AC-19 | `GET /api/requesters` | Only active Requesters returned | `server/tests/lab-02/requesters.api.test.ts` | Pending |
| UI-01 | UI | AC-04 | Create Ticket submit with empty Summary | Field message shown; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-02 | UI | AC-25, BR-14 | Submit button busy/disabled state | Button disabled + spinner while request in flight | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-03 | UI | AC-06, AC-07 | Attachment picker rejects oversize/wrong type | Inline error, file not added to upload list | `client/tests/lab-02/AttachmentSection.test.tsx` | Pending |
| UI-04 | UI | AC-09, BR-15 | Create Ticket API failure | Error banner shown; form values retained | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-05 | UI | AC-11, AC-12 | My Tickets empty vs no-results rendering | Distinct empty-state and no-results-state components render correctly | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| UI-06 | UI | AC-14 | Ticket Detail renders fields read-only | No input/select elements present in header grid | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pending |
| UI-07 | UI | AC-17 | Soft-remove attachment flow (reason required) | Remove blocked without reason; succeeds with reason and moves item to Removed list | `client/tests/lab-02/AttachmentSection.test.tsx` | Pending |
| UI-08 | UI | AC-02 | No Requester selected guards My Tickets route | Redirects to Requester Selection screen | `client/tests/lab-02/RouteGuard.test.tsx` | Pending |
| UI-09 | UI | AC-20 | Requester Selection API failure | Safe error state rendered, no crash | `client/tests/lab-02/RequesterSelection.test.tsx` | Pending |
| UI-10 | UI | AC-19, BR-04 | Requester Selection dropdown contents | Inactive Requester absent from options | `client/tests/lab-02/RequesterSelection.test.tsx` | Pending |
| STYLE-01 | UI Style | Section 8.8, 8.9 | Zen Green class/token assertions | Required CSS classes/tokens present on field, badge, and button states | `client/tests/lab-02/ZenGreenStyle.test.tsx` | Pending |
| RESP-01 | Responsive | AC-22 | Playwright screenshots — Create Ticket | No clipping/overlap/horizontal scroll at 375/834/1280px | `e2e/lab-02/responsive-create-ticket.spec.ts` | Pending |
| RESP-02 | Responsive | AC-22 | Playwright screenshots — My Tickets | Table→card layout switch confirmed; no overflow | `e2e/lab-02/responsive-my-tickets.spec.ts` | Pending |
| RESP-03 | Responsive | AC-22 | Playwright screenshots — Ticket Detail | Attachment panel and header remain usable at all sizes | `e2e/lab-02/responsive-ticket-detail.spec.ts` | Pending |
| E2E-01 | E2E | AC-01, AC-05 | Full responsive create flow | Confirmation shows official Ticket Number at mobile + desktop | `e2e/lab-02/create-ticket.spec.ts` | Pending |
| E2E-02 | E2E | AC-01, AC-10, AC-13, FR-07 | Create then find in My Tickets across Requesters | Ticket appears only for creating Requester, correct on paginated list | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-03 | E2E | AC-14, AC-15, AC-17, AC-18 | Full attachment lifecycle | Add → download active → soft-remove w/ reason → removed download blocked (410) | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-04 | E2E | AC-03, AC-24 | Cross-Requester ticket access attempt | Direct ticket-ID navigation as other Requester yields not-found | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-05 | E2E | AC-23 | Keyboard-only Create Ticket completion | Full form completed and submitted via keyboard only | `e2e/lab-02/keyboard-accessibility.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability

| AC | Covered By |
|---|---|
| AC-01 | API-01, E2E-01, E2E-02 |
| AC-02 | UI-08 |
| AC-03 | API-11, E2E-04 |
| AC-04 | API-02, UI-01 |
| AC-05 | E2E-01 |
| AC-06 | UI-03 |
| AC-07 | UI-03 |
| AC-08 | API-13 |
| AC-09 | API-04, UI-04 |
| AC-10 | API-05, E2E-02 |
| AC-11 | API-06, UI-05 |
| AC-12 | API-10, UI-05 |
| AC-13 | API-09, E2E-02 |
| AC-14 | API-12, UI-06 |
| AC-15 | API-15, E2E-03 |
| AC-16 | API-17, UI-07 |
| AC-17 | API-18, UI-07, E2E-03 |
| AC-18 | API-16, E2E-03 |
| AC-19 | API-20, UI-10 |
| AC-20 | UI-09 |
| AC-21 | UI-08 (route reload asserted alongside guard) |
| AC-22 | RESP-01, RESP-02, RESP-03 |
| AC-23 | E2E-05 |
| AC-24 | API-11, E2E-04 |
| AC-25 | UI-02 |

## 4. Responsive and Visual Checklist

Checked via Playwright screenshots at 375px (mobile), 834px (tablet), 1280px (desktop) for
Create Ticket, My Tickets, and Ticket Detail, stored under
`artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/{mobile,tablet,desktop}.png`:

- [ ] No clipped labels or truncated badge text
- [ ] No overlapping validation messages
- [ ] No unintended horizontal page scroll at any breakpoint
- [ ] Editable vs read-only fields visually distinguishable without relying on color alone
- [ ] Required-field asterisk present and validation message appears below the field
- [ ] Primary/secondary/destructive/disabled/busy button styles distinct
- [ ] Priority/status badges use consistent shape/color/text across My Tickets and Ticket Detail
- [ ] Desktop table ↔ mobile card/responsive-table switch confirmed on My Tickets
- [ ] Filters, pagination, and attachment controls remain usable/tappable at 375px

## 5. Test Commands

```bash
# Server (unit + API/integration)
cd server
npm test

# Client (unit + UI component)
cd client
npm test

# E2E + responsive (Playwright)
npx playwright test e2e/lab-02
```

## 6. Final Results

To be filled in once implementation lands on `lab2-staging` and tests run against the final
`main` branch build:

| Suite | Command | Pass/Fail | Notes |
|---|---|---|---|
| Server unit + API | `cd server && npm test` | Pending | |
| Client UI | `cd client && npm test` | Pending | |
| E2E/responsive | `npx playwright test e2e/lab-02` | Pending | |

## 7. Known Limitations or Deferred Tests

- Load/performance testing of the ticket list under large data volumes is out of scope for
  Lab 2 and deferred.
- Cross-browser matrix beyond the Playwright default (Chromium) is not required this sprint.
- Security testing beyond ownership-check assertions (e.g., penetration testing) is deferred
  to when real authentication lands in Lab 3, per BR-29.