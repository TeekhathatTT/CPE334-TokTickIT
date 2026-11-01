# Lab 4 Peer Review Record

## 1. Reviewers

| Reviewer | GitHub Username | Role | PRs reviewed |
|---|---|---|---|
| Chessuker | `Chessuker` | Peer Reviewer | #51, #56, #57 |
| Khwanklao | `Khwanklao` | Peer Reviewer | #58, #59 |

---

## 2. Pull Request Review Summary

| PR | Branch | Target | Issue | Reviewer | Review Result | Status |
|---|---|---|---|---|---|---|
| [#51](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/51) | `feature/lab4-spec-tests` | `lab4-staging` | #50 | Chessuker | Changes Requested (2 rounds) → Approved | Merged 2026-10-13 |
| [#56](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/56) | `feature/lab4-db-migration` | `lab4-staging` | #52 | Chessuker | Changes Requested (+ 1 follow-up item) → Approved | Merged 2026-10-16 |
| [#57](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/57) | `feature/lab4-actions-taken-workflow` | `lab4-staging` | #53 | Chessuker | Changes Requested (2 rounds) → Approved | Merged 2026-10-27 |
| [#58](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/58) | `feature/lab4-dashboards` | `lab4-staging` | #54 | Khwanklao | Changes Requested (2 rounds) → Approved | Merged 2026-10-29 |
| [#59](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/59) | `feature/lab4-hardening` | `lab4-staging` | #55 | Khwanklao | Changes Requested → Approved | Merged 2026-10-30 |
| TODO: release PR link | `lab4-staging` | `main` | — | TODO | TODO | TODO |

---

## 3. PR #51 — Lab 4 Engineering Contract

**PR:** [Feature/1 Lab 4 add lab-04 docs](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/51)
**Reviewer:** `Chessuker`

### Initial Review (2026-10-09)

**Result:** Changes Requested

The reviewer found the spec strong overall (the gate fits in one query, error codes are clearly separated, FR→AC→test tables are complete) and listed six must-fix contradictions or gaps:

1. **Gate atomicity** — under READ COMMITTED an `EXISTS` check followed by an `UPDATE` does not stop a concurrent follow-up insert; a locking mechanism (`SELECT … FOR UPDATE`) and a test row for the race were required.
2. **PATCH rules contradicted each other** — stored-row vs merged-row evaluation order, mixed-body authorization, and the `true → false` / `false → true` flips on resolved rows were undefined.
3. **Administrator had API power but no UI surface**, and the dashboard cards linked to a queue Administrators cannot open (dead UI).
4. **Card counts did not equal their drill-down results** (e.g. `recentlyResolved` vs an all-time filter).
5. **`INVALID_TRANSITION`** changed Lab 3 behavior while claiming Lab 3 was unchanged.
6. **Time-dependent seed data** would make dashboard tests flaky; expected values were not written out.

Five optional items covered strict rejection of client-supplied fields, the `createdAt` alias, `pendingFollowUpCount` on page load, Requester visibility of follow-up notes, and the hand-written `CHECK` constraint.

### Developer Response

Fixed in commit `e21e30e` (FOR UPDATE locking, PATCH stored/merged semantics, admin API-only UI, exact drill-downs, frozen fixtures). Reply on the PR: "แก้แล้วครับ".

### Second Review (2026-10-13)

**Result:** Changes Requested (small)

Four remaining text fixes: T4 re-armed the gate on any edit of a resolved row (flips must apply only when `followUpRequired` is explicitly in the body); a `null` loophole in mixed-body authorization (decide by key presence); SQL `now()` bounds are not frozen by JS fake timers (compute bounds in app code); and the version check was not a real lost-update guard on assignment/priority/non-gate status writes (lock every ticket write). Three optional items were noted.

### Developer Response

Fixed in commit `d3cd050` (explicit-flip T1–T4, key-presence authorization, app-clock bounds, `FOR UPDATE` on every ticket write).

### Final Review

Approved (2026-10-13) and merged as `d3a457c`.

**Final result:** Changes Requested → Fixed → Changes Requested → Fixed → Approved → Merged.

---

## 4. PR #56 — Database Migration

**PR:** [Feature/2 Lab 4 database migration](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/56)
**Reviewer:** `Chessuker`

### Initial Review (2026-10-15)

**Result:** Changes Requested (minor). The schema and migration were judged solid; the fixes were in the recovery doc and seed.

Must fix:

1. The rollback SQL was not safe to re-run (`ALTER TABLE … DROP CONSTRAINT` fails once the table is gone; use `IF EXISTS` / rely on `DROP TABLE IF EXISTS`).
2. The baseline step in the recovery doc ran this branch's seed before the table existed, producing a half-seeded baseline; it must run from the `lab4-staging` base commit.
3. `./backups/` was not in `.gitignore`, so a `pg_dump` containing password hashes could be committed.

Optional items: a reproducible checksum query with `ORDER BY id`; seed idempotency keyed on an editable field (`description`) instead of immutable fields; seeded actions dated before their tickets existed; commit the rollback script as a file; align the restore section with the evidence and add `ON_ERROR_STOP` / `--single-transaction`.

### Developer Response

Fixed in commit `50ab44b` (rerunnable rollback, baseline seed, `.gitignore`, idempotent seed). Reply: "แก้แล้วครับ แก้ optional ให้ด้วย".

### Follow-up Comment (2026-10-15)

The reviewer found one more item to fix before merge: the seed's update branch overwrote `createdAt` on existing Lab 3 tickets, conflicting with AC-12 ("no Lab 1–3 row altered"). Fix: keep `createdAt` in the create branch only. Fixed in commit `2fa5aca`.

### Final Review

Approved (2026-10-16) — "Approve ครับอ้าย แก้ครบละ" — and merged as `5689bc6`.

**Final result:** Changes Requested → Fixed → Follow-up → Fixed → Approved → Merged.

---

## 5. PR #57 — Actions Taken Workflow

**PR:** [Feature/3 Lab 4 Actions Taken Workflow](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/57)
**Reviewer:** `Chessuker`

### Initial Review (2026-10-21)

**Result:** Changes Requested

The reviewer checked out `73f4f61`, confirmed `tsc --noEmit` was clean and that all suites passed locally (server 173/173, client 75/75), and found the **server side matched the spec** (every write inside `withTicketLock` with consistent lock order; status PATCH order; BR-06 evaluation order; session-derived identity; foreign-ticket `404`).

Four client must-fix items against `ui-spec.md`:

1. No CSS for the new Actions Taken UI, so an action card looked identical to a Public Comment and badges rendered as plain text.
2. Thread order was wrong (Actions Taken rendered above the other threads).
3. "Keep my text" on an edit conflict could never succeed (the stale `expectedUpdatedAt` was never refreshed).
4. Authors could not edit a row after a `true → false` flip (validation error hidden, Save did nothing).

Four optional items: "Reload ticket" replayed the stale change silently; a stale list after resolve conflicts; a disabled submit with no visible reason; the edit form lacked the attachment-notes field and counters.

### Developer Response

Reply: "รับเรื่องครับ". Fixed in commit `49a2784` (distinct thread styling, fixed thread order, recoverable version conflicts, separate "Retry my change", edit parity).

### Second Review (2026-10-21)

**Result:** Changes Requested (one new issue). All 8 earlier items verified resolved (client 84/84). New issue: a failed "Retry my change" was silent because the error was rendered only inside the conflict panel, and the stale Retry button stayed. Fixed in commit `d28748b`.

### Final Review (2026-10-27)

Approved ("APPROVE ครับอ้าย"). The reviewer re-ran the suites himself rather than relying on reported counts — server 173/173, client 85/85, `tsc --noEmit` clean on both — noted there is no CI workflow so local runs are the evidence, and traced BR-06, BR-07 and T1–T4 against the code. Merged as `3441cd6`.

**Final result:** Changes Requested → Fixed → Changes Requested → Fixed → Approved → Merged.

---

## 6. PR #58 — Requester and IT Staff Dashboards

**PR:** [Feature/4 Lab 4 Requester and IT Staff dashboards with drill-down](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/58)
**Reviewer:** `Khwanklao`

### Initial Review (2026-10-28)

**Result:** Changes Requested — "Not Ready to Merge". The first push was an initial implementation, and the reviewer found it did not yet meet the spec:

1. Frontend would not compile/run (malformed JSX, duplicate `currentView` declaration, stray `\n` in `App.tsx`, role-based rendering letting Administrators see a queue button they cannot use).
2. Dashboard logic did not match the spec (`resolvedPendingClose`, `pendingFollowUp` vs `pendingFollowUpTicketIds`, date boundaries, data isolation).
3. Drill-down filters and navigation were incomplete.
4. Several test files were placeholders without real assertions.
5. `verify-dashboard-metrics.mjs` was a mock rather than a real SQL comparison.
6. A full validation pass (build, suites, SQL verification, performance smoke, role checks) was required before re-review.

### Developer Response

Fixed in commits `15ce91b`, `f778d17`, and `8613a33` (dashboard logic, filters/navigation, real API and component tests, SQL verification script).

### Second Review (2026-10-28)

**Result:** Changes Requested. The reviewer acknowledged the move from a placeholder draft to "a test skeleton and main logic" but said the work still did not fully meet the Lab 4 requirements and repeated the six required areas. Further work landed in commit `ad771ec` (E2E coverage, screenshots, docs).

### Final Review (2026-10-29)

Approved — "แก้ไขถูกต้องครบทั้ง 6 ข้อแล้วดีมากครับ" — and merged as `07d63e4`.

**Final result:** Changes Requested → Fixed → Changes Requested → Fixed → Approved → Merged.

---

## 7. PR #59 — Final Hardening

**PR:** [Feature/5 Lab 4 harden e2e and accessibility coverage](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/59)
**Reviewer:** `Khwanklao`

### Initial Review (2026-10-29)

**Result:** Changes Requested — "Implemented and Largely Verified — Not Yet Ready to Close". Implementation, tests, README, `tests.md`, DoD, and `visual-checklist.md` were acknowledged. Items raised:

- 2.1 `reviewer.md` still contained `TODO` entries.
- 2.2 Confirm a release PR to `main`, its approval, and results on `main`.
- 2.3 Perform a fresh-clone verification with a login for each of the three roles.
- 2.4 Confirm all Lab 4 Issues are Done on the Kanban board.
- 2.5 Complete the manual accessibility/visual review in `visual-checklist.md`.
- 2.6 Decide whether the live two-writer PostgreSQL race gap is acceptable as a documented residual.

### Developer Response

- 2.2: this PR is the E2E branch into `lab4-staging`; the branch that merges to `main` comes after it, so it cannot be done here.
- 2.3: not required by the specification.
- 2.4: Kanban board updated.
- 2.6: follow the Issue's acceptance criteria (documented as a known residual).
- 2.1 and 2.5: to be completed when the work moves to `main`.

### Final Review (2026-10-30)

The reviewer agreed some items could be completed later and some were outside the specification's scope, then approved ("Excellent, everything is finished in this issue") and merged as `f51f7d9`.

**Final result:** Changes Requested → Responded → Approved → Merged.

---

## 8. Items Carried Forward to the Release to `main`

These were raised in PR #59 and deliberately deferred by the developer with the reviewer's agreement:

| Item | Status |
|---|---|
| Release PR `lab4-staging → main`, approval, and test results recorded from `main` | To do at release |
| Manual visual and accessibility review (typography, contrast, spacing, responsive layout) in `visual-checklist.md` | To do at release |
| Live two-writer PostgreSQL race test | Documented known residual in `tests.md` (contract tests use mocked Prisma) |
| Fresh-clone verification | Not required by the specification; README steps remain the reference |

---

## 9. Review Process Reflection

Every Lab 4 PR needed at least one Changes-Requested round before merging, and four of the five needed two. The reviews were most valuable where they caught problems the author and the coding agent could not see alone:

- **Specification (#51):** reviewers found concurrency and authorization loopholes in the written contract before any code existed (the `null` key-presence loophole, T4 re-arming, SQL clock vs fake timers), which is why the later server review in #57 found the server matched the spec with no changes.
- **Migration (#56):** the review caught that the recovery procedure was not actually re-runnable and that the seed could rewrite Lab 3 rows, both of which would have broken the "Lab 1–3 untouched" guarantee.
- **Workflow (#57):** UI-spec conformance (thread styling/order) and recoverable-conflict behavior were found by reading the code against `ui-spec.md`; the reviewer also re-ran the test suites independently.
- **Dashboards (#58):** the reviewer rejected a first push that did not compile and contained placeholder tests, which forced real assertions and a real SQL verification script.
- **Hardening (#59):** the review separated what must block the merge from what belongs to the release step, and recorded the remaining gaps instead of hiding them.

---

## 10. Review Evidence

All review evidence can be verified from the GitHub Pull Requests:

- PR #51 — Lab 4 engineering contract
- PR #56 — Lab 4 database migration
- PR #57 — Actions Taken workflow
- PR #58 — Role dashboards
- PR #59 — Final hardening

Repository: <https://github.com/TeekhathatTT/CPE334-TokTickIT/pulls>
