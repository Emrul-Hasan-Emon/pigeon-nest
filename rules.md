# Rules (must follow — always)

Rules are appended over time. Every rule below is binding until the user removes it.

1. Monorepo structure only. Client and server live under `apps/`, shared code under `packages/`. No separate repos.
2. Client is Next.js. Server is NestJS. Database is PostgreSQL. No substituting stack.
3. Server directory structure (based on reference project `shukhee-sis-customer-api`):
   - `src/database/` — everything database-related: TypeORM `entities/` (grouped by domain subfolder, e.g. `entities/shop/`, `entities/product/`), `migrations/`, `enums/`, `config/`, `seeds/`. No entity or migration lives outside this module.
   - `src/auth/` — all authentication: login, signup, forgot-password, reset-password routes, token/session handling, and all guards (`AuthGuard`, `RoleGuard`, etc.). No other module defines its own auth logic or guards.
   - `src/shared/` — cross-module reusable pieces: shared services, utils, dtos, and controllers used by more than one feature module.
   - `src/<feature>/` (e.g. `src/category/`) — one module per feature, containing:
     - `<feature>.module.ts`
     - `controllers/` — one controller per role acting on this feature, e.g. `admin-category.controller.ts`, `seller-category.controller.ts`, `user-category.controller.ts`. Each controller's routes are role-scoped via `AuthGuard` + `RoleGuard` from `src/auth`, not by manual checks.
     - `services/` — mirrors controllers: `admin-category.service.ts`, `seller-category.service.ts`, `user-category.service.ts`, plus a `common-category.service.ts` (or similar) holding logic shared across the role-specific services.
     - `dtos/` — all DTOs for this feature.
     - `utils/` — feature-local helpers (only when not reusable elsewhere; reusable ones go to `src/shared`).
   - A feature module only adds the role-specific controller/service files it actually needs — don't create empty admin/seller/user files for a feature that has only one audience.
4. Commit messages: no co-author line, no mention of Claude/AI tooling. Body must be 2–4 lines of descriptive content (what changed and why), not a single line.
5. Seller app lives in `apps/seller_app` (Flutter, Android and iOS, one codebase, same monorepo). It uses the existing seller API under `/v1/api/seller` and follows the order in `apps/seller_app/ROADMAP.md`. No second app, no separate repo.
6. Seller app code must be easy to change:
   - One folder per feature: `lib/features/<feature>/` with `data/` (server calls and models), `state/` (providers), `ui/` (screens) and `widgets/` (pieces used only by this feature). Anything used by two or more features goes to `lib/shared/` (widgets, helpers) or `lib/core/` (config, API client, auth, theme, router).
   - A feature never imports another feature's files. Talk through `core/` or `shared/`.
   - Small files: one screen, one widget or one class per file, about 200 lines at most. Split before it grows.
   - Small functions: each does one thing and has a plain name that says what it does (`loadOrders`, `changeStatus`, not `handle`, `process`).
   - Plain code only: no code generation (no build_runner, no freezed), no clever abstractions, no inheritance trees. Models are simple classes with `fromJson`.
   - All server paths of a feature live in one file, `data/<feature>_api.dart`. Screens never write a URL.
   - No magic numbers or colours inside screens. Sizes, spacing and colours come from `core/theme`.
   - Comment the why in plain English. Do not comment what the code obviously does.
   - Seller UI stays big, plain-worded and icon-led, like the website.
7. `apps/seller_app/FEATURES.md` is the map of what lies where: for each feature, its folder, screens, API file, server routes, website page and status. Any change that adds, moves, renames or removes a feature or screen updates `FEATURES.md` in the same commit. A feature is not done until its row is accurate.
8. A seller app feature is done only when: it matches its guide in `apps/server/docs/seller/` (or the website page when no guide exists), `flutter analyze` shows no issues, its tests pass, and `FEATURES.md` and `ROADMAP.md` are updated.
9. Money is in US dollars (USD) only, for now. Every table that stores money has a `currency` column (default `USD`, constant `DEFAULT_CURRENCY` in `apps/server/src/database/enums/currency.ts`). Never write a currency symbol by hand: the website formats money with `formatMoney` from `apps/client/lib/money.ts`, and the seller app uses its one money formatter in `lib/shared/format/`. A new table that stores money must get a `currency` column in the same migration. Another currency is added later by changing those two helpers and passing each row's `currency`, not by touching every screen.
10. Money has cents. Amounts have at most 2 decimals, are always shown with 2 decimals (`$192.20`), and every calculation rounds to cents with the shared helper: `tidy` (`apps/server/src/shared/utils/money.util.ts`) on the server, `roundMoney` (`apps/client/lib/money.ts`) on the website, and the same rule in the seller app. Never add, multiply or compare raw money numbers without it. `apps/server/docs/testing/money_precision_test.py` must pass after any change to prices, totals, commission, payments, returns or refunds.
11. Buyer app lives in `apps/buyer_app` (Flutter, Android and iOS, one codebase, same monorepo). It uses the existing buyer API under `/v1/api/user` and follows the order in `apps/buyer_app/ROADMAP.md`. No second app, no separate repo.
12. Buyer app code follows the same shape as the seller app (rule 6): one folder per feature under `lib/features/<feature>/` (`data/`, `state/`, `ui/`, `widgets/`), shared code in `lib/shared/` or `lib/core/`, a feature never imports another feature directly, small files (~200 lines) and small functions, no code generation, all server paths for a feature in one `data/<feature>_api.dart`, no magic numbers or colours in screens (`core/theme`), comment the why not the what. Its theme follows the website's catalogue redesign (serif display face, ink/dove/teal/brass palette, hairline plates, honest lot numbers) — not the seller app's plain icon-led look, since browsing birds should feel premium rather than utilitarian.
13. `apps/buyer_app/FEATURES.md` is the map of what lies where, same shape as the seller app's (rule 7): for each feature, its folder, server routes, website page and status. Any change that adds, moves, renames or removes a feature or screen updates `FEATURES.md` in the same commit. A feature is not done until its row is accurate.
14. A buyer app feature is done only when: it matches its guide in `apps/server/docs/user/` (or the website page when no guide exists), `flutter analyze` shows no issues, its tests pass, and `FEATURES.md` and `ROADMAP.md` are updated.
