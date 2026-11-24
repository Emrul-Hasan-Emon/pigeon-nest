# Admin Category API Guide

Admin management of **Categories** — the self-referencing tree used to classify seller
products. Base URL: `/api/v1/categories`. Requires an **admin** bearer token (`401` with
none, `403` with a seller/buyer token).

```
Authorization: Bearer <admin access token>
```

---

## Table of contents

- [1. Fields](#1-fields)
- [2. List — `GET /categories`](#2-list--get-categories)
- [3. Create — `POST /categories`](#3-create--post-categories)
- [4. Update — `PATCH /categories/{id}`](#4-update--patch-categoriesid)
- [5. Delete — `DELETE /categories/{id}`](#5-delete--delete-categoriesid)
- [6. No retrieve, by design](#6-no-retrieve-by-design)
- [7. Parent chain — `GET /categories/parent-chain`](#7-parent-chain--get-categoriesparent-chain)
- [8. Tree — `GET /categories/tree`](#8-tree--get-categoriestree)
- [9. Errors](#9-errors)

---

## 1. Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | |
| `name` | string | Required. Unique across all categories (case-insensitive). |
| `slug` | string | **Read-only.** Generated from `name` on create, regenerated whenever `name` genuinely changes. Never sent by the client. |
| `description` | string, nullable | Optional. |
| `parentId` | integer, nullable | Another category's id. Omit on `PATCH` to leave the current parent alone; send `null` to detach to top-level. A change that would create a cycle (including setting a category as its own parent) is rejected. |
| `image` | file (write-only, multipart only) | Optional. Sending one replaces the old file and deletes it from storage. |
| `imagePath` / `imageUrl` | string, nullable | **Read-only.** `null` until an image is uploaded. |
| `sortOrder` | integer | Default `0`. Drives list ordering within the same parent. |
| `isActive` | boolean | Default `true`. |
| `createdAt` / `updatedAt` | ISO datetime | From the shared audit base — also includes `createdBy`/`creatorType`/`creatorName`/`updatedBy`/`updaterType`/`updaterName`, all `null` until an authenticated-actor write path sets them. |

## 2. List — `GET /categories`

Limit/offset pagination (`?limit=&offset=`, default `limit=20`, `offset=0`). Ordered by
`sortOrder`, then `name`.

| Query param | What it does |
|---|---|
| `search` | Case-insensitive substring match on `name`. |
| `isActive` | `true` / `false` — exact match. |

```
GET /api/v1/categories?search=elec&isActive=true
```
```json
{
  "count": 1,
  "results": [
    { "id": 1, "name": "Electronics", "slug": "electronics", "description": null,
      "parentId": null, "imagePath": null, "imageUrl": null,
      "sortOrder": 0, "isActive": true, "createdAt": "...", "updatedAt": "..." }
  ]
}
```

## 3. Create — `POST /categories`

Multipart (`multipart/form-data`) if sending an image, JSON otherwise.

```json
POST /api/v1/categories
{ "name": "Electronics" }
```
→ `201`, `"slug": "electronics"`, `"isActive": true`, `"parentId": null`.

Nested under a parent:
```json
POST /api/v1/categories
{ "name": "Mobiles", "parentId": 1 }
```

With an image (multipart fields: `name`, `parentId`, `sortOrder`, `isActive` as strings,
plus `image` as a file):
```
POST /api/v1/categories
Content-Type: multipart/form-data
  name=Fashion
  image=<file>
```

- `name` missing/empty → `400`.
- `name` already used by another category (case-insensitive) → `400`.
- `parentId` does not exist → `400`.

## 4. Update — `PATCH /categories/{id}`

Partial update, same body shape as create (all fields optional). Renaming regenerates the
slug; saving without changing `name` keeps the existing slug.

```json
PATCH /api/v1/categories/2
{ "name": "Mobile Phones" }
```
→ `"slug": "mobile-phones"`.

Moving to a different parent:
```json
PATCH /api/v1/categories/2
{ "parentId": 5 }
```

Detaching to top-level:
```json
PATCH /api/v1/categories/2
{ "parentId": null }
```

Replacing the image: multipart `PATCH` with a new `image` file — the old file is deleted
from storage first. Unknown id → `404`.

## 5. Delete — `DELETE /categories/{id}`

> **Switched off for now:** this route answers `404 Cannot DELETE`. Set the category inactive instead. The rules below apply when it is switched back on.

`204`, no body. Also deletes the image file from storage, if one was uploaded.

- Unknown id → `404`.
- Category has a sub-category → `409`, not deleted.
- Category is still referenced by a seller product → `409`, not deleted.

**Deactivate** (`isActive: false`) instead of deleting one that's ever been used.

## 6. No retrieve, by design

There's no working `GET /categories/{id}` — it returns `405`. The list row already carries
every field there is. To show a category with its ancestors (breadcrumb), use the
parent-chain endpoint below.

## 7. Parent chain — `GET /categories/parent-chain`

Resolves one or more categories' full ancestor chain in one call — for breadcrumbs
("Electronics > Mobiles > Smartphones").

```
GET /api/v1/categories/parent-chain?categoryIds=1,2
```

| Param | Required | Notes |
|---|---|---|
| `categoryIds` | Yes | Comma-separated ids (e.g. `1,2,3`). Unknown or non-numeric ids are silently skipped. |

Response — an array, one entry per found category, each with its own fields plus a
`parents` array ordered **top-level ancestor first, immediate parent last**. A top-level
category gets `"parents": []`.

```json
[
  {
    "id": 2, "name": "Mobiles", "slug": "mobiles", "parentId": 1, "...": "...",
    "parents": [
      { "id": 1, "name": "Electronics", "slug": "electronics", "parentId": null, "...": "..." }
    ]
  }
]
```

Missing/empty `categoryIds` → `400`.

## 8. Tree — `GET /categories/tree`

Returns the whole category hierarchy as a nested tree — built for rendering the tree
picker when creating a category or changing its parent. **Not paginated.**

```
GET /api/v1/categories/tree?categoryName=
```

| Query param | Notes |
|---|---|
| `categoryName` | Optional. Case-insensitive substring match on `name`. |

Filtering behavior for `categoryName` — this prunes the tree, it doesn't flatten it:
- Any category whose name contains the search text is a match.
- Every match's ancestor path is kept (so you can see where it sits).
- Every match's full descendant subtree is kept.
- Anything not connected to a match that way is dropped.

Response — an array of root categories, each with a `children` array of the same shape,
recursively:

```json
[
  {
    "id": 1, "name": "Electronics", "slug": "electronics", "parentId": null, "...": "...",
    "children": [
      { "id": 2, "name": "Mobiles", "slug": "mobiles", "parentId": 1, "...": "...", "children": [] }
    ]
  }
]
```

## 9. Errors

| Case | Status |
|---|---|
| No token | `401` |
| Seller or buyer token | `403` |
| Missing/empty `name` on create | `400` |
| Duplicate `name` (case-insensitive) | `400` |
| `parentId` does not exist | `400` |
| `parentId` equal to the category's own id | `400` |
| `parentId` change that creates a circular chain | `400` |
| Unknown id (update/delete) | `404` |
| `GET` on the detail route (`/categories/{id}`) | `405` |
| Deleting a category with a sub-category, or still referenced by a product | `409` |
| Missing/empty `categoryIds` on parent-chain | `400` |
