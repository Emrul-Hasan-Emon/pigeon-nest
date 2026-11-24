#!/usr/bin/env python3
"""Black-box tests: the admin and seller dashboards. A fresh seller gets a known set of orders and returns, and every
figure is compared with one worked out here from prices and rules: sales, refunds, net, commission, seller earnings,
averages, return rate, status counts, top products, to-do counts, balance, reviews and the day-by-day series. Also the
ranges, the comparison with the period before, who may call what, and that a seller sees only their own numbers.
The admin figures are checked as the change the scenario caused, since the platform holds other data."""
import datetime, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "returns_test.py")).read().split("# ============================================================ S  settings")[0]
_src = _src.replace('"T Ret"', '"T Dsh"').replace("t-ret-", "t-dsh-").replace("tret{RUN}", "tdsh{RUN}")
_anchor = "    sql(f\"delete from order_update where"
assert _anchor in _src
_src = _src.replace(_anchor, "    sql(f\"delete from review where \\\"orderId\\\" in ({ids})\")\n" + _anchor, 1)
exec(compile(_src, "returns_test_prelude", "exec"))

AD, SD = "/admin/dashboard", "/seller/dashboard"


def near(a, b):
    return abs(float(a) - float(b)) < 0.0049


def sdash(tok=None, q=""):
    return call("GET", SD + q, tok or S1)


def adash(q=""):
    return call("GET", AD + q, ADMIN)


call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": "percentage", "commission.amount": 10, "returns.windowDays": 0, "returns.refundDeliveryCharge": True}})

# ---------------------------------------------------------------- before: the platform snapshot, and a seller with nothing
c, a0 = adash()
c, s0 = sdash()
truth("a new seller starts with nothing", s0["totals"]["orders"]["placed"] == 0 and s0["totals"]["grossSales"] == 0 and s0["balance"] == {"total": 0, "due": 0, "paid": 0} and s0["reviews"] == {"count": 0, "average": None} and s0["topProducts"] == [], s0["totals"])

# ---------------------------------------------------------------- the scenario (global rule 10%, delivery 100)
# A: 3200 + 3800 + 100 delivered, paid; the 3800 line is returned in full.   comm 700, line comm 380 comes back
# B: 2 x 6500 + 100, paid, still pending.                                    comm 1300
# C: 3200 + 100 delivered, paid; a return of its line is requested.          comm 320
# D: 3200 + 100 placed, not paid.                                            not a sale
# E: 3800 + 100 placed, then cancelled.                                      not a sale
OA = make_order(((119, 1), (120, 1)))
OB = make_order(((121, 2),), delivered=False)
OC = make_order(((119, 1),))
OD = make_order(((119, 1),), paid=False, delivered=False)
OE = make_order(((120, 1),), paid=False, delivered=False)
c, d = call("PATCH", f"{A}/{OE['id']}/status", ADMIN, {"status": "cancelled"})
assert c == 200, d
ia = items_of(OA["id"])
c, ra = req(OA["id"], "items", [ia[1]])
full_cycle(ra["id"])
c, rc = req(OC["id"], "items", items_of(OC["id"])[:1])
assert c == 201, rc
# review on a delivered line of A
c, rv = multi("POST", "/user/review", USER, {"orderItemId": ia[0], "rating": 4, "title": "Fine", "comment": "Good bird"})
assert c == 201, rv
sql("update seller_product_sku set quantity=3 where id=120")
sql("update seller_product_sku set quantity=0 where id=121")

# ============================================================ S  seller dashboard
print("--- seller dashboard")
c, s = sdash()
check("S the seller dashboard opens", (c, s), 200)
t = s["totals"]
truth("S orders placed 5, paid 3, delivered 2, cancelled 1", t["orders"] == {"placed": 5, "paid": 3, "delivered": 2, "cancelled": 1}, t["orders"])
truth("S sales = paid orders: 7100 + 13100 + 3300 = 23500", near(t["grossSales"], 23500), t["grossSales"])
truth("S refunds: one return of 3800", t["refunds"]["count"] == 1 and near(t["refunds"]["amount"], 3800), t["refunds"])
truth("S net sales = 23500 - 3800 = 19700", near(t["netSales"], 19700), t["netSales"])
truth("S average order = 23500 / 3 paid", near(t["averageOrder"], 7833.33), t["averageOrder"])
truth("S commission earned 700 + 1300 + 320 = 2320, 380 came back, 1940 net", near(t["commission"]["earned"], 2320) and near(t["commission"]["returned"], 380) and near(t["commission"]["net"], 1940), t["commission"])
truth("S seller earnings = (6400 + 11800 + 2980) - (3800 - 380) = 17760", near(t["sellerEarnings"], 17760), t["sellerEarnings"])
truth("S return rate: 2 of 3 paid orders have a return (open or finished)", near(t["returnRate"], 66.7), t["returnRate"])
truth("S nothing to compare with yet", all(v is None for v in t["change"].values()), t["change"])
truth("S orders by status: 2 pending (B, D), 2 delivered, 1 cancelled", {x["status"]: x["count"] for x in s["ordersByStatus"]} == {"pending": 2, "confirmed": 0, "packed": 0, "shipped": 0, "delivered": 2, "cancelled": 1}, s["ordersByStatus"])
truth("S every status is listed, in order", [x["status"] for x in s["ordersByStatus"]] == ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"])
truth("S top product: lines of paid orders that were not returned (3200 + 13000 + 3200)", len(s["topProducts"]) == 1 and s["topProducts"][0]["id"] == 94 and near(s["topProducts"][0]["revenue"], 19400) and s["topProducts"][0]["units"] == 4, s["topProducts"])
at = s["attention"]
truth("S to-do: 2 orders to confirm, a return request waiting", at["ordersToConfirm"] == 2 and at["returnRequests"] == 1 and at["returnsInProgress"] == 0 and at["ordersToPack"] == 0 and at["ordersToShip"] == 0 and at["ordersOnTheWay"] == 0, at)
truth("S to-do: one SKU low (3 left), one out of stock", at["lowStockSkus"] == 1 and at["outOfStockSkus"] == 1 and at["lowStockAt"] == 5, at)
truth("S to-do: no offers, no products waiting, the one review has no reply", at["offersWaiting"] == 0 and at["productsPending"] == 0 and at["reviewsUnanswered"] == 1, at)
c, att = call("GET", SD + "/attention", S1)
check("S the seller's alert-bell endpoint returns the same to-do counts as the dashboard", (c, att), 200, pred=lambda v: v == s["attention"])
check("S attention: no token -> 401", call("GET", SD + "/attention"), 401)
check("S attention: admin token -> 403", call("GET", SD + "/attention", ADMIN), 403)
check("S attention: another seller sees their own (nothing waiting)", call("GET", SD + "/attention", S2), 200, pred=lambda v: v["ordersToConfirm"] == 0 and v["returnRequests"] == 0)
truth("S commission balance = 1940 owed, none paid", s["balance"] == {"total": 1940, "due": 1940, "paid": 0}, s["balance"])
truth("S balance agrees with the ledger table", near(bal(SID1)[0], s["balance"]["total"]) and near(bal(SID1)[1], s["balance"]["due"]))
truth("S reviews: one, average 4", s["reviews"] == {"count": 1, "average": 4}, s["reviews"])
pr = s["products"]
cnt = lambda w: int(sql(f'select count(*) from seller_product where "sellerId"={SID1} and "deletedAt" is null' + (f" and {w}" if w else "")))
truth("S products block agrees with the table", pr["totalProducts"] == cnt("") and pr["visibleProducts"] == cnt("status='approved' and \"activeStatus\"='active'") and pr["lockedProducts"] == cnt("status='rejected' or \"activeStatus\"='suspended'") and pr["status"]["approved"] + pr["status"]["pending"] + pr["status"]["rejected"] == pr["totalProducts"] and pr["activeStatus"]["active"] + pr["activeStatus"]["inactive"] + pr["activeStatus"]["suspended"] == pr["totalProducts"], pr)
truth("S one stock figure: the product block and the to-do list agree", pr["outOfStockSkus"] == s["attention"]["outOfStockSkus"] == 1 and pr["totalSkus"] == int(sql(f'select count(*) from seller_product_sku k join seller_product p on p.id=k."sellerProductId" where p."sellerId"={SID1} and p."deletedAt" is null and k."deletedAt" is null')), (pr, s["attention"]))
truth("S pending products in the to-do list = the product block", s["attention"]["productsPending"] == pr["status"]["pending"])
wl = s["wishlist"]
truth("S wishlist demand is part of the same response and agrees with the table", wl["products"] == pr["totalProducts"] and wl["totalSaves"] == int(sql(f'select coalesce(sum("wishlistCount"),0) from seller_product where "sellerId"={SID1} and "deletedAt" is null')) and len(wl["top"]) <= 5, wl)
c, ins = call("GET", "/seller/wishlist/insights?limit=5", S1)
truth("S ...and equals what the wishlist page endpoint returns", wl == ins, (wl, ins))
other = sdash(S2)[1]
truth("S another seller's products and wishlist are their own", other["products"]["totalProducts"] == int(sql(f'select count(*) from seller_product where "sellerId"={SID2} and "deletedAt" is null')) and other["products"]["totalSkus"] == int(sql(f'select count(*) from seller_product_sku k join seller_product p on p.id=k."sellerProductId" where p."sellerId"={SID2} and p."deletedAt" is null and k."deletedAt" is null')) and other["products"]["outOfStockSkus"] == 0 and other["wishlist"]["products"] == other["products"]["totalProducts"], (other["products"], pr))
today = datetime.date.today().isoformat()
sr = s["series"]
truth("S series: 30 daily points, oldest first, ending today", len(sr) == 30 and [p["date"] for p in sr] == sorted({p["date"] for p in sr}) and sr[-1]["date"] == today, (len(sr), sr[-1]["date"], today))
truth("S series adds up to the totals", sum(p["orders"] for p in sr) == 5 and sum(p["paidOrders"] for p in sr) == 3 and near(sum(p["grossSales"] for p in sr), 23500) and near(sum(p["refunds"] for p in sr), 3800) and near(sum(p["netSales"] for p in sr), 19700))
truth("S today's point holds all of it, the other days are zero", sr[-1]["orders"] == 5 and near(sr[-1]["netSales"], 19700) and all(p["orders"] == 0 and p["grossSales"] == 0 for p in sr[:-1]))
truth("S the window dates are returned", s["range"] == "30d" and s["bucket"] == "day" and s["from"] < s["to"])
truth("S the seller sees nothing of another seller", sdash(S2)[1]["totals"]["orders"]["placed"] == 0 and sdash(S2)[1]["balance"]["total"] == 0 and sdash(S2)[1]["attention"]["ordersToConfirm"] == 0)

# ============================================================ R  ranges
print("--- ranges")
for rng, n, bucket in (("7d", 7, "day"), ("30d", 30, "day"), ("90d", 90, "day"), ("12m", 12, "month")):
    c, x = sdash(None, f"?range={rng}")
    check(f"R seller {rng}: {n} {bucket} points, same totals", (c, x), 200, pred=lambda v, n=n, bucket=bucket: len(v["series"]) == n and v["bucket"] == bucket and v["totals"]["orders"]["placed"] == 5 and near(v["totals"]["netSales"], 19700))
    c, x = adash(f"?range={rng}")
    check(f"R admin {rng}: {n} {bucket} points", (c, x), 200, pred=lambda v, n=n, bucket=bucket: len(v["series"]) == n and v["bucket"] == bucket)
c, x = sdash(None, "?range=12m")
truth("R 12m points are the first of each month, the last is this month", all(p["date"].endswith("-01") for p in x["series"]) and x["series"][-1]["date"] == today[:8] + "01", [p["date"] for p in x["series"]][-2:])
check("R default range is 30 days", sdash(), 200, pred=lambda v: v["range"] == "30d")
check("R an unknown range -> 400", sdash(None, "?range=1y"), 400)
check("R an unknown query field -> 400", sdash(None, "?from=2026-01-01"), 400)
check("R admin: an unknown range -> 400", adash("?range=x"), 400)

# ============================================================ P  the period before
print("--- comparison with the period before")
sql(f"update \"order\" set \"createdAt\" = \"createdAt\" - interval '35 days' where id={OC['id']}")
c, s = sdash()
t = s["totals"]
truth("P C moved out of this 30 days: placed 4, sales 20200", t["orders"]["placed"] == 4 and t["orders"]["paid"] == 2 and near(t["grossSales"], 20200), t)
truth("P and into the 30 days before: placed +300%", near(t["change"]["orders"], 300.0), t["change"])
truth("P sales change = (20200 - 3300) / 3300 = 512.1%", near(t["change"]["grossSales"], 512.1), t["change"])
truth("P paid orders change = (2 - 1) / 1 = 100%", near(t["change"]["paidOrders"], 100.0), t["change"])
truth("P net sales change = (16400 - 3300) / 3300 = 397.0%", near(t["netSales"], 16400) and near(t["change"]["netSales"], 397.0), (t["netSales"], t["change"]))
truth("P the series for 30 days no longer holds C", sum(p["orders"] for p in s["series"]) == 4)
c, w = sdash(None, "?range=7d")
truth("P 7 days: same 4 orders, the one 35 days ago is out", w["totals"]["orders"]["placed"] == 4)
c, y = sdash(None, "?range=90d")
truth("P 90 days: all 5 orders again", y["totals"]["orders"]["placed"] == 5 and near(y["totals"]["grossSales"], 23500))
sql(f"update \"order\" set \"createdAt\" = \"createdAt\" + interval '35 days' where id={OC['id']}")

# ============================================================ A  admin dashboard
print("--- admin dashboard")
c, a1 = adash()
check("A the admin dashboard opens", (c, a1), 200)
t0, t1 = a0["totals"], a1["totals"]
d = lambda f: f(t1) - f(t0)
truth("A platform orders +5, paid +3, delivered +2, cancelled +1", d(lambda t: t["orders"]["placed"]) == 5 and d(lambda t: t["orders"]["paid"]) == 3 and d(lambda t: t["orders"]["delivered"]) == 2 and d(lambda t: t["orders"]["cancelled"]) == 1)
truth("A platform sales +23500, refunds +3800, net +19700", near(d(lambda t: t["grossSales"]), 23500) and near(d(lambda t: t["refunds"]["amount"]), 3800) and d(lambda t: t["refunds"]["count"]) == 1 and near(d(lambda t: t["netSales"]), 19700))
truth("A platform commission earned +2320, returned +380, net +1940", near(d(lambda t: t["commission"]["earned"]), 2320) and near(d(lambda t: t["commission"]["returned"]), 380) and near(d(lambda t: t["commission"]["net"]), 1940))
truth("A net = gross - refunds on the platform too", near(t1["netSales"], t1["grossSales"] - t1["refunds"]["amount"]) and near(t1["commission"]["net"], t1["commission"]["earned"] - t1["commission"]["returned"]))
truth("A average order = sales / paid orders", near(t1["averageOrder"], t1["grossSales"] / t1["orders"]["paid"]))
truth("A the series add up to the totals", sum(p["orders"] for p in a1["series"]) == t1["orders"]["placed"] and near(sum(p["grossSales"] for p in a1["series"]), t1["grossSales"]) and near(sum(p["netSales"] for p in a1["series"]), t1["netSales"]))
truth("A orders by status: the scenario added 2 pending, 2 delivered, 1 cancelled", all(x["count"] - y["count"] == z for x, y, z in zip(a1["ordersByStatus"], a0["ordersByStatus"], (2, 0, 0, 0, 2, 1))))
truth("A orders by status add up to orders placed", sum(x["count"] for x in a1["ordersByStatus"]) == t1["orders"]["placed"])
truth("A the new seller is the top seller: 3 paid orders, 23500", a1["topSellers"][0]["id"] == SID1 and a1["topSellers"][0]["orders"] == 3 and near(a1["topSellers"][0]["grossSales"], 23500) and near(a1["topSellers"][0]["commission"], 2320), a1["topSellers"][:2])
truth("A top sellers are sorted by sales, at most 5", len(a1["topSellers"]) <= 5 and [x["grossSales"] for x in a1["topSellers"]] == sorted((x["grossSales"] for x in a1["topSellers"]), reverse=True))
truth("A top products are sorted by revenue, at most 5", len(a1["topProducts"]) <= 5 and [x["revenue"] for x in a1["topProducts"]] == sorted((x["revenue"] for x in a1["topProducts"]), reverse=True))
truth("A attention: one more return request", a1["attention"]["returnRequests"] - a0["attention"]["returnRequests"] == 1 and a1["attention"]["returnsInProgress"] == a0["attention"]["returnsInProgress"])
truth("A balances: +1940 total and due, paid unchanged, one more seller owing", near(a1["balances"]["total"] - a0["balances"]["total"], 1940) and near(a1["balances"]["due"] - a0["balances"]["due"], 1940) and near(a1["balances"]["paid"], a0["balances"]["paid"]) and a1["balances"]["sellersOwing"] - a0["balances"]["sellersOwing"] == 1, (a0["balances"], a1["balances"]))
truth("A the platform balance equals the sum of the seller balances", near(float(sql("select sum(\"dueCommission\") from system_commission")), a1["balances"]["due"]) and near(float(sql("select sum(\"totalCommission\") from system_commission")), a1["balances"]["total"]))
people = a1["people"]
truth("A people counts agree with the tables", people["customers"] == int(sql("select count(*) from \"user\" where \"deletedAt\" is null")) and people["sellers"] == int(sql("select count(*) from seller where \"deletedAt\" is null")) and people["liveProducts"] == int(sql("select count(*) from seller_product where \"deletedAt\" is null and status='approved' and \"activeStatus\"='active'")), people)
truth("A new people in the period are never above the totals", people["newCustomers"] <= people["customers"] and people["newSellers"] <= people["sellers"] and people["activeSellers"] <= people["sellers"])
truth("A pending seller approvals agree with the table", a1["attention"]["pendingSellers"] == int(sql("select count(*) from seller where \"deletedAt\" is null and status='pending'")))
truth("A delivered-but-unpaid agrees with the table", a1["attention"]["deliveredUnpaid"] == int(sql("select count(*) from \"order\" where \"deletedAt\" is null and status='delivered' and \"paymentStatus\"<>'paid'")))
c, att = call("GET", AD + "/attention", ADMIN)
check("A the alert-bell endpoint returns just the attention counts, equal to the dashboard's", (c, att), 200, pred=lambda v: v == a1["attention"])
check("A attention: no token -> 401", call("GET", AD + "/attention"), 401)
check("A attention: seller token -> 403", call("GET", AD + "/attention", S1), 403)
c, me = call("GET", "/admin/auth/me", ADMIN)
check("A /admin/auth/me says who is signed in", (c, me), 200, pred=lambda v: set(v) == {"id", "name", "email", "role", "imageUrl"} and v["email"] == os.environ.get("ADMIN_EMAIL", "test-admin@example.com") and "passwordHash" not in v)
check("A /admin/auth/me: seller token -> 403", call("GET", "/admin/auth/me", S1), 403)
check("A /admin/auth/me: no token -> 401", call("GET", "/admin/auth/me"), 401)
# a pending seller and a pending product raise the admin's to-do
sql(f"update seller set status='pending' where id={SID2}")
c, a2 = adash()
truth("A a seller waiting for approval raises the count by one", a2["attention"]["pendingSellers"] - a1["attention"]["pendingSellers"] == 1)
sql(f"update seller set status='approved' where id={SID2}")

# ============================================================ G  access
print("--- access")
check("G admin dashboard: no token -> 401", call("GET", AD), 401)
check("G admin dashboard: seller token -> 403", call("GET", AD, S1), 403)
check("G admin dashboard: customer token -> 403", call("GET", AD, USER), 403)
check("G seller dashboard: no token -> 401", call("GET", SD), 401)
check("G seller dashboard: admin token -> 403", call("GET", SD, ADMIN), 403)
check("G seller dashboard: customer token -> 403", call("GET", SD, USER), 403)
check("G seller dashboard: an edited token -> 401", call("GET", SD, S1[:-3] + "abc"), 401)
sql(f"update seller set \"activeStatus\"='inactive' where id={SID1}")
check("G seller dashboard: an inactive seller -> 403", sdash(), 403)
sql(f"update seller set \"activeStatus\"='active' where id={SID1}")
check("G ...and back to 200 when active again", sdash(), 200)
check("G the retired /overview path is gone", call("GET", "/seller/dashboard/overview", S1), 404)

# ============================================================ summary
if not os.environ.get("KEEP"):
    cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, dd)
sys.exit(1 if failed else 0)
