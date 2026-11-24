# Delete is switched off (for now)

Deleting is switched off in the **seller portal** and the **admin panel**. No Delete button is shown, and the delete routes on the server are commented out. A request to one of them answers `404 Cannot DELETE ...`.

To bring it back: set `DELETE_ENABLED = true` in `apps/client/lib/features.ts`, and remove the comment marks from the routes below (each is marked "Delete is switched off for now").

## Routes switched off

| Role | Route | What it deleted |
|---|---|---|
| Admin | `DELETE /admin/products/:id` | A product (soft delete) |
| Admin | `DELETE /admin/products/:id/skus/:skuId/parents/sire\|dam` | A bird's father or mother |
| Admin | `DELETE /admin/categories/:id` | A category |
| Admin | `DELETE /admin/collections/:id` | A collection |
| Admin | `DELETE /admin/attributes/:id` | An attribute |
| Admin | `DELETE /admin/attribute-values/:id` | An attribute value |
| Admin | `DELETE /admin/banners/:id` | A banner |
| Admin | `DELETE /admin/homepage/sections/:id` | A homepage section |
| Admin | `DELETE /admin/payment-gateways/:id` | A payment gateway |
| Admin | `DELETE /admin/shipping-zones/:id` | A shipping zone |
| Admin | `DELETE /admin/users/:userId/addresses/:id` | A customer's saved address |
| Admin | `DELETE /admin/review/replies/:id` | A review reply |
| Seller | `DELETE /seller/products/:id` | A product (soft delete) |
| Seller | `DELETE /seller/products/:id/skus/:skuId/parents/sire\|dam` | A bird's father or mother |
| Seller | `DELETE /seller/review/replies/:id` | A review reply |

## Still on (customer actions)

Removing a cart item or a cart, removing a wishlist item, deleting your own address, review or reply, and removing a "helpful" vote are customer actions and still work.

## What to use instead

- **Product:** switch it off (Inactive). An admin can also suspend or reject it.
- **Banner, gateway, homepage section, collection, attribute:** switch it off or set it inactive.
- **Father or mother:** save a new name, ring number or photo over the old one. There is no way to clear one for now.
- **Review reply:** edit it. Moderators can hide it.
