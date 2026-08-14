# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Pass |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Pass |
| 3 | Vitest | Heading renders | Pass |
| 4 | Vitest | Loading state shows loading message then category list | Pass |
| 5 | Vitest | Success state shows Online + category list | Pass |
| 6 | Vitest | Error state shows Offline + message | Pass |

## Terminal evidence

### API tests (Docker-backed)
```text
> toktickit-server@1.0.0 test
> vitest run

✓ tests/lab-01/health.test.ts (1)
✓ tests/lab-01/categories.test.ts (1)
```

### UI tests
```text
> toktickit-client@1.0.0 test
> vitest run

✓ tests/lab-01/App.test.tsx (4)
  ✓ App (4)
    ✓ renders the TokTickIT heading
    ✓ shows a loading state before the category list appears
    ✓ shows Online and the seeded categories on success
    ✓ shows an Offline error message when the API is unavailable
```

### Live API response
```text
{"status":"ok","service":"TokTickIT API"}
[{"id":1,"name":"Account and Access"},...]
```
