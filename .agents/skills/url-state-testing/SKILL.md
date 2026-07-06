---
name: url-state-testing
description: >-
  How to write Playwright e2e tests for URL-synced state — pages
  that persist filters, sorting, pagination, toggles, etc. as search params.
  Generic patterns first (parse params, never substring-match the href;
  poll for debounced writes; test deep links and round-trips by rendered
  output), then the contract specifics of this repo's url-state kit
  (explicit-empty vs absent keys, compact encodings, replace-mode history).
  Applies to any URL-state implementation, not just this one. See the
  `url-state-sync` and `table-url-sync` skills for the implementation itself.
---

# Testing URL-synced state with Playwright

## Core principle

Test the **state contract**, not the string format. Always parse:

```ts
const param = (page: Page, key: string) =>
  new URL(page.url()).searchParams.get(key);
```

Never assert on the raw href (`expect(page.url()).toContain("...")` /
`.not.toContain("...")`). Raw-string assertions break for reasons that have
nothing to do with correctness: percent-encoding, compact/custom encodings,
param order, and — the classic false-negative — keys that legitimately remain
in the URL with an empty value (see "Contract gotchas").

Two traps that survive even when you do parse:

- **`searchParams.get()` returns `string | null` — never `undefined`.** So
  `expect(param(page, "x")).toBeDefined()` passes unconditionally (`null` IS
  defined) and asserts nothing. Assert the concrete expected value.
- **Substring-matching the param *value* is still format-coupled and
  false-positive-prone.** `.toContain("1")` on a pagination param matches
  pageIndex 1 — and also `0_15`, `21_25`, any digit anywhere. Decode the
  value the way the app does and assert structurally:

  ```ts
  const filters = () => JSON.parse(param(page, "columnFilters") ?? "[]");
  await expect.poll(filters).toContainEqual({ id: "cameraName", value: ["Kamera_A"] });
  ```

## The five test patterns

Every URL-state feature is covered by some subset of these. Assert UI state
through rendered output (rows, input values, pills) — never internal state.

### 1. UI → URL: interacting writes the param

URL writes are typically debounced — never assert `page.url()` synchronously
after an action. Poll:

```ts
await page.getByPlaceholder("Search…").fill("anna");
await expect.poll(() => param(page, "globalFilter")).toBe("anna");
// or, equivalently:
await page.waitForURL((url) => url.searchParams.get("globalFilter") === "anna");
```

### 2. Deep link → UI: a pasted URL restores state

Navigate directly to a URL with params and assert what the user sees:

```ts
await page.goto("/employees?globalFilter=anna");
await expect(page.getByPlaceholder("Search…")).toHaveValue("anna");
await expect(dataRows).toHaveCount(1);
```

Build the deep-link URL by **capturing it from the app** (pattern 3) rather
than hand-writing it, unless the format is a documented public contract —
hand-written URLs silently rot when the encoding changes.

### 3. Round-trip: reload restores state (the strongest single test)

Drive the UI to a state, capture `page.url()`, load it fresh, assert the same
rendered output. This tests write + parse + validate + restore in one go and
is immune to encoding changes:

```ts
await page.getByPlaceholder("Search…").fill("anna");
await expect.poll(() => param(page, "globalFilter")).toBe("anna");
const link = page.url();

await page.goto("/somewhere-else");   // genuinely leave
await page.goto(link);
await expect(page.getByPlaceholder("Search…")).toHaveValue("anna");
await expect(dataRows).toHaveCount(1);
```

### 4. Fresh visit stays clean: defaults must not stamp the URL

A page that writes its default state into the URL on mount makes every fresh
visit look like a deep link (and breaks "absent = untouched" semantics):

```ts
await page.goto("/employees");
await expect(dataRows.first()).toBeVisible(); // page settled
expect(new URL(page.url()).search).toBe("");
```

### 5. Garbage tolerance: a tampered URL degrades, not crashes

Users edit URLs. A garbage value must fall back to defaults:

```ts
await page.goto("/employees?sorting=%%%garbage&pagination=NaN_NaN");
await expect(dataRows.first()).toBeVisible(); // rendered defaults, no crash
```

## Asserting rendered state, robustly

The patterns above all end in "assert the rendered output" — how you do that
decides whether the suite is trustworthy or flaky:

- **Auto-retrying matchers, not snapshots.** `await expect(dataRows).toHaveCount(25)`
  retries until it holds; `const n = await dataRows.count(); expect(n)…`
  asserts a one-shot snapshot and races re-renders. If you genuinely need a
  range or comparison, poll it: `await expect.poll(() => dataRows.count()).toBe(before)`.
- **Exact outcomes over ranges.** `toBeGreaterThan(0)` + `toBeLessThanOrEqual(pageSize)`
  still passes when a filter only half-cleared. With deterministic fixtures,
  assert the exact count. With non-deterministic data, capture the count
  before filtering and assert equality after clearing — a real "back to
  baseline" check.
- **Define shared locators once.** A rows locator like
  `page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") })`
  belongs in one fixture/helper, not re-declared per step — duplicated
  definitions drift apart when one gets fixed.
- **Don't couple locators to display copy in one locale.** `getByPlaceholder("Sök träffar")`
  breaks on copy edits and other locales; prefer `getByRole` with the
  accessible name from a shared constant, or `data-testid` for
  copy-churning elements. For dropdown options use
  `getByRole("option", { name })` — `getByText("Kamera_A")` also matches
  table cells containing the same text.
- **Mocked data means exact expectations.** If the test mocks the API with
  exactly 3 matching rows, assert `toHaveCount(3)` — the exact count is also
  the correct "filter has applied" synchronization point before iterating
  rows. A range assertion (`toBeGreaterThan(0)`) on top of a deterministic
  mock throws away the determinism you paid for, and counting *before* the
  filter has applied races (rows were already visible pre-filter, so
  `toBeVisible()` is not a sync point).
- **No conditional actions.** `if (await button.isVisible()) { … }` silently
  skips the scenario and stays green. Assert visibility, then act; if the
  state can genuinely vary, fix the fixture so it can't.
- **Every step asserts something.** A step containing only comments, or
  computing a count it never asserts, is green noise — implement it or
  delete it.
- **Configure timeouts once.** Set `expect: { timeout: … }` in
  `playwright.config` instead of sprinkling `{ timeout: 5000 }` per assertion.

## Contract gotchas (this repo's kit — and common elsewhere)

### Explicit-empty ≠ absent: clearing a filter does NOT remove the key
Once a slice has been touched, clearing it writes an **explicit empty value**
(`?globalFilter=`, `?status=`) — deliberately, so "cleared" survives the
away-and-back fallback restore and isn't resurrected as the old value. So:

```ts
// WRONG — can never pass; the key stays forever once touched:
await expect(() => expect(page.url()).not.toContain("globalFilter")).toPass();

// RIGHT — assert the value is empty/default:
await expect.poll(() => param(page, "globalFilter")).toBe("");
```

For a filter inside `columnFilters`, the emptied entry IS removed from the
array (TanStack's `autoRemove`), so there you assert the decoded value no
longer contains the pair — still via `searchParams.get("columnFilters")`, not
the raw href.

### Debounced writes
Every URL assertion after an interaction must poll (`expect.poll`,
`expect(...).toPass()`, or `page.waitForURL(predicate)`). A bare
`expect(page.url())` races the debounce and flakes.

### Compact encodings don't look like their JS values
Table slices serialize compactly: `sorting=-salary.name`, `pagination=1_10`,
arrays as dot-led lists (`columnFilters=department..Engineering.Sales`).
Prefer capture-and-compare (pattern 3) over asserting these formats; if a
format itself is the thing under test, pin it in one dedicated test so an
encoding change fails loudly in exactly one place instead of everywhere.

### `replace: true` history — don't step back through filter states
State writes replace the current history entry (so rapid typing doesn't spam
Back). `page.goBack()` therefore returns to the previous *page*, not the
previous filter value. Test back/forward across page navigations only.

### StrictMode/dev double-mount
Assert steady-state outcomes (final URL value, final rows), not "navigate was
called exactly once".
