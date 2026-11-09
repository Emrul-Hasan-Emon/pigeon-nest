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
