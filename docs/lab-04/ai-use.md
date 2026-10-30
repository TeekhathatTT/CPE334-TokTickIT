# Lab 4 AI Use

## Scope and attribution

AI-assisted coding and review were used to harden the Lab 4 integration:
Playwright regression coverage, role/accessibility checks, screenshot capture,
and targeted UI accessibility fixes. The student/team remains responsible for
reviewing the implementation, evidence, and final decisions.

The original pasted prompt is not available verbatim in the retained
conversation context. This summary records the work that can be verified from
the branch; it does not claim to reproduce the original prompt text.

## Work items

1. Harden the Lab 4 E2E suite and preserve the Lab 2/3 regressions.
2. Verify Actions Taken authoring/read-only behavior, resolution gating,
   forbidden dashboard access, and stale-write conflict behavior in a browser.
3. Add Axe coverage and correct violations found on the covered screens.
4. Capture visual evidence for requester/staff dashboard states, responsive
   views, ticket workflows, and regression screens.
5. Update the test evidence and completion documentation using executed
   results, and leave reviewer/PR facts pending until they exist.

## Validation evidence

See [tests.md](./tests.md) for commands, results, and the known live
two-writer PostgreSQL race-test gap. Screenshot output is under
`../../artifacts/lab-04/screenshots/`.
