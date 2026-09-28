# Peer Review Record Lab 3

## 1. Reviewers

| Reviewer  | GitHub Username | Role          |
| --------- | --------------- | ------------- |
| Chessuker | `Chessuker`     | Peer Reviewer |
| Khwanklao | `Khwanklao`     | Peer Reviewer |

All review evidence below is verifiable from the linked GitHub Pull Requests
(review bodies quoted/summarized; states and dates from the PR review API).

---

## 2. Pull Request Review Summary

| PR                                                                  | Branch                        | Reviewer  | Review Result                | Status |
| ------------------------------------------------------------------- | ----------------------------- | --------- | ---------------------------- | ------ |
| [PR #38](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/38)  | `feature/lab3-spec-tests`     | Khwanklao | Changes Requested → Approved | Merged |
| [PR #40](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/40)  | `feature/lab3-db-migration`   | Chessuker | Changes Requested → Approved | Merged |
| [PR #42](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/42)  | `feature/lab3-auth`           | Chessuker | Changes Requested → Approved | Merged |
| [PR #44](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/44)  | `feature/lab3-staff-workflow` | Chessuker | Changes Requested → Approved | Merged |
| [PR #46](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/46)  | `feature/lab3-admin-users`    | Chessuker | Changes Requested → Approved | Merged |
| [PR #48](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/48)   | `feature/lab3-e2e-integration` | Chessuker | Changes Requested → Approved | Merged |

---

## 3. PR #38 Lab 3 Engineering Contract

**PR:** [Lab 3 spec/tests contract](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/38)
(`feature/lab3-spec-tests` → `lab3-staging`, merged 2026-09-24)

**Reviewer:** `Khwanklao`

### Initial Review (2026-09-24)

**Result:** Changes Requested

The reviewer required five documentation corrections before merge:

1. Pin the exact scrypt cost parameters (`N`, `r`, `p`, key length) and the
   salt/hash storage format in `specification.md`.
2. Put Related FR/BR plus error responses/status codes under each endpoint in
   `api-spec.md` instead of grouped at the end; split Lab 2 APIs per endpoint.
3. Add an FR → AC traceability table (Self-Check: every FR maps to ≥1 AC).
4. Reconcile the Administrator ticket-owner contradiction across BR-11, BR-16
   and `api-spec.md`.
5. Decide `PENDING`: legacy-only with a ban, or an explicit migration mapping
   `PENDING → WAITING_FOR_REQUESTER` for a strict 8-value enum.

### Developer Response

Fixed in `6bec839` ("docs: clarify scrypt params, per-endpoint FR/BR/errors,
FR-AC traceability, admin owner scope, PENDING migration"), which addresses
all five items point for point.

### Final Review (2026-09-24)

> "เเก้ไขครบทั้ง 5 ข้อเรียบร้อย ดีมาก"

**Final result:** Approved → Merged.

---

## 4. PR #40 Lab 3 Database Migration

**PR:** [Lab 3 DB migration](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/40)
(`feature/lab3-db-migration` → `lab3-staging`, merged 2026-09-25)

**Reviewer:** `Chessuker`

### Initial Reviews (2026-09-25)

**Result:** Changes Requested (two rounds)

Round 1 — two blocking code concerns:

1. The seed deleted existing `PublicComment`/`InternalNote` rows on rerun,
   erasing authored history against the append-only rule — use deterministic
   IDs or idempotent upsert/duplicate checks instead.
2. Dropping `PENDING` breaks Lab 2 consumers — verify/update every API, UI,
   validation, and regression-test reference, or document that the migration
   applies only with the Lab 3 changes.

Round 2 — one traceability concern: `docs/lab-03/specification.md` was not in
the repo, so `Requester → User`, `PENDING → WAITING_FOR_REQUESTER`, and
`ticketOwnerId` could not be checked against requirements — add the spec or
summarize the supported requirements in the PR description, and confirm all
`PENDING` API/UI usages move together.

### Developer Response

Addressed in `fe7b18f` ("update db"): the merged `seed.mjs` is append-only
(`ensurePublicComment`/`ensureInternalNote` existence checks, never delete),
the migration backfills `PENDING → WAITING_FOR_REQUESTER` before dropping the
value, and `specification.md` §8 documents the reference strategy and the
8-value enum.

### Final Review (2026-09-25)

Approved (empty-body approval after the fixes).

**Final result:** Approved → Merged.

---

## 5. PR #42 Lab 3 Authentication

**PR:** [Lab 3 authentication](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/42)
(`feature/lab3-auth` → `lab3-staging`, merged 2026-09-26)

**Reviewer:** `Chessuker`

### Initial Review (2026-09-26)

**Result:** Changes Requested

Required before merge (items 1–4):

1. A newly created Requester (no `legacyRequesterId`) gets HTTP 500 on ticket
   creation because `Ticket.requesterId` is non-nullable — provision the
   `Requester` row (or equivalent) instead of failing silently.
2. No Origin/CSRF check despite `api-spec.md` §0/§7 — add middleware matching
   `Origin` against `CLIENT_URL` for POST/PATCH/PUT/DELETE (CORS alone does
   not stop cross-origin form POSTs).
3. Password change keeps other sessions alive — destroy all of the user's
   sessions (`destroySessionsForUser`) so a holder of the temporary password
   loses access.
4. PR description still contains template placeholders — fill in real results.

Optional (items 5–9): timing-oracle hardening on login, 401/PASSWORD_CHANGE
session-expiry handling in `AuthProvider`, deduplicating session loaders,
hiding the resolved-signal button on CLOSED/CANCELLED, and the legacy-id `OR`
ownership edge case.

### Developer Response

Fixed in `16aa8b6` ("fix(lab3): provision Requester on ticket create, add
Origin CSRF guard, invalidate all sessions on password change"), covering
items 1–4 exactly.

### Final Review (2026-09-26)

> "Re-review หลัง commit 16aa8b6 ข้อ 1–4 แก้ครบแล้วครับ"

Approved, with follow-up suggestions (tests for the three fixes, documenting
the CSRF guard/`409 REQUESTER_PROFILE_MISSING` for Staff/Admin branches).

**Final result:** Approved → Merged.

---

## 6. PR #44 Lab 3 Staff Workflow

**PR:** [Lab 3 staff workflow](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/44)
(`feature/lab3-staff-workflow` → `lab3-staging`, merged 2026-09-26)

**Reviewer:** `Chessuker`

### Initial Review (2026-09-26)

**Result:** Changes Requested

Required before merge (items 1–3):

1. `itPriority` is never initialized from `requestedPriority` (BR-12) — new
   tickets all carry `null`; default it at creation.
2. Reassignment is a free-text user-ID field, but ui-spec §6 requires
   selecting active IT Staff — since `api-spec` has no staff-directory
   endpoint, either add one (e.g. `GET /api/staff/users`) or record the spec
   gap explicitly.
3. PR description contradicts the code (ADMINISTRATOR allowed as owner,
   `PATCH .../owner`, `/api/tickets/:id/notes`, "My Queue") — correct the
   description to match the implementation.

Optional (items 4–6): status-race hardening, clearing the resolved flag on
REOPENED, and Administrator-403 tests.

### Developer Response

Fixed in `b3951a5` ("fix(lab3): default itPriority from requestedPriority;
staff owner directory + select (review fixes)"): creation defaults
`itPriority`, reassignment becomes an active-IT-Staff dropdown backed by the
new `GET /api/staff/users`, with server + client tests.

### Final Review (2026-09-26)

> "ข้อ 1–3 แก้ครบแล้วครับ"

Approved.

**Final result:** Approved → Merged.

---

## 7. PR #46 Lab 3 Administrator User Management

**PR:** [Feature/5 Lab 3 Administrator User Management](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/46)
(`feature/lab3-admin-users` → `lab3-staging`, merged 2026-09-27 by `Chessuker`)

**Reviewer:** `Chessuker`

### Initial Review (2026-09-26)

**Result:** Changes Requested

Required before merge (items 1–2):

1. Search input loses focus on every keystroke — the search term sits in the
   loader dependency, so each character sets full-page `Loading users…` and
   unmounts the input; stale responses can also overwrite newer ones.
   Suggested: loading indicator scoped to the table + ~300ms debounce +
   stale-response guard.
2. Demoting/deactivating an IT Staff member leaves their owned tickets
   pointing at an ineligible owner (BR-11) — unassign in the same transaction
   or return 409 while tickets remain (coordinate with the Staff branch).

Optional (items 3–5): serializable last-admin guard, P2002 → 409 on
concurrent duplicate email, and removing the extra `reset-password` alias /
`password` fields beyond `initial-password`.

### Developer Response

Author replied:

> "โอปอเราแก้แล้ว"

Fixed in `63fed61` ("fix(lab3): pre-merge review fixes for admin users"):
debounced search with first-load-only spinner and stale-response guard, plus
transactional unassign of tickets when an owner loses eligibility. The merged
`UserManagementPage.tsx` (debounce + `active` flag) and `users.controller.ts`
(serializable transaction + `ticketOwnerId` cleanup) carry the fixes.

### Final Review (2026-09-27)

Approved by `Chessuker`, who then merged the PR into `lab3-staging`.

**Final result:** Approved → Merged.

---

## 8. PR #48 Lab 3 E2E Integration (`feature/lab3-e2e-integration` → `lab3-staging`)

**PR:** [Feature/6 Lab3 e2e integration](https://github.com/TeekhathatTT/CPE334-TokTickIT/pull/48)
(merge commit `63fd8fd`, merged 2026-09-27 by `Chessuker`)

**Reviewer:** `Chessuker`

**Result:** Changes Requested → Approved → Merged.

The integration PR carried: the UI-alignment to the reference mockup (token
override list in the PR description), the 20 post-alignment screenshots,
`visual-checklist.md`, full regression evidence (`tests.md` §5.1:
server 124/124, client 61/61), and the E2E suite with the `Not run*` rows —
whose live execution (29/29 pass on 2026-09-28, `tests.md` §5.2) is recorded
as the follow-up completing this entry. The live pass additionally fixed one
real server bug the code-reading reviews could not see (unbound
`prisma.$transaction` → 500 on `PATCH /api/admin/users/:id`; mocked unit
tests take the fallback path), plus E2E selector/environment hardening —
all verified by re-running `npm run test:e2e`, never by inspection alone.

---

## 9. Review Process Reflection

Every Lab 3 implementation PR went through at least one Changes-Requested
round and was merged only after the fixes landed — the pattern that worked
was reviewer-reads-code-against-`docs/lab-03`, author-fixes-in-a-named-commit,
reviewer-re-reviews-the-commit. The most valuable findings were
cross-branch gaps no single branch could see alone (admin-created Requesters
unable to create tickets; staff/admin coordination on owner eligibility and
the resolved-signal lifecycle; the missing staff directory), which is exactly
what the E2E integration pass re-checks end to end. Reviews were explicitly
code-reading only ("ยังไม่ได้รันเทสต์หรือรันแอปจริง"), so the automated
regression + E2E evidence in this branch is the first runtime proof that the
reviewed code behaves as reviewed.
