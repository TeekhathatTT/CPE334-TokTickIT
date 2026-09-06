# AI Use Documentation Lab 2

## 1. LLM Used

The project used **ChatGPT (OpenAI)** as an AI-assisted development and documentation tool during Lab 2.

AI was used to support:

* Understanding the Lab 2 requirements and acceptance criteria.
* Designing the database schema and API contract.
* Reviewing implementation against `specification.md`, `api-spec.md`, and `ui-spec.md`.
* Debugging TypeScript, Prisma, Express, React, and testing issues.
* Designing and improving unit, API, UI, and E2E tests.
* Reviewing Git branches, pull requests, and engineering workflow.
* Preparing project documentation and submission materials.

All generated suggestions were reviewed by the developer before being applied to the repository.

---

## 2. Selected Key Prompts

The following are representative key prompts used during the development of Lab 2.

| No. | Prompt / Task                                                                                                                                      | Purpose                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | "ช่วยออกแบบ specification สำหรับ Lab 2 ของ TokTickIT โดยให้มี Functional Requirements, Business Rules, Acceptance Criteria และ Definition of Done" | Define the Sprint 2 engineering contract.                      |
| 2   | "ตรวจสอบ Prisma schema ตาม docs/lab-02/specification.md Section 7 ว่ามี model, relationship, enum และ nullability ครบหรือไม่"                      | Validate the database design against the specification.        |
| 3   | "ตรวจสอบ API contract ของ Requester, Ticket และ Attachment ให้ตรงกับ specification และกำหนด request/response/error status"                         | Design and verify the backend API contract.                    |
| 4   | "ตรวจสอบ test ที่ใช้ vi.mock() แล้ว Prisma mock ไม่ทำงาน ควรแก้ import และ mock path อย่างไร"                                                      | Debug API test mocking and prevent unintended database access. |
| 5   | "ตรวจสอบ PR และเขียน review ว่าการ implement Ticket และ Attachment ตรงกับ api-spec.md หรือไม่"                                                     | Review backend implementation against the API contract.        |
| 6   | "ตรวจสอบ frontend Lab 2 ว่าตรงกับ ui-spec.md ทั้ง Requester Selection, Create Ticket, My Tickets, Ticket Detail และ Attachment หรือไม่"            | Review frontend implementation against the UI specification.   |
| 7   | "ช่วยวาง test plan สำหรับ Lab 2 ให้ครอบคลุม unit, API, UI, responsive และ E2E และทำ AC-to-test traceability"                                       | Build the test plan and traceability matrix.                   |
| 8   | "ช่วยตรวจสอบว่า Git branch และ PR ของ Lab 2 ควร merge จาก feature ไป lab2-staging แล้วค่อย main หรือไม่"                                           | Validate the engineering workflow.                             |
| 9   | "ช่วยเขียน reviewer.md จาก PR และ review comments ที่มีอยู่จริงใน GitHub"                                                                          | Document peer-review evidence for submission.                  |

---

## 3. How AI Was Used

AI was primarily used as a **development assistant and reviewer**, rather than as a replacement for implementation or verification.

The development process was:

1. Read the Lab 2 specification and identify requirements.
2. Use AI to help break requirements into implementation tasks.
3. Implement the changes in the appropriate feature branch.
4. Run tests and inspect the actual application behavior.
5. Use AI to identify possible inconsistencies with the specification.
6. Submit changes through GitHub Pull Requests.
7. Receive peer review from teammates.
8. Apply necessary fixes.
9. Re-run tests and verify the implementation.
10. Record the review and AI usage as project documentation.

---

## 4. Reflection

AI was used as an engineering assistant throughout the Lab 2 development process. It helped analyze requirements, propose implementation approaches, generate and review tests, and identify inconsistencies between the specification and implementation. However, the final implementation, test results, and design decisions were reviewed by the team before being accepted.
