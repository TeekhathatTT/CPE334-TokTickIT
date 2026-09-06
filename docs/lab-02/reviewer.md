# Peer Review Record Lab 2

## 1. Reviewers

| Reviewer  | GitHub Username | Role          |
| --------- | --------------- | ------------- |
| Chessuker | `Chessuker`     | Peer Reviewer |
| Khwanklao | `Khwanklao`     | Peer Reviewer |

---

## 2. Pull Request Review Summary

| PR                                                                 | Branch                   | Reviewer  | Review Result                | Status |
| ------------------------------------------------------------------ | ------------------------ | --------- | ---------------------------- | ------ |
| [PR #19](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/19) | `feature/spec-tests`     | Chessuker | Approved                     | Merged |
| [PR #20](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/20) | `feature/lab2-requester` | Chessuker | Changes Requested → Approved | Merged |
| [PR #23](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/23) | `feature/lab2-ticket`    | Khwanklao | Changes Requested → Resolved | Merged |
| [PR #25](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/25) | `feature/lab2-frontend`  | Khwanklao | Changes Requested            | Merged   |

---

## 3. PR #19 Lab 2 Engineering Contract

**PR:** [Feature: add lab-02 docs](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/19)

**Reviewer:** `Chessuker`

**Review result:** Approved

### Review Feedback

The reviewer confirmed that the Sprint Goal, Functional Requirements, Business Rules, Acceptance Criteria, API contract, UI design, and test plan were well integrated and suitable for guiding the implementation.

The reviewer requested that peer-review feedback be recorded before merging.

### Developer Response

The review feedback was recorded in `reviewer.md` and the PR was subsequently approved and merged.

The PR established the Lab 2 engineering contract containing:

* `specification.md`
* `tests.md`
* `api-spec.md`
* `ui-spec.md`

The review comment and approval are recorded in the GitHub PR history.

---

## 4. PR #20 Development Requester

**PR:** [Feature: lab 2 add development requester](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/20)

**Reviewer:** `Chessuker`

### Initial Review

**Result:** Changes Requested

The reviewer identified an issue with the Prisma mock in the Requester API test.

The test imported the wrong application/module path and the Prisma mock was therefore not applied correctly. This could cause the test to access the real database instead of the mocked Prisma implementation.

### Additional Review Feedback

The reviewer also requested checking:

1. `vi.mock()` ordering in `requesters.test.ts`.
2. Whether the Prisma 5 → 6 upgrade was intentional.
3. Whether CI used a compatible Node version.
4. Whether migrations and seed operations worked correctly in CI.

Items 2–4 were explicitly marked optional.

### Developer Response

The developer fixed the required Prisma mock issue and replied:

> "แก้แล้ว แต่ตรง optional ไม่ทำ"

The optional items were intentionally not changed because they were not required for the current task.

### Final Review

The reviewer subsequently approved the PR.

**Final result:** Approved → Merged.

---

## 5. PR #23 Ticket and Attachment Management

**PR:** [Feature: lab2-ticket — add ticket and attachment management](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/23)

**Reviewer:** `Khwanklao`

### Initial Review

**Result:** Changes Requested

The reviewer confirmed that the implementation, database, tests, and requirements were generally correct, but identified three API contract issues:

1. `GET /api/categories` needed to return:

   ```json
   {
     "data": [...]
   }
   ```

2. Category API errors needed to follow the common error response shape:

   ```json
   {
     "error": {
       "code": "...",
       "message": "..."
     }
   }
   ```

3. `POST /api/tickets` needed to support partial attachment upload success according to BR-16. A failed attachment should not cause the entire Ticket creation to fail, and the response should identify the failed upload using `uploadFailed` and `reason`.

### Developer Response

The developer replied:

> "แก้แล้ว bro"

The requested API contract corrections were implemented.

### Final Review

The reviewer responded:

> "good job"

The PR was then merged.

**Final result:** Changes Requested → Fixed → Merged.

---

## 6. PR #25 Lab 2 Frontend

**PR:** [Feature: Implement the Lab 2 frontend](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/25)

**Reviewer:** `Khwanklao`

### Review Result

**Changes Requested**

The reviewer confirmed that several foundational parts were implemented correctly, including:

* Type definitions.
* Application shell.
* Main pages.
* AttachmentPicker.
* Zen Green CSS.
* Initial frontend tests.

However, several important areas were identified as incomplete or inconsistent with the Lab 2 specification.

### Critical API / Security Issues

The reviewer requested:

* Send `x-requester-id` through the HTTP header rather than a query parameter.
* Centralize API calls in `client/src/api.ts`.
* Ensure `GET /api/tickets` sends the required query parameters.
* Use API pagination metadata.
* Distinguish Empty and No Results states.
* Display pagination information.
* Handle partial attachment upload failures without incorrectly failing Ticket creation.
* Display the failed attachment and failure reason to the user.

### UI / UX Issues

The review also identified improvements required for:

* AttachmentPicker states.
* Required and read-only field styling.
* Keyboard focus and accessibility.
* AppShell navigation.
* Change Requester action.
* Breadcrumbs.
* Mobile navigation.
* My Tickets sorting and filtering.
* Clear Filters.
* Create Ticket action.
* Priority and Status badges.
* Mobile card layout.
* Ticket Detail attachment actions.
* Remove Attachment confirmation and reason validation.
* Removed attachment display.
* Five-attachment limit handling.

**Final result:** Changes Requested → Merged.

---

## 7. Review Process Reflection

Peer review was useful for identifying issues that were not always obvious from the implementation alone.

The most important review findings were related to maintaining consistency between:

* Requirements and implementation.
* API contract and actual responses.
* Frontend API calls and backend ownership rules.
* UI specification and actual component behavior.
* Tests and the actual application architecture.

The review process also helped identify the difference between required fixes and optional improvements. For example, in PR #20, the Prisma mock issue was fixed while optional CI-related checks were not changed.

For PR #23, the review directly identified API contract mismatches and these were fixed before the PR was merged.

For PR #25, the review provides a checklist of remaining frontend work that should be addressed before the PR is considered complete.

---

## 8. Review Evidence

All review evidence can be verified from the GitHub Pull Requests:

* PR #19 — Lab 2 documentation and engineering contract.
* PR #20 — Development Requester implementation.
* PR #23 — Ticket and Attachment backend implementation.
* PR #25 — Lab 2 frontend implementation.

Repository:

https://github.com/TeekhathatTT/CPE334-TokTickIT/pulls
