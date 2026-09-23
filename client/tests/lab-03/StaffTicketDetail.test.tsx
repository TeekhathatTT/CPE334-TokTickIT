// StaffTicketDetail.test.tsx
// IT Staff ticket detail UI component tests.
//
// Status: PLANNED — the StaffTicketDetailPage component is not yet implemented.
// These tests are written spec-first (TDD) to document the expected behaviour
// and will be un-skipped once the component lands.

import { describe, it } from "vitest";

describe("StaffTicketDetailPage", () => {
  it.todo("renders full ticket detail: summary, requester, status, priority, attachments");
  it.todo("shows the public comments panel and allows staff to read them");
  it.todo("shows the internal notes panel (not visible to Requester role)");
  it.todo("allows IT Staff to add an internal note via the notes form");
  it.todo("allows IT Staff to update itPriority via a dropdown");
  it.todo("allows IT Staff to assign the ticket to a user");
  it.todo("allows IT Staff to unassign the ticket (set owner to null)");
  it.todo("shows allowed status transitions and rejects invalid ones");
  it.todo("displays a 404 message when the ticket does not exist");
  it.todo("shows 401 when session is missing and 403 when role is Requester");
});
