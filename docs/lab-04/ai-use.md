# AI Use Documentation Lab 4

## 1. LLM Used

| Role | Tool | Evidence |
|---|---|---|
| Specification and prompt design | Claude (Anthropic) in claude.ai | Per-branch task prompts and the release PR description were drafted in a Claude conversation |
| Coding agent (hardening branch) | GitHub Copilot CLI | `Co-authored-by: Copilot` trailer on commit `df9926a` (PR #59) |
| Coding agent (spec, migration, workflow, dashboards branches) | Claude, GPT | |

AI was used as an engineering assistant. All generated work was reviewed by a teammate through a Pull Request before merging (see `reviewer.md`), and every test result recorded in `tests.md` comes from a command that was actually executed.

---

## 2. Selected Key Prompts

The prompts were written as one task prompt per branch. Each states the branch scope, what to read first, the rules to follow, a self-check, and the PR to open. They are condensed below.

| No. | Prompt / Task | Purpose | Resulting PR |
|---|---|---|---|
| 1 | "Read the Lab 3 spec (BR-15), schema, and the 8-state transition matrix, then write the Lab 4 engineering contract (FR/BR/AC, API, UI, tests). Resolve the ambiguities explicitly: Actions Taken edit policy, resolution-gate condition, concurrency mechanism, Administrator scope, dashboard metric queries." | Engineering contract before any code | #51 |
| 2 | "Add the `ActionTaken` schema as an additive migration, write a rollback and restore procedure and test it, and extend the seed idempotently for 0/1/many actions across all statuses and for zero/non-zero dashboard metrics." | Database foundation | #56 |
| 3 | "Implement Actions Taken create/list/edit/resolve, enforce the resolution gate on every edge into Resolved inside the status transaction, add `expectedUpdatedAt` → `409` stale-write handling, and the staff and read-only Requester UI. Use `tx` inside transactions and test against live Postgres." | Workflow, gate, concurrency | #57 |
| 4 | "Build the Requester and IT Staff dashboards with backend-computed metrics, drill-downs that reuse existing list filters, and a script that compares every metric against raw SQL." | Dashboards and metric evidence | #58 |
| 5 | "Prove the whole product works together: real E2E specs, console-error checks, duplicate-click safety, accessibility checks, screenshots at 375/834/1280 px, and documentation filled only from executed results. Do not merge to `main` locally." | Final hardening and evidence | #59 |
| 6 | "Apply this review feedback" (given once per review round with the reviewer's findings pasted in), producing the commits `e21e30e`, `d3cd050`, `50ab44b`, `2fa5aca`, `49a2784`, `d28748b`, `15ce91b`, `f778d17`, `8613a33`. | Resolve review findings | #51, #56, #57, #58 |
| 7 | "Summarize everything done in Lab 4 as a release PR description from the actual repository state; flag anything unverified and list the author checklist." | Release PR description | `lab4-staging → main` |
| 8 | "Compile `reviewer.md` and `ai-use.md` from the real PR threads; do not invent reviewers, comments, or prompts." | Evidence documents | this PR set |

---

## 3. How AI Was Used

AI acted as a drafting and review assistant, not as a replacement for verification:

1. Write a branch prompt grounded in the real repository (schema, existing modules, Lab 3 rules).
2. Run the coding agent on that branch.
3. Run the tests and inspect the real behavior, including against a live Postgres database.
4. Open a Pull Request and receive peer review.
5. Feed the reviewer's findings back to the agent for fixes, then re-run the tests.
6. Record results and review evidence in the docs only after they exist.

---

## 4. My Reflection

Writing the contract first paid off: the written Lab 4 spec went through two review rounds that found real loopholes (an atomicity claim that did not hold under READ COMMITTED, a `null` key that bypassed authorization, SQL `now()` that fake timers cannot freeze), and by the time the server code was reviewed in PR #57 it matched the spec without server changes. The coding agent worked well when the spec was exact.

The agent's output still needed human checking. The first dashboards push (PR #58) did not compile and its tests were placeholders, and review pushed it to real assertions and a real SQL verification script. During the workflow branch, a transaction helper called `prisma.$transaction` detached from the client and returned `500` on every ticket write against live Postgres, a bug the mocked tests could not detect; it was found by running against a real database, the same lesson as Lab 3. The team also made the main design decisions itself (Actions Taken as an edit-controlled log with explicit follow-up resolution, Administrator limited to aggregate read-only dashboard access) rather than accepting agent defaults.

Known limits are stated openly in `tests.md`: the live two-writer race is covered by design and mocked contract tests, not by an end-to-end race test, and the original text of some earlier prompts was not saved verbatim, so the table above is a condensed account.
