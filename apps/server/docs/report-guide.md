# Reports

Four reports, same shape for admin and seller. Module: `src/report/` (`admin-report` and `seller-report` controllers and services, shared queries in `common-report.service.ts`).

## Endpoints

| Role | Base path | Guard |
| --- | --- | --- |
| Seller | `GET /seller/reports/{sales,products,orders,earnings}` | seller token, access `any` (a suspended seller can still read their own record) |
| Admin | `GET /admin/reports/{sales,products,orders,earnings}` | admin token; optional `sellerId` narrows to one seller |

A seller cannot send `sellerId` (400, "property sellerId should not exist"). Every seller query is fixed to the signed-in seller.

## Query

- `from`, `to`: `YYYY-MM-DD`, both days included. Default: last 30 days. Max 366 days. `from` after `to` or a date like `2026-02-31` is a 400.
- `groupBy`: `day` (default) or `month`. Sales and earnings only. Day grouping leaves out days with nothing; month grouping always lists every month.
- `kind`: `best` (default), `slow`, `low`. Products only. `low` ignores the dates (stock now).

## Response (all four)

```json
{ "title": "Sales", "note": "plain-words meaning", "from": "2026-11-01", "to": "2026-11-30",
  "summary": [{ "label": "Sales", "value": 6400, "kind": "money" }],
  "columns": [{ "key": "period", "label": "Day", "kind": "text" }],
  "rows": [{ "period": "2026-11-22", "sales": 38400 }] }
```

`kind` is `text | number | money | percent | hours`. One screen and one CSV writer show every report.

## What the numbers mean

Same rules as the dashboards. A sale is a paid, not cancelled order, counted on the day it was placed. A refund is a return that reached `returned`, counted on the day it was confirmed.

- **Sales:** orders placed, paid orders, sales, refunds, sales after refunds.
- **Products:** best = most revenue (paid lines, not returned); slow = products on sale that sold least, with "last sold"; low = active options with 5 or fewer in stock (`LOW_STOCK_AT`). Up to 100 rows.
- **Orders:** count and share per status, returned count, average hours from confirmed to delivered.
- **Earnings:** sales, system commission, refunds, system commission given back, and what the seller keeps = seller share - (refunds - system commission given back).

## CSV

Built in the browser from the same JSON (`lib/csv.ts`), so the file always matches the screen. It starts with a byte-order mark for Excel, and cells beginning with `= + - @` get a leading apostrophe.
