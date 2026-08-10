# Lab 1 — Peer Review Record

**Author:** Theekhathat Wongsubsantati — 67070501019 — GitHub: @TeekhathatTT  
**Peer reviewer:** Thawat Boonsuk — 67070501024 — GitHub: @Chessuker  
**Additional partner:** Khanklao Naknan — 67070501055 — GitHub: @Khwanklao

---

## Pull Requests I Authored

### PR #5 — Feature 1

**Branch:** `feature/1-project-foundation`

**Reviewer:** Chessuker

**Reviewer verdict:** Changes requested → Fixed → Approved

**Reviewer comments:**

- Remove compiled/transpiled JavaScript artifacts from `client/src`.
- Ensure the PR matches its description.
- Add the required backend, Prisma, `.env.example`, and README files.
- Implement the frontend API or mock it in tests.
- Add the required `package.json` files and scripts.
- Add `.env.example` and README setup instructions.
- Run tests locally and ensure they pass.

**How I responded:**

- Removed compiled/transpiled files.
- Added and corrected the required project source files.
- Added the required configuration files and README.
- Implemented the required API functionality.
- Added the required package scripts.
- Ran the tests and fixed the reported issues.

**Final verdict:** Approved by Chessuker.

---

### PR #6 — Feature 2

**Branch:** `feature/2-health-check`

**Reviewer:** Chessuker

**Reviewer verdict:** Changes requested → Fixed → Approved

**Reviewer comments:**

- Remove compiled JavaScript artifacts.
- Remove duplicate `client/src/api.js`.
- Keep `client/src/api.ts`.
- Fix the import path in `App.tsx`.
- Make Issue #2 only call `/api/health`.
- Return `{ online: true, categories: [] }` for the health check.
- Remove the unused `void categories;` line.
- Add `type="button"` to the Check System button.
- Replace TODO tests with actual passing tests.

**How I responded:**

- Removed the compiled JavaScript artifacts.
- Removed the duplicate `api.js` file.
- Fixed the API import path.
- Updated `checkSystem()` to match the Issue #2 scope.
- Resolved the merge conflict.
- Updated the frontend behavior and tests.
- Added the required button type.
- Ran the tests and verified that they passed.

**Final verdict:** Approved by Chessuker.

---

### PR #7 — Feature 3

**Branch:** `feature/3-category-seed`

**Reviewer:** Chessuker

**Reviewer verdict:** Changes requested → Fixed → Approved

**Reviewer comments:**

- Improve seed reliability using `try/catch/finally`.
- Ensure Prisma is disconnected using `await prisma.$disconnect()`.
- Make seed failures exit with a non-zero status.
- Add more context to seed error logs.
- Confirm the timezone behavior of `createdAt`.
- Confirm the case-sensitivity behavior of the unique category name.
- Add migration and seed instructions to the README.
- Optionally improve seed performance with `Promise.all()`.

**How I responded:**

- Improved Prisma seed reliability.
- Added proper error handling and Prisma disconnection.
- Improved error logging.
- Updated the documentation with migration and seed instructions.
- Confirmed the database and category configuration.

**Final verdict:** Approved by Chessuker.

---

### PR #11 — Feature 4

**Branch:** `feature/4-category-list`

**Reviewer:** Khwanklao

**Reviewer verdict:** Approved

**Reviewer comments:**

> Everything in this task is done. Good job!

**How I responded:**

- No changes were requested.
- Verified that the implementation and tests were complete.

**Final verdict:** Approved by Khwanklao.

---

## Pull Requests I Reviewed for My Partner

### Partner PR #5

**Repository:** `Chessuker/TokTickIT`

**Reviewer:** TeekhathatTT

**Review verdict:** Changes requested → Fixed → Approved

**My review comments:**

- Requested a fix for the mismatch between the PR description and Prisma schema.
- Requested correction of the `/api/health` response.
- Requested the Prisma mock to be placed before imports in the test file.
- Requested the mock shape to match the Prisma usage.
- Requested mock reset/clear handling.
- Requested the server tests to be run and verified.

**Partner's response:**

- Fixed the Prisma schema and `/api/health` implementation.
- Fixed the test mocking issue.
- Added the required changes and pushed new commits.
- I reviewed the changes again and approved the PR.

**Final verdict:** Approved.

---

### Partner PR #6

**Repository:** `Chessuker/TokTickIT`

**Reviewer:** TeekhathatTT

**Review verdict:** Changes requested → Fixed → Approved

**My review comments:**

Requested that the system status badge display human-friendly text instead of the raw API status.

**Requested change:**

```tsx
<span className={`badge ${health?.status === 'ok' ? 'bg-success' : 'bg-danger'} px-3 py-2`}>
  {health?.status === 'ok' ? 'Online' : 'Offline'}
</span>
```

- Keep the existing loading spinner.
- Keep the existing error alert.
- Display `Online` / `Offline` instead of the raw API status.

**Partner's response:**

- Updated the status badge to display `Online` / `Offline`.
- Kept the loading and error behavior.
- Pushed the fix.

**Final verdict:** Approved.

---

### Partner PR #10 — Feature 3

**Repository:** `Chessuker/TokTickIT`

**Reviewer:** TeekhathatTT

**Review verdict:** Approved → Merged

**My review comments:**

- Reviewed the implementation.
- Confirmed that there were no remaining issues.

**My comment:**

> ไม่มีปัญหา merge เลยพี่ชาย

**Partner's response:**

- The changes were accepted.
- The PR was merged into `lab1-staging`.

**Final verdict:** Approved and merged.

---

### Partner PR #12

**Repository:** `Chessuker/TokTickIT`

**Reviewer:** TeekhathatTT

**Review verdict:** Reviewed → Approved → Merged

**My review comments:**

- Reviewed the PR.
- Found a project naming issue.

**My comment:**

> I have a little problem this project name "TokTickIT" not "TokTikIT".

**Partner's response:**

- Corrected the project name.
- Updated the changes and pushed them.

**Final verdict:** Approved and merged.

---

## Merge Status

After completing the reviews and addressing all requested changes:

- Feature 1 → Reviewed → Approved → Merged into `lab1-staging`
- Feature 2 → Reviewed → Approved → Merged into `lab1-staging`
- Feature 3 → Reviewed → Approved → Merged into `lab1-staging`
- Feature 4 → Reviewed → Approved → Merged into `lab1-staging`

All required feature work was reviewed and merged into the `lab1-staging` branch.
