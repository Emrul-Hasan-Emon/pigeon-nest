# Prompt: Admin Category Management UI

Implement the **Category Management** page in the Admin panel (Next.js, `apps/client`),
backed by the pigeon-nest server API.

## Reference material

- API guide: `apps/server/docs/api-guide/admin/category-api-guide.md`
- Postman collection: `apps/server/postman/admin/category.postman_collection.json`
- Base URL: `/api/v1/categories`, admin bearer token required on every call.

## What to build

### 1. Category list page

- Table/list of categories: `name`, `slug`, parent name (resolve via the category's
  `parentId` against the already-loaded tree/list — don't call parent-chain per row),
  `sortOrder`, `isActive`, thumbnail (`imageUrl`).
- Controls: search box (debounced, hits `?search=`), active/inactive filter
  (`?isActive=`), pagination (`?limit=&offset=`, show total from `count`).
- Row actions: Edit, Delete, toggle active/inactive (PATCH `isActive`).

### 2. Create / Edit form (modal or page)

Fields: `name` (required), `description` (textarea), `parentId` (tree-picker — fetch
`GET /categories/tree` and render as an expandable tree select; exclude the category
itself and its own descendants from the picker when editing, since the API rejects a
cycle but the UI should prevent the dead-end selection up front), `image` (file input,
show current `imageUrl` as preview when editing, replacing it clears the old preview),
`sortOrder` (number), `isActive` (toggle).

Submit as `multipart/form-data` when an image file is attached, plain JSON otherwise.
On edit, only send fields that changed except `parentId`, which needs `null` sent
explicitly when the user detaches to top-level (not simply omitted).

### 3. Validation & error handling

Surface API errors inline, don't just toast a generic failure:
- `400` duplicate name → inline error under the name field.
- `400` invalid/cyclic parent → inline error under the parent picker, and re-fetch the
  tree so the picker reflects current state.
- `404` on update/delete of a row that's gone (e.g. deleted in another tab) → remove the
  row from the list and show a toast.
- `409` on delete (has sub-category or in-use by a product) → don't just block the
  action silently; show a dialog explaining why, and offer to deactivate
  (`isActive: false`) instead as the suggested alternative action.

### 4. Breadcrumb / ancestor display

Where a category needs to show its ancestors (e.g. in the edit form header, or a
product's category breadcrumb elsewhere in the admin panel), use
`GET /categories/parent-chain?categoryIds=1,2,...` — batch multiple ids into one call
instead of one request per category.

### 5. No detail route

There is no `GET /categories/{id}`. Never build the edit form by fetching a single
category — populate it from the row data already in the list/tree in memory.

## Out of scope for this task

- Seller-facing or public category browsing (separate guides/endpoints, not covered
  here).
- Bulk import/export.
- Drag-and-drop reordering (ship `sortOrder` as a plain number input first; revisit if
  asked for).
