# Task Tracker

Each task breaks into Backend / Frontend / QA. Mark a part `[x]` when told it's done.

## Category Management in Admin

Admin CRUD for the Category tree (create, list, update, delete), parent-chain
breadcrumb lookup, and a nested tree endpoint for the parent picker. Guarded by
admin-only auth. Reference: `apps/server/docs/admin/api/category-api-guide.md`,
Postman: `apps/server/postman/admin/category.postman_collection.json`, frontend
prompt: `apps/server/prompt/admin/category-management-frontend-prompt.md`.

- [x] Backend
- [ ] Frontend
- [ ] QA

## Collection & Attribute/Attribute-Value Management in Admin

Admin CRUD for Collections (badges like "New Arrival", "Sale") and for
Attributes with their Attribute Values (e.g. Color: Red/Blue/Green), the
building blocks for product variants. Guarded by admin-only auth. Idea
borrowed from `/Users/emrulhasan/Github/jabaib-group`, adapted to pigeon-nest's
existing `Collection`/`Attribute`/`AttributeValue` entities. Now grouped with
Category under Catalog: `apps/server/src/catalog/{category,collection,attribute}`,
frontend `apps/client/app/admin/catalog/{categories,collections,attributes}`.

- [x] Backend
- [x] Frontend
- [ ] QA

## Seller Management in Admin

Admin can create, update, list (cursor-paginated, with search/status/activeStatus
filters) and view seller details. Each seller carries `nidFrontImagePath`/
`nidFrontImageUrl` and `nidBackImagePath`/`nidBackImageUrl` for NID image
uploads, plus a `status` (`pending`/`approved`/`rejected`). A seller created
by an admin is always `approved` and `activeStatus: active`. Endpoints:
`apps/server/src/seller` (`/sellers`, `/sellers/:id`). Frontend:
`apps/client/app/admin/sellers` (list with cursor "Load more", create, edit).

- [x] Backend
- [x] Frontend
- [ ] QA

## Product Management in Admin (Seller Products)

Admin creates/manages products on behalf of sellers (multi-vendor: admin picks
an approved + active seller per product). Entities: `SellerProduct` /
`SellerProductSku` / `SellerProductSkuVariant` / `SellerProductMedia` (idea
adapted from `/Users/emrulhasan/Github/jabaib-group`'s product/SKU/variant
split). SKU variants are manually assigned attribute/value pairs (no
auto-generated combination matrix); SKU code and variants are immutable after
creation. Six endpoints in `apps/server/src/catalog/product`:
`GET /products` (cursor list with seller info), `GET /products/:id` (seller,
all SKUs, all media), `POST /products` (JSON, creates the product with its
SKUs), `PATCH /products/:id` (JSON; product fields plus `skus[]` — entries with
`id` update, without `id` create — and `removeSkuIds[]` which soft-deletes),
`PATCH /products/:id/media-files` (multipart: `thumbnailImage`,
`removeThumbnail`, `mediaFiles[]`, `removeMediaFilesIds`), `DELETE /products/:id`
(soft). A product must keep at least one SKU. Frontend:
`apps/client/app/admin/catalog/products` (list, create with SKU editor +
optional media, read-only detail, edit with one-save SKU changes and a media
manager).

- [x] Backend
- [x] Frontend
- [ ] QA

<!-- Add new tasks above this line, newest first -->

## Seller Auth, Registration & Approval

Sellers register themselves with an international phone number (stored in
E.164, e.g. `+8801712345678`; multiple countries supported) and are created
`pending` + `inactive`. They can log in at any status. `isActive` was replaced
by `activeStatus` (`active`/`inactive`/`suspended`). Access rules: approved +
active = everything; pending / rejected / approved-but-inactive = profile and
password changes only; suspended = nothing (login and reading own status still
work). A rejected seller who edits their profile goes back to `pending` (a
password change does not count). Sellers can never change `status` or
`activeStatus`; only admins can. Admin reviews registrations in a pending list
and approves (approved + active) or rejects (rejected + inactive, optional
reason shown to the seller). The access check re-reads the seller on every
request, so admin changes apply to tokens already issued. Endpoints:
`/v1/api/seller/auth/{login,register}`, `/v1/api/seller/profile[/password]`,
`/v1/api/admin/seller-requests[/:id/{approve,reject}]`. Frontend: seller
portal `apps/client/app/seller/{login,register,profile}`, admin
`app/admin/sellers/requests`, per-role API clients in `lib/api/http.ts`
(`NEXT_PUBLIC_API_BASE_URL` is now the versioned root `.../v1/api`).

- [x] Backend
- [x] Frontend
- [ ] QA
