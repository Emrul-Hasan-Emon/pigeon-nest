# Dashboards

`GET /v1/api/admin/dashboard?range=` for admins (whole platform) and `GET /v1/api/seller/dashboard?range=` for approved, active sellers (their own data only). One call per dashboard returns every figure on the page. `range` is `7d`, `30d` (default), `90d` or `12m`. The period before, of the same length, is the comparison. The old product-count endpoint and `/seller/dashboard/overview` are gone: product counts and wishlist demand are now part of this response.

Code: `src/dashboard/`. One shared `CommonDashboardService` runs the queries (with an optional seller id), `AdminDashboardService` and `SellerDashboardService` add what is specific to each role, and each role has its own controller.

## What the numbers mean

| Figure | Definition |
|---|---|
| Sales | `payableAmount` of orders that are fully paid and not cancelled, counted on the day the order was placed |
| Refunds | `refundAmount` of returns that reached `returned`, counted on the day they were confirmed |
| Net sales | Sales - refunds |
| Average order | Sales / paid orders |
| System commission earned | `systemCommission` of those paid orders |
| System commission returned | `commissionAmount` of the returns confirmed in the period |
| Net system commission | Earned - returned |
| You keep (seller) | `sellerAmount` of those paid orders - (refunds - system commission returned) |
| Return rate | Paid orders in the period with a return that is not cancelled or rejected, as a share of paid orders |
| Top products | Lines of paid, not cancelled orders, returned lines left out, by revenue |
| Change | Percent against the period before, `null` when that period had nothing |

Counts under "Needs attention" and "To do" are live, whatever the period. System commission owed is the current balance (`system_commission`), not a period figure.

## Response

Both: `range`, `from`, `to`, `bucket` (`day`, or `month` for 12m), `totals`, `series` (one point per bucket, zeros included), `ordersByStatus` (all six statuses), `topProducts`.

Admin adds `topSellers`, `people`, `attention`, `balances`. Seller adds `attention` (orders to confirm, pack, ship, returns, offers, stock, reviews), `balance`, `reviews`, `products` (counts by review state and activity, SKU totals) and `wishlist` (same figures as `GET /seller/wishlist/insights`, top 5).

SKU stock is counted once: `products.outOfStockSkus` and `attention.outOfStockSkus` are the same figure. Out of stock and low stock only count SKUs that are switched on.

Tests: `testing/dashboard_test.py` (82 checks, every figure worked out independently).
