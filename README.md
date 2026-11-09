# Pigeon Nest

Multi-vendor ecommerce platform for buying and selling pigeons.

## Stack

- Monorepo (pnpm workspaces)
- Client: Next.js — `apps/client`
- Server: NestJS — `apps/server`
- Database: PostgreSQL

## Rules

Must-follow project rules live in [rules.md](rules.md), appended over time. Read it before doing anything.

## Dev setup

```bash
pnpm install
docker compose up -d        # Postgres on :5432
cp apps/server/.env.example apps/server/.env
pnpm dev:client              # Next.js on :3000
pnpm dev:server              # NestJS on :3000 (change PORT if conflicting)
```

## Reference

- Database design based on prior single-vendor project `jabaib-group`, adapted for multi-vendor:
  - `Product` → `ShopProduct`, `ProductSKU` → `ShopProductSku`, etc. — all product tables scoped to a `Shop`.
  - `Order` and `Cart` carry a direct `shopId` (no separate sub-order table — one order belongs to one shop).
  - New tables: `Shop`, `ShopPayout`.
