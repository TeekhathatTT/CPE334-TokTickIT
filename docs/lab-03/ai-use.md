# Lab 3 AI Use

## LLM Used

GitHub Copilot was used as a documentation assistant. The student/team reviewed, corrected, and owns the final engineering decisions. No Lab 3 application feature was implemented by this documentation work.

## Selected Prompts

1. Inspect the existing TokTickIT repository and summarize the current Lab 2 architecture, routes, Prisma models, UI pages, tests, and temporary Development Requester selector without guessing APIs.
2. Transform the Lab 3 handout into a concise specification with numbered functional requirements, business rules, explicit exclusions, acceptance criteria, and a definition of done.
3. Design an authorization matrix for Requester, IT Staff, and Administrator while keeping Administrator user management separate from IT Staff ticket operations.
4. Design a local-lab authentication contract covering login, logout, current user, mandatory password change, password hashing, server-side sessions, expiration, CSRF, safe errors, and initial-password behavior.
5. Define a migration strategy that preserves existing Lab 2 Requesters, Tickets, Attachments, Categories, and Related Systems and removes the temporary selector only after ownership verification.
6. Write an exact REST API contract for authentication, authenticated Lab 2 continuation, IT Staff queue/detail operations, comments/notes, and minimalist Administrator user management.
7. Create a Zen Green UI specification for Login, Change Password, Requester regression, Staff Queue, Staff Detail, and User Management with responsive and accessibility states.
8. Create a TDD/Test DD plan with the handout's required first examples, planned test files, AC-to-test traceability, security tests, migration tests, and no false Pass results.
9. Review the documents for contradictions in role names, statuses, priorities, endpoint names, ownership terminology, initial-password behavior, and safe error handling.

## My Reflection

The specification agent was used to inspect the existing Lab 2 implementation and turn the handout into a contract before coding. The later coding agent will be constrained by the FR/BR/API/UI/AC/test links rather than inventing behavior while implementing. AI output was reviewed against the actual Prisma schema, Express routes, React pages, Lab 2 docs, and tests. The student/team decided the session-cookie approach, the explicit Administrator/IT Staff separation, the complete status transition matrix, the migration order, the local-only initial-password policy, and the required test coverage. This branch intentionally contains documentation only.
