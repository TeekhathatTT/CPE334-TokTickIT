// Lab 4 injectable app-code clock (specification.md BR-14).
//
// `actionDate` (POST /actions-taken) and `followUpResolvedAt` (resolve) MUST be
// stamped from this single clock — never the Postgres clock — so freezing the
// app clock in tests freezes every server-owned timestamp. Production default
// is `() => new Date(Date.now())`; tests inject a fixed `NOW`.

let nowProvider: () => Date = () => new Date(Date.now());

/** Current server time from the injectable app-code clock. */
export function getNow(): Date {
  return nowProvider();
}

/**
 * Test/DI hook: replace the clock provider. Passing `null` restores the
 * production default (`new Date(Date.now())`).
 */
export function setNowProvider(provider: (() => Date) | null): void {
  nowProvider = provider ?? (() => new Date(Date.now()));
}
