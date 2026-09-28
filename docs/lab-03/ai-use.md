# Lab 3 AI Use

## LLM Used

- **Specification phase:** GitHub Copilot as a documentation assistant. The
  student/team reviewed, corrected, and owns the final engineering decisions.
  No Lab 3 application feature was implemented by this documentation work.
- **Implementation + integration phases:** an agentic coding assistant
  (this integration branch was produced with Muse Spark via OpenCode; earlier
  Lab 3 implementation branches were produced with agentic coding assistance
  arranged by the student/team — the representative prompts below are
  summarized from each branch's brief and the merged artifacts, not quoted
  verbatim where the original wording is not on record).

## Selected Prompts (specification phase)

1. Inspect the existing TokTickIT repository and summarize the current Lab 2 architecture, routes, Prisma models, UI pages, tests, and temporary Development Requester selector without guessing APIs.
2. Transform the Lab 3 handout into a concise specification with numbered functional requirements, business rules, explicit exclusions, acceptance criteria, and a definition of done.
3. Design an authorization matrix for Requester, IT Staff, and Administrator while keeping Administrator user management separate from IT Staff ticket operations.
4. Design a local-lab authentication contract covering login, logout, current user, mandatory password change, password hashing, server-side sessions, expiration, CSRF, safe errors, and initial-password behavior.
5. Define a migration strategy that preserves existing Lab 2 Requesters, Tickets, Attachments, Categories, and Related Systems and removes the temporary selector only after ownership verification.
6. Write an exact REST API contract for authentication, authenticated Lab 2 continuation, IT Staff queue/detail operations, comments/notes, and minimalist Administrator user management.
7. Create a Zen Green UI specification for Login, Change Password, Requester regression, Staff Queue, Staff Detail, and User Management with responsive and accessibility states.
8. Create a TDD/Test DD plan with the handout's required first examples, planned test files, AC-to-test traceability, security tests, migration tests, and no false Pass results.
9. Review the documents for contradictions in role names, statuses, priorities, endpoint names, ownership terminology, initial-password behavior, and safe error handling.

## Selected Prompts (implementation + integration — what was asked → produced)

10. **Engineering contract → scaffolding + traceability docs.** Asked: turn
    the handout into `specification.md`/`api-spec.md`/`ui-spec.md`/`tests.md`
    with FR→AC and AC→test traceability. Produced: `docs/lab-03/*` and the
    stub test/E2E/artifact layout (PR #38 `feature/lab3-spec-tests`).
11. **Database migration.** Asked: add the `User`/role schema, ticket
    ownership relation, comments/notes models, the append-only
    `PENDING → WAITING_FOR_REQUESTER` migration, and idempotent seed data —
    without touching Lab 2 rows. Produced: `server/prisma/*` migrations +
    `seed.mjs` with the 5+4+1 user matrix and 8-status tickets (PR #40).
12. **Authentication.** Asked: session-cookie login/logout/me, mandatory
    password change with the BR-08 scrypt contract, safe generic failures,
    CSRF/origin guards, and Requester regression onto real identity.
    Produced: `server/src/modules/auth/*`, `LoginPage`/`ChangePasswordPage`,
    `ProtectedRoute`, removal of the dev selector (PR #42).
13. **Staff workflow.** Asked: IT Staff queue (search/filter/sort/paginate),
    ticket detail with claim/reassign, IT Priority, matrix-gated status
    changes, Public Comments + visually distinct Internal Notes, and the
    resolved-signal indicator. Produced: `server/src/modules/staff|notes/*`,
    `TicketQueuePage`/`StaffTicketDetailPage` (PR #44).
14. **Admin users.** Asked: minimalist Administrator list/search/role-filter,
    create/edit/activation, initial-password reset, and the BR-20/BR-21
    safeguards with no delete/bulk/import scope creep. Produced:
    `server/src/modules/users/*`, `UserManagementPage` + drawer/list (PR #46).
15. **This integration branch.** Asked: prove the increment works together —
    full regression, three E2E specs, 3-breakpoint screenshots, visual
    checklist, final `tests.md`/`ai-use.md`/`reviewer.md`/DoD updates, PR
    into `lab3-staging`. Produced: 23 E2E tests + `globalSetup` reseed,
    20 screenshots, `visual-checklist.md`, this file's update, and two
    narrowly-scoped fixes (Playwright `baseURL` → `localhost` for the
    CORS/CSRF origin contract; tablet table→cards CSS). No feature or
    functional logic was changed.
16. **UI alignment to the reference mockup.** Asked: read
    `docs/lab-03/ui-reference/toktickit-mockup.html` as canonical, extract
    its tokens/badges/tabs/avatar pieces into a shared stylesheet, and align
    every Lab 3 screen (plus Requester screens) without touching logic,
    routes, or assertions. Produced: `zen-green-tokens.css`, token
    reconciliation in `zen-green.css` (reference wins), avatar initials on
    comment/note headers, and a checklist recording the deliberate
    non-adoptions (tab strip, admin side-by-side layout, numbered pager)
    with rationale. Client suite still 61/61; screenshots re-captured
    post-alignment.

## My Reflection

The specification agent worked well for converting the handout into a
checkable contract (FR/BR/AC/API/UI/test links) before any code existed; the
coding branches were then constrained by those links instead of inventing
behavior. Where the spec was exact (scrypt parameters, transition matrix,
error envelopes, minimalist admin scope), implementation matched it with
little rework. Human intervention was still required at integration time:
the spec never pinned the E2E web origin, so the suite's `127.0.0.1` baseURL
contradicted the server's single-origin CORS/CSRF contract and every
authenticated call failed until the harness was aligned to `localhost` —
an environment assumption that only surfaces when frontend, backend, and
browser run together. Likewise the tablet queue clipping only appears when
real ticket numbers render at 834px; the component tests (jsdom, no media
queries) and desktop screenshots could not catch it, which is why the
per-breakpoint visual pass exists. The remaining human-owned step is running
the E2E suite once against a real seeded database and flipping the
`Not run*` rows in `tests.md` on evidence — this branch deliberately refuses
to claim Pass results it did not execute. The mockup-alignment pass showed
the same pattern in miniature: the agent could extract tokens and match
colors mechanically, but deciding what NOT to adopt (tab restructure, admin
side-by-side layout) required judging functionality-preservation against
visual fidelity — a call the prompt constrained explicitly, and the right
one, since either restructure would have broken E2E and component tests.
