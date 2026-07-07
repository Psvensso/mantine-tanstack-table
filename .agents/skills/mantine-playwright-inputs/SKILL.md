---
name: mantine-playwright-inputs
description: >-
  How to drive Mantine form inputs from Playwright — plain inputs
  (TextInput, NumberInput, Textarea, PasswordInput, Checkbox, Radio, Switch)
  and the hard ones built on Combobox (Select, Autocomplete, MultiSelect,
  TagsInput) plus DatePickerInput/DateInput. Covers the two traps that break
  naive selectors: the dropdown renders in a portal on <body> (not nested
  under the input) and there are two inputs (a visible role="textbox" for
  display, a hidden input[name] for the submitted value). Gives the universal
  open → wait for role="listbox" → click role="option" pattern, the
  custom-Combobox-with-footer-OK-button case, and calendar navigation. Use
  whenever writing Playwright interactions or locators against a Mantine
  input. Pairs with the `playwright-page-object` skill for where these
  locators live.
---

# Driving Mantine inputs from Playwright

Mantine 9. Plain inputs are easy; the Combobox family (Select, Autocomplete,
MultiSelect, TagsInput) and the date inputs trip up most selector attempts.
Two facts explain almost every failure:

1. **The dropdown is portaled.** When a Select/DatePicker opens, its options
   (and any footer buttons) are appended to the end of `<body>`, *not* nested
   inside the input's DOM. So `input.locator("[role=option]")` finds nothing —
   you must query from `page`, which searches the whole document.
2. **There are two inputs.** The thing the user sees is a visible
   `role="textbox"` showing the *label* of the selection. The thing the form
   submits is a **hidden `<input name="…">`** holding the *value*. Assert the
   textbox for what's displayed, the hidden input for what will be submitted.

## The universal Combobox pattern

Every Select / Autocomplete / MultiSelect / TagsInput interaction is the same
three steps. Never skip the middle one — the dropdown is portaled and
animated, so clicking an option before the listbox is visible races.

```ts
// 1. Open — click the textbox by its accessible name (the label).
await page.getByRole("textbox", { name: "Select your age" }).click();

// 2. Wait for the dropdown. The listbox has the SAME accessible name as the
//    textbox — this is the reliable "it's open" signal.
await expect(page.getByRole("listbox", { name: "Select your age" })).toBeVisible();

// 3. Click the option by ROLE + label, never by getByText.
await page.getByRole("option", { name: "I am 18 or older" }).click();
```

Why `getByRole("option", …)` and not `getByText`: `getByText("Banana")` also
matches a table cell, a chip, or another option containing that substring.
The `option` role targets exactly the dropdown item.

### Select vs MultiSelect: closing behavior differs

- **Select / Autocomplete** close the dropdown when you pick an option. To
  pick a second value (i.e. change the selection) you must click the textbox
  again to reopen.
- **MultiSelect / TagsInput** stay open after each pick, so you can click
  several options in a row, then close with `Escape` or an outside click.

```ts
// MultiSelect — dropdown stays open between picks
await page.getByRole("textbox", { name: "Select groceries" }).click();
await page.getByRole("option", { name: "Banana" }).click();
await page.getByRole("option", { name: "Apple" }).click();
await page.keyboard.press("Escape"); // close when done
```

### Asserting the result: display value vs submitted value

```ts
// What the user sees (the label) — on the visible textbox:
await expect(page.getByRole("textbox", { name: "Select your age" }))
  .toHaveValue("I am 18 or older");

// What the form submits (the value) — on the hidden input by name:
await expect(page.locator('input[name="age"]')).toHaveValue("ok");

// MultiSelect submits a comma-joined value:
await expect(page.locator('input[name="groceries"]')).toHaveValue("banana,apple");
```

The `input[name=…]` locator is a CSS selector, which the
`playwright-page-object` skill otherwise warns against — it's the justified
exception here because `name` is a stable form contract, not styling or DOM
structure, and there's no role that distinguishes the hidden value input.

## Searchable / typeable inputs

A plain `Select` renders a **read-only** textbox: `fill()` throws
`Element is not editable`. You can only `click()` to open and pick.

Add `searchable` (Select) or use `Autocomplete`/`TagsInput` and the textbox
becomes editable — now `fill()`/`pressSequentially()` filter the options:

```ts
const input = page.getByRole("textbox", { name: "Country" });
await input.click();
await input.fill("ger");                       // filters the list
await page.getByRole("option", { name: "Germany" }).click();
```

If `fill()` fails with "not editable", the component is not searchable — open
and click the option instead of typing. Don't reach for `force: true`; that
just papers over using the wrong interaction.

## Custom Combobox with a footer "OK" button

A Combobox built with a footer (an `Ok`/`Apply` button under the options,
common for "select several, then confirm") keeps the dropdown open until you
click that button. The button lives **inside the portaled dropdown**, so it's
reachable from `page` by role — but only while the dropdown is open, so never
click outside first.

```ts
await page.getByRole("textbox", { name: "Assignees" }).click();
await expect(page.getByRole("listbox", { name: "Assignees" })).toBeVisible();

await page.getByRole("option", { name: "Alice" }).click();
await page.getByRole("option", { name: "Bob" }).click();

// The OK button is in the dropdown footer, in the body portal.
await page.getByRole("button", { name: "OK" }).click();

// After OK the dropdown closes — assert it's gone before moving on.
await expect(page.getByRole("listbox", { name: "Assignees" })).toBeHidden();
```

Two gotchas specific to this pattern:

- **Don't click the page body / another field to "commit"** — that dismisses
  the dropdown *and* may discard the pending selection, depending on how the
  Combobox is wired. Use the OK button, which is the intended commit path.
- **If the OK button isn't found**, the dropdown already closed (an option
  auto-closed it, or an earlier outside click). Assert the listbox
  `toBeVisible()` right before clicking OK to catch this at the real cause.

## Date inputs

`DatePickerInput` renders its control as a **`<button>`** (not a text input),
carrying a `data-dates-input` attribute, and opens a calendar in a portal.

```ts
// Open — the control is a button; its accessible name comes from the label.
await page.getByRole("button", { name: "Pick a date" }).click();

// Pick a day. Day controls are <button>s inside the calendar <table>;
// their accessible name is the day number. Scope to the dialog/portal and
// use an exact name so "1" doesn't also match "11", "21", "31".
const calendar = page.getByRole("dialog"); // the portaled dropdown
await calendar.getByRole("button", { name: "15", exact: true }).click();
```

If two months are visible (range pickers, `numberOfColumns`), the same day
number appears twice — disambiguate by navigating to a known month first, or
match the day control's `aria-label` (the full date) when present:
`calendar.getByLabel("15 April 2026")`.

Navigate months/years with the header controls, which have accessible names:

```ts
await calendar.getByRole("button", { name: "Next month" }).click();
await calendar.getByRole("button", { name: "Previous month" }).click();
// The center header button (e.g. "April 2026") switches to month/year view:
await calendar.getByRole("button", { name: "April 2026" }).click();
```

`DateInput` (free-typing variant) is a real editable input — `fill()` it with
a value in the component's parsing format, then blur or press `Enter`:

```ts
const date = page.getByRole("textbox", { name: "Date of birth" });
await date.fill("April 15, 2026");
await date.blur();
```

Range pickers (`DatePickerInput type="range"`) need two day clicks — start
then end — inside the same open calendar.

## Plain inputs (the easy ones)

These render a single real element; `getByLabel` / `getByRole` just work.

```ts
// TextInput / PasswordInput / Textarea — editable textbox, fill() works:
await page.getByLabel("Email").fill("anna@example.com");

// NumberInput — a formatted text input (role="textbox", NOT spinbutton):
await page.getByLabel("Age").fill("42");

// Checkbox / Switch — role="checkbox" / "switch":
await page.getByRole("checkbox", { name: "Accept terms" }).check();
await page.getByRole("switch", { name: "Dark mode" }).click();

// Radio — check the specific option by its label:
await page.getByRole("radio", { name: "Express shipping" }).check();

// Slider — role="slider"; drive it with the keyboard, not a drag:
const slider = page.getByRole("slider", { name: "Volume" });
await slider.focus();
await slider.press("ArrowRight");
```

Prefer `getByLabel(...)` over `getByPlaceholder(...)` for these — Mantine
associates the `<label>` with the input, and labels change less often than
placeholder copy.

## Gotchas checklist

- **Portaled dropdown/calendar** — query options and footer buttons from
  `page` (or the `listbox`/`dialog` locator), never from the input locator.
  They are not DOM descendants of the input.
- **Two inputs** — visible `textbox` = display label; hidden `input[name]` =
  submitted value. Assert the right one for what you're checking.
- **Wait for `role="listbox"` (same name as the textbox) before clicking
  options.** The dropdown is animated; clicking too early races.
- **`role="option"`, not `getByText`** — text matching also hits table cells,
  chips, and other elements sharing the label.
- **Plain Select is read-only** — `fill()` throws; `click()` and pick. Add
  `searchable` (or use Autocomplete) to type.
- **Select closes on pick; MultiSelect stays open** — reopen the Select to
  change it; batch MultiSelect picks then `Escape`.
- **Date control is a `<button>`, not an input** — open with a button click;
  days are buttons in a `<table>`, matched by exact day number.
- **Never `force: true` to get past "not editable"/"not visible"** — it hides
  the real reason (wrong element, dropdown not open, animation) and produces
  flaky greens.

## Where these locators belong

Keep this interaction logic in a **component object** (see the
`playwright-page-object` skill), not copy-pasted per test — a Mantine Select
appears on many pages and its open→wait→pick dance should live in one class:

```ts
export class MantineSelect {
  constructor(private readonly page: Page, private readonly label: string) {}

  async select(optionLabel: string) {
    await this.page.getByRole("textbox", { name: this.label }).click();
    await expect(this.page.getByRole("listbox", { name: this.label })).toBeVisible();
    await this.page.getByRole("option", { name: optionLabel }).click();
  }

  value() {
    return this.page.getByRole("textbox", { name: this.label });
  }
}
```
