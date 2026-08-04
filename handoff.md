# Budget Tracker — Handoff

## Project

Single-user personal budget tracker. Offline-first PWA. Static hosting on GitHub Pages. All data local in IndexedDB. No backend, no auth, no cloud.

---

## Stack

| Tool | Version |
|---|---|
| React | 19 |
| TypeScript | 6 |
| Vite | 8 |
| Tailwind CSS | 4 (via `@tailwindcss/vite`) |
| React Router | 7.11.0 (hash-based, for GitHub Pages) |
| Dexie.js | 4 |
| React Hook Form + Zod | 7 + 4 |
| Recharts | 3 |
| vite-plugin-pwa | 1 |

---

## Running locally

```
npm run dev
```

Runs on `http://localhost:5173/` and also exposes `http://<local-ip>:5173/` on the network (for phone testing). The `--host` flag is already in `package.json`.

---

## Architecture

**Storage abstraction**: `src/storage/StorageService.ts` is the interface. `IndexedDBStorage` is the only implementation. UI never touches Dexie directly. To swap to Firebase/Supabase later, only a new class is needed.

**Context**: `StorageContext.tsx` wraps the app, initialises the DB, seeds defaults on first run, applies the theme, and exposes `{ storage, settings, refreshSettings }` via `useStorage()`.

**Important**: `StorageContext.tsx` has `import.meta.hot.decline()` at the top. This forces a full page reload instead of HMR hot-swap, which avoids a React context identity mismatch bug during development.

**Routing**: `createHashRouter` from react-router v7. Hash routing is required because GitHub Pages has no server-side routing.

---

## Database schema

Dexie `BudgetTrackerDB`, currently at **version 3**.

| Table | Key indexes |
|---|---|
| `transactions` | id, type, date, categoryId, accountId, toAccountId, amount, \*tags |
| `categories` | id, type, name |
| `budgets` | id, categoryId, month |
| `accounts` | id, type, name |
| `settings` | id (singleton, always 1) |
| `metadata` | id (singleton, always 1) |

**Never edit existing version blocks.** Always add a new `this.version(N).stores({})` block in `src/storage/db.ts`.

---

## Key data model notes

- `Transaction.type` is `'income' | 'expense' | 'transfer'`
- `Transaction.categoryId` is **optional** — transfers have no category
- `Transaction.accountId` = source account; `Transaction.toAccountId` = destination (transfers only)
- `Account.balance` is manually maintained. It auto-adjusts when transactions are added/edited/deleted via `_applyBalance` / `_reverseBalance` in `IndexedDBStorage`
- `Budget` tracks a monthly limit (`YYYY-MM` month format) per category
- `Settings` and `AppMetadata` are singletons with `id: 1`

---

## Folder structure

```
src/
  components/
    icons/NavIcons.tsx        SVG nav icons
    layout/
      Layout.tsx              Root layout — sidebar + outlet + bottom nav
      BottomNav.tsx           Mobile bottom tabs (hidden lg+)
      Sidebar.tsx             Desktop sidebar (hidden <lg)
    ui/
      BottomSheet.tsx         Slide-up sheet on mobile, modal on desktop
  contexts/
    StorageContext.tsx        DB init + theme + settings provider
  features/
    accounts/
      AccountCard.tsx         Compact account row for Settings list
      AccountForm.tsx         Add/edit account (name, type, balance, color)
    budgets/
      BudgetForm.tsx          Set monthly budget per category
      BudgetProgress.tsx      Progress bar row (green/amber/red)
    transactions/
      CategoryPicker.tsx      Icon grid filtered by income/expense type
      TransactionForm.tsx     Add/edit/delete — income, expense, transfer
      TransactionItem.tsx     Single transaction row
      TransactionList.tsx     Grouped by day with day totals
  hooks/
    useAccounts.ts
    useBudgets.ts             accepts optional month param
    useCategories.ts
    useStorage.ts             thin wrapper for useStorageContext
    useTransactions.ts
  pages/
    DashboardPage.tsx         Month-navigable overview
    TransactionsPage.tsx
    BudgetsPage.tsx           Month-navigable with prev/next + totals summary
    ReportsPage.tsx           Placeholder
    SettingsPage.tsx          Accounts management + theme + currency
  storage/
    db.ts                     Dexie class + singleton instance
    StorageService.ts         Interface
    IndexedDBStorage.ts       Full implementation + singleton `storage`
  types/
    index.ts                  All interfaces and enums
  utils/
    accountColors.ts          8 preset hex colors for accounts
    currency.ts               formatCurrency
    date.ts                   formatDate, formatMonthYear, getCurrentMonth, addMonths, getTodayISO
    defaults.ts               DEFAULT_SETTINGS, DEFAULT_CATEGORIES (22 categories)
```

---

## Known issues / watch-outs

- **PWA icons missing**: `public/icons/` does not exist yet. Add `icon-192.png` and `icon-512.png` there, then update `manifest.icons` in `vite.config.ts` before deploying.
- **GitHub Pages base path**: `vite.config.ts` uses `base: './'`. This works with hash routing regardless of the repo name.
- **react-router-dom 7.11.0** — there are npm audit advisories for this version range, all server-side (SSR/RSC). This is a pure SPA with no server so none are exploitable.
- **`categoryId` optional**: Made optional in Phase 2b to support transfer transactions. The DB and storage layer handle `undefined` gracefully.
- **`autoComplete="off"`** on all free-text form inputs to prevent mobile keyboard suggestions.

---

## Phase completion

| Phase | Status | What was built |
|---|---|---|
| 1 | ✅ | Project setup, routing, layout, IndexedDB foundation, theme, navigation |
| 2 | ✅ | Transaction CRUD, category picker, day-grouped list, balance auto-update |
| 2b | ✅ | Accounts (savings + credit card), balance cards on dashboard, account picker in transactions |
| 2c | ✅ | Transfer transaction type — From/To account pickers, balance adjusts both accounts |
| 3 | ✅ | Budget CRUD, monthly progress bars, over-budget warnings, dashboard budget section, month navigation on both Dashboard and Budgets |
| 3b | ✅ | Budget system redesign — ParentBudget + BudgetAllocation model, budget picker in transactions, tags removed |
| 3c | ✅ | Budget types (monthly/custom), dashboard month-filtering, budget reports with merchant drill-down, merchant autocomplete |
| 4 | ⬜ | Reports — Recharts charts (monthly bar, category pie, monthly comparison) |
| 5 | ⬜ | Export / Import JSON with validation and schema migration |
| 6 | ⬜ | PWA polish, offline hardening, performance, icons |

---

## Status

Active development. Dev server running at `http://localhost:5173/` (network: `http://192.168.1.114:5173/`).

## Next

Phase 4 — Reports page using Recharts:
- Monthly spending bar chart (last 6 months)
- Category breakdown pie/donut chart for selected month
- Income vs expense trend line

## Latest Update

Date: 2026-08-04

Changed:

- Budget system fully redesigned: replaced flat monthly-category budgets with a two-level model
- `ParentBudget` (name, description?, totalAmount) — a named spending plan (trip, event, goal)
- `BudgetAllocation` (budgetId, categoryId, amount) — a category slice inside a parent budget
- `Transaction.budgetId` (optional) — links an expense to a parent budget; unset = general spending
- `Transaction.tags` removed — was never used in UI; budget linkage is now via `budgetId`
- DB schema version 4: new `parentBudgets` and `budgetAllocations` tables; `transactions` drops `*tags` index, gains `budgetId` index
- `deleteParentBudget` cascades: removes all its allocations and unlinks its transactions
- `BudgetsPage` redesigned: accordion list of parent budget cards, each expandable to show category allocations with progress bars + "Add Category" inline button
- `BudgetForm` now creates/edits a `ParentBudget` (name + total amount)
- `BudgetAllocationForm` (new): add/edit a category allocation within a budget; duplicate-category guard updates instead of inserting
- `BudgetProgress` updated: now takes a `BudgetAllocation` instead of old `Budget`
- `TransactionForm`: expense transactions show an optional budget picker (pill row); selecting a budget sets `budgetId` on the transaction
- `TransactionsPage`: passes `parentBudgets` to `TransactionForm`
- `DashboardPage`: budget section shows parent budget summary cards (spent vs total + progress bar); monthly category spending map removed
- `useParentBudgets` hook: loads both `parentBudgets` and all `budgetAllocations` in one call
- `ExportData` updated to include `parentBudgets` and `budgetAllocations`; `importData`/`clearAll`/`exportData` all updated to handle new tables

Why:

- Goal-based budgets (trip, event) are more useful than flat monthly category limits for most personal finance use cases
- Two-level hierarchy (parent + allocations) gives both an overall spending target and per-category granularity
- Budget linkage via `budgetId` on transactions is explicit and reliable; tag-based linking was implicit and fragile
- Cascade delete on `deleteParentBudget` prevents orphaned allocations and dangling `budgetId` references in transactions

Next:

- Phase 4: Reports — Recharts monthly bar chart, category pie chart, monthly comparison

## Project

Single-user personal budget tracker.

Constraints:

- Static site only
- GitHub Pages hosting
- Offline-first PWA
- Local-only data
- No backend
- No auth

## Planned Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Dexie.js
- React Hook Form
- Zod
- Recharts

## Architecture Direction

- Keep storage behind a `StorageService` interface
- Use IndexedDB as the first implementation
- Keep UI isolated from storage details
- Design models for future migrations

## Product Notes

- Prioritize quick daily transaction entry over reporting depth
- Keep transfer support in the data model, not necessarily the first UI
- Watch nav complexity on mobile; five tabs may be heavier than needed

## Status

Phase 3 complete. Dev server at http://localhost:5173/ (network: http://192.168.1.114:5173/)

## Latest Update

Date: 2026-08-03

Changed:

- Transfer transaction type: ⇄ tab in form, From/To account pickers, balance adjusts both accounts, neutral indigo display in list
- `_applyBalance` and `_reverseBalance` helpers in IndexedDBStorage replace the old per-type if/else in add/update/delete — handles income, expense, and transfer uniformly
- Phase 3 Budgets: `useBudgets` hook, `BudgetProgress` bar (green/amber/red thresholds), `BudgetForm` with month picker + category grid + limit amount
- BudgetsPage: month navigation (prev/next), list of progress bars, add/edit/delete via BottomSheet
- Duplicate budget guard: if a budget for the same category+month already exists, submitting updates it instead of creating a second one
- DashboardPage: budget progress bars section added above Recent, spending per category computed from transactions

Why:

- Budget spending is derived from transactions at render time rather than stored separately — avoids sync bugs and is fast enough for personal-scale data
- `addMonths` helper is inlined in BudgetsPage since it is only needed there

Next:

- Phase 4: Reports — Recharts monthly bar chart, category pie chart, monthly comparison
- Phase 5: Export / Import JSON with validation and schema migration support

## Latest Update

Date: 2026-08-03

Changed:

- Accounts feature: add/edit/delete savings and credit card accounts with color picker
- Account balance cards on Dashboard
- Account picker in transaction form (required)
- Merchant is now required in transaction form
- Account balance auto-updates on every transaction add/edit/delete — edit reverses old effect before applying new, handles account changes mid-edit
- `Math.round` used to prevent floating point drift on balance
- `crypto.randomUUID` polyfill for non-HTTPS local network access on mobile
- Duplicate category seeding fixed with a promise guard (StrictMode double-invoke safe)
- `import.meta.hot.decline()` added to `StorageContext.tsx` to force full page reload on HMR instead of a broken context identity hot swap

Why:

- Account balance is auto-calculated from transactions rather than manual-only so the user always sees the real number without reconciling by hand
- `hot.decline()` is the correct Vite API for modules that own React context — hot-swapping a context creates a new object identity that breaks `useContext` in already-loaded components

Next:

- Phase 3: Budget CRUD — monthly limits per category, progress bars, 80% and over-budget warnings on Dashboard
- Phase 4: Reports — Recharts bar/pie charts, monthly comparison, category breakdown

## Latest Update

Date: 2026-08-03

Changed:

- Added `Account` type (`savings` | `credit_card`) and `AccountType` to types
- Added optional `accountId` to `Transaction` (backward-compatible — old transactions without one still work)
- Dexie schema version 2 — adds `accounts` table and `accountId` index on transactions
- `StorageService` interface now includes full account CRUD
- `IndexedDBStorage` implements account CRUD; exportData and importData both handle accounts
- `useAccounts` hook for reactive account list
- `AccountForm` — add/edit account: name, type toggle, balance (labeled differently for credit cards), 8 color swatches
- `AccountCard` — compact account row for Settings list
- `AccountBalanceCard` — colored card on Dashboard showing balance
- Settings page has a full Accounts section (add, edit, delete)
- Transaction form shows an account picker row (only if accounts exist, optional)
- Dashboard shows account balance cards above the month summary
- `accountColors.ts` utility for the 8 preset swatches

Why:

- Built accounts before Phase 3 budgets because user's credit card spend would cause double-counting in reports without it
- `accountId` is optional so all existing Phase 2 transactions remain valid without migration
- Balance is a manually-maintained field — auto-calculation from transactions is deferred to Phase 4 Reports

Next:

- Phase 3: Budget CRUD — monthly limits per category, progress bars, 80% and over-budget warnings on Dashboard
- Phase 4: Reports — Recharts bar/pie charts, monthly comparison, category breakdown

## Latest Update

Date: 2026-08-03

Changed:

- Added `--host` flag to dev script — app is now reachable on the local network
- `useTransactions` and `useCategories` hooks for reactive data loading
- `BottomSheet` component (slides up on mobile, centered modal on desktop, Escape to close)
- `TransactionForm` with React Hook Form + Zod validation: type toggle, amount, date, category picker, merchant, notes
- `TransactionItem` — tappable row with category icon, label, signed amount
- `TransactionList` — groups by day, shows day totals per group
- `CategoryPicker` — grid filtered by transaction type (income vs expense)
- Transactions page now fully wired: add, edit, delete
- Dashboard now shows real month totals and last 5 transactions

Why:

- Bottom sheet is the standard mobile pattern for forms — avoids full page navigation for quick entry
- Transactions are grouped by day because that is the primary mental model for reviewing spending
- Delete lives inside the edit form rather than on the list row to prevent accidental deletions

Next:

- Phase 3: Budget CRUD with progress bars and overspend warnings
- Phase 4: Reports with Recharts (monthly bar chart, category pie chart)

## Update Rule

After each meaningful session, update only:

- Status
- Changed
- Why
- Next