#!/usr/bin/env python3
"""Money precision audit. Prices with cents (192.23, 171.37, 49.99, 19.95), a delivery charge with cents (7.35) and
a 7.5% / 10% commission, so every total has a fraction. Each expected amount is worked out here with exact decimal
arithmetic (round half up to cents), then compared with what the admin, seller and buyer APIs, the database, the
dashboard and the monthly statement show. Reuses the set-up of returns_money_test.py."""
import json, os, sys
from decimal import Decimal as D, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "returns_money_test.py")).read().split("EPS = 2.220446049250313e-16")[0]
_src = _src.replace("os.path.abspath(__file__)", repr(os.path.join(HERE, "returns_money_test.py"))).replace('"T Mny"', '"T Prc"').replace("t-mny-", "t-prc-").replace("tmny{RUN}", "tprc{RUN}")
exec(compile(_src, "prelude", "exec"))


def r2(x):
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def same(a, b):
    return r2(str(a)) == r2(str(b))


def model(lines, rate, delivery):
    """lines: [(unit payable, qty)] -> exact figures."""
    pay = [r2(D(str(u)) * q) for u, q in lines]
    com = [r2(p * D(str(rate)) / 100) for p in pay]
    sub = sum(pay, D(0))
    c = sum(com, D(0))
    payable = sub + D(str(delivery))
    return {"pay": pay, "com": com, "sell": [p - k for p, k in zip(pay, com)], "sub": sub, "commission": c, "payable": payable, "seller": payable - c}


def put(sku, price, disc=None):
    d = "null" if disc is None else str(disc)
    sql(f"update seller_product_sku set price={price}, \"discountedPrice\"={d}, \"discountedPriceStartDate\"=null where id={sku}")


def setrate(rate, kind="percentage"):
    call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": kind, "commission.amount": rate}})


def views(oid):
    out = {}
    for who, base, tok in [("admin", A, ADMIN), ("seller", SL, S1), ("buyer", "/user/order", USER)]:
        c, d = call("GET", f"{base}/{oid}", tok)
        assert c == 200, (who, c, d)
        out[who] = d
    return out


def check_totals(label, oid, m, paid=D(0)):
    for who, d in views(oid).items():
        t = d["totals"]
        truth(f"{label} {who} sees subtotal {m['sub']}", same(t["subtotal"], m["sub"]), t)
        truth(f"{label} {who} sees payable {m['payable']}", same(t["payable"], m["payable"]), t)
        truth(f"{label} {who} sees paid {paid} and balance {m['payable'] - paid}", same(t["amountPaid"], paid) and same(t["balanceDue"], m["payable"] - paid), t)
    row = sql(f"select subtotal||'|'||\"payableAmount\"||'|'||\"systemCommission\"||'|'||\"sellerAmount\" from \"order\" where id={oid}").split("|")
    truth(f"{label} db subtotal, payable, commission, seller amount", same(row[0], m["sub"]) and same(row[1], m["payable"]) and same(row[2], m["commission"]) and same(row[3], m["seller"]), row)
    lines = [r.split("|") for r in sql(f"select \"totalDiscountedPrice\"||'|'||\"systemCommission\"||'|'||\"sellerAmount\" from order_item where \"orderId\"={oid} order by id").split()]
    truth(f"{label} db line payable, commission, seller amount", all(same(l[0], p) and same(l[1], k) and same(l[2], s) for l, p, k, s in zip(lines, m["pay"], m["com"], m["sell"])), (lines, m))
    truth(f"{label} lines add up to the order", same(sum(D(l[1]) for l in lines), m["commission"]) and same(sum(D(l[0]) for l in lines), m["sub"]))


# ================= fixtures: awkward prices
put(119, "192.23", "171.37")
put(120, "49.99")
put(121, "19.95")
sql("update seller_product_sku set quantity=60 where id in (119,120,121)")
sql("update system_setting set value='7.35' where key='shipping.defaultCharge'")
setrate(7.5)

# ================= A  one order, two lines, 7.5%
oA = make_order(skus=((119, 3), (120, 7)), paid=False, delivered=False)
mA = model([("171.37", 3), ("49.99", 7)], "7.5", "7.35")
truth("A expected figures are what the hand sum says (514.11 + 349.93 = 864.04, + 7.35 = 871.39)", mA["sub"] == D("864.04") and mA["payable"] == D("871.39") and mA["commission"] == D("64.80"), mA)
check_totals("A", oA["id"], mA)
c, lst = call("GET", f"{A}?orderNumber={oA['orderNumber']}", ADMIN)
rows = lst.get("results") or lst.get("items") or lst.get("rows") or [] if isinstance(lst, dict) else []
truth("A the order list row also says 871.39", any(same(r.get("payable", -1), mA["payable"]) for r in rows), (c, str(lst)[:300]))

# ---- payments in cents
def pay(oid, amount, who="admin"):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1)}[who]
    return multi("POST", f"{base}/{oid}/payments", tok, {"description": "Cash received", "amount": amount}, PROOF)

c, p1 = pay(oA["id"], "100.01")
truth("A pay 100.01 -> accepted", c in (200, 201), p1)
check_totals("A after 100.01", oA["id"], mA, D("100.01"))
c, p2 = pay(oA["id"], "500.10", "s1")
truth("A pay 500.10 (seller) -> accepted", c in (200, 201), p2)
check_totals("A after 500.10", oA["id"], mA, D("600.11"))
c, bad = pay(oA["id"], "271.29")
truth("A paying 1 cent too much is refused", c == 400, (c, bad))
c, bad = pay(oA["id"], "271.280001")
truth("A an amount with more than 2 decimals is refused", c == 400, (c, bad))
c, p3 = pay(oA["id"], "271.28")
truth("A pay the exact balance 271.28 -> accepted", c in (200, 201), p3)
check_totals("A fully paid", oA["id"], mA, mA["payable"])
truth("A payment status is paid", sql(f"select \"paymentStatus\" from \"order\" where id={oA['id']}") == "paid")
truth("A payments add up to the amount paid", same(sql(f"select coalesce(sum(amount),0) from payment_status_history where \"orderId\"={oA['id']}"), mA["payable"]))
c, d = call("PATCH", f"{A}/{oA['id']}/status", ADMIN, {"status": "delivered"})
truth("A delivered", c == 200, d)
b = bal(SID1)
truth(f"A seller owes commission {mA['commission']} (balance total, due)", same(b[0], mA["commission"]) and same(b[1], mA["commission"]), b)
truth("A commission ledger adds up", same(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"orderId\"={oA['id']} and type='order_commission'"), mA["commission"]))

# ================= B  half-cent commissions at 10%
setrate(10)
oB = make_order(skus=((121, 3),), paid=False, delivered=False)
mB = model([("19.95", 3)], "10", "7.35")
truth("B expected: 59.85 x 10% = 5.985 -> 5.99, payable 67.20, seller 61.21", mB["com"][0] == D("5.99") and mB["payable"] == D("67.20") and mB["seller"] == D("61.21"), mB)
check_totals("B", oB["id"], mB)
oC = make_order(skus=((121, 1),), paid=False, delivered=False)
mC = model([("19.95", 1)], "10", "7.35")
truth("C expected: 19.95 x 10% = 1.995 -> 2.00", mC["com"][0] == D("2.00"), mC)
check_totals("C", oC["id"], mC)

# ================= D  fixed commission with cents
setrate(3.33, "fixed")
oD = make_order(skus=((119, 2), (120, 1)), paid=False, delivered=False)
mD = {"pay": [r2("171.37") * 2, D("49.99")], "com": [D("3.33"), D("3.33")]}
mD.update({"sub": sum(mD["pay"], D(0)), "commission": D("6.66")})
mD["payable"] = mD["sub"] + D("7.35")
mD["sell"] = [p - k for p, k in zip(mD["pay"], mD["com"])]
mD["seller"] = mD["payable"] - mD["commission"]
check_totals("D fixed 3.33 per line", oD["id"], mD)
setrate(7.5)

# ================= H  commissions that land on exactly half a cent and plain floating point rounds the wrong way
put(121, "21.35")
put(120, "21.75")
setrate(10)
oH = make_order(skus=((121, 1), (120, 1)), paid=False, delivered=False)
mH = model([("21.35", 1), ("21.75", 1)], "10", "7.35")
truth("H expected: 21.35 x 10% = 2.135 -> 2.14 and 21.75 x 10% = 2.175 -> 2.18", mH["com"] == [D("2.14"), D("2.18")] and mH["commission"] == D("4.32"), mH)
check_totals("H", oH["id"], mH)
put(120, "49.99")
put(121, "19.95")
setrate(7.5)

# ================= E  return of one line from order A (paid, delivered)
ids = [int(x) for x in sql(f"select id from order_item where \"orderId\"={oA['id']} and \"sellerProductSkuId\"=120").split()]
c, r = req(oA["id"], "items", ids)
truth("E return the 7 x 49.99 line -> opened", c in (200, 201), r)
rid = r["id"]
truth("E refund asked is 349.93 and buyer sees it", same(r["refundAmount"], mA["pay"][1]) and same(r["itemsAmount"], mA["pay"][1]), r)
full_cycle(rid)
c, rd = call("GET", f"{RU}/{rid}", USER)
truth("E buyer sees refund 349.93", c == 200 and same(rd["refundAmount"], mA["pay"][1]), rd)
c, rd = call("GET", f"{RS}/{rid}", S1)
truth("E seller sees refund 349.93", c == 200 and same(rd["refundAmount"], mA["pay"][1]), rd)
c, rd = call("GET", f"{RA}/{rid}", ADMIN)
truth("E admin sees refund 349.93", c == 200 and same(rd["refundAmount"], mA["pay"][1]), rd)
after = mA["commission"] - mA["com"][1]
b = bal(SID1)
truth(f"E commission after the return is {after} (64.80 - 26.24 = 38.56)", after == D("38.56") and same(b[0], after), b)

# ================= F  dashboard and statement agree with the sums
# What the seller earned in total: paid orders A (kept 3 lines), B/C/D were not paid so do not count.
c, dash = call("GET", "/seller/dashboard?range=30d", S1)
truth("F dashboard loads", c == 200, dash)
t = dash["totals"] if c == 200 else {}
truth("F dashboard: orders placed/paid", t.get("orders", {}).get("placed") == 5 and t.get("orders", {}).get("paid") == 1, t.get("orders"))
truth(f"F dashboard gross sales is the paid order's payable {mA['payable']}", same(t.get("grossSales", -1), mA["payable"]), t)
truth(f"F dashboard refunds is {mA['pay'][1]}", same(t.get("refunds", {}).get("amount", -1), mA["pay"][1]), t.get("refunds"))
truth(f"F dashboard commission net is {after}", same(t.get("commission", {}).get("net", -1), after), t.get("commission"))
truth("F dashboard 'you keep' = sales - commission - refunds + nothing else", same(t.get("sellerEarnings", -1), mA["payable"] - mA["commission"] - (mA["pay"][1] - mA["com"][1])), t)
truth("F dashboard average order is the paid order", same(t.get("averageOrder", -1), mA["payable"]), t)

import datetime
month = datetime.date.today().strftime("%Y-%m")
c, st = call("GET", f"/seller/reports/statement?month={month}", S1)
truth("F statement loads", c == 200, st)
if c == 200:
    s = st["summary"]
    truth(f"F statement sales {mA['payable']}", same(s["sales"], mA["payable"]), s)
    truth(f"F statement commission charged {mA['commission']}", same(s["systemCommission"], mA["commission"]), s)
    truth(f"F statement refunds {mA['pay'][1]} and commission given back {mA['com'][1]}", same(s["refunds"], mA["pay"][1]) and same(s["systemCommissionGivenBack"], mA["com"][1]), s)
    truth(f"F statement net commission {after}", same(s["netSystemCommission"], after), s)
    truth("F statement owed at the end equals the balance", same(s["owedAtEnd"], bal(SID1)[1]), s)
    truth("F statement rows add up to the summary", same(sum(D(str(o["amount"])) for o in st["orders"]), s["sales"]) and same(sum(D(str(o["systemCommission"])) for o in st["orders"]), s["systemCommission"]), st["orders"])

# ================= I  a buyer's own price in cents (proposal), through to a return
sql("update seller_product_sku set \"acceptProposals\"=true where id=119")
put(119, "192.23", "171.37")
c, pr = call("POST", "/user/proposals", USER, {"sellerProductSkuId": 119, "price": 150.57, "quantity": 3})
truth("I buyer offers 150.57 x 3", c == 201, (c, pr))
PID_ = pr["id"]
c, ac = call("POST", f"/seller/proposals/{PID_}/accept", S1, {})
truth("I seller accepts", c in (200, 201) and ac.get("status") == "accepted", (c, ac))
for who, url, tok in [("buyer", "/user/proposals", USER), ("seller", "/seller/proposals", S1), ("admin", "/admin/proposals", ADMIN)]:
    c, d = call("GET", f"{url}/{PID_}", tok)
    truth(f"I {who} sees 150.57 each and 451.71 in all", c == 200 and same(d.get("price", -1), "150.57") and same(d.get("total", -1), "451.71"), (c, str(d)[:300]))
c, cr = call("POST", f"{CART}/items", USER, {"sellerProductId": 94, "proposalId": PID_})
truth("I add the proposal to the cart", c in (200, 201), (c, cr))
cartI = cr["cart"]
ln = next(l for l in cartI["lines"] if l["sku"]["id"] == 119)
truth("I cart line: 150.57 each, 451.71 line, list price 192.23", same(ln["unitPayable"], "150.57") and same(ln.get("linePayable", ln.get("lineTotal", -1)), "451.71"), ln)
ct = cartI["totals"]
truth("I cart totals: payable 451.71, list 576.69, saved 124.98", same(ct["payableTotal"], "451.71") and same(ct["listTotal"], "576.69") and same(ct["savings"], "124.98"), ct)
c, oI = call("POST", f"{CK}/{cartI['id']}/place", token=USER, body=addr())
truth("I place the order", c == 201, (c, oI))
mI = model([("150.57", 3)], "7.5", "7.35")
truth("I expected: 451.71 + 7.35 = 459.06, commission 33.88, seller 425.18", mI["sub"] == D("451.71") and mI["payable"] == D("459.06") and mI["commission"] == D("33.88") and mI["seller"] == D("425.18"), mI)
for who, d in views(oI["id"]).items():
    t = d["totals"]
    truth(f"I {who} sees subtotal 451.71, payable 459.06, saved {D('576.69') - D('451.71')}", same(t["subtotal"], mI["sub"]) and same(t["payable"], mI["payable"]) and same(t["savings"], D("576.69") - D("451.71")), t)
row = sql(f"select \"totalProposalPrice\"||'|'||\"systemCommission\"||'|'||\"sellerAmount\" from order_item where \"orderId\"={oI['id']}").split("|")
truth("I line stored: proposal total 451.71, commission 33.88, line seller 417.83", same(row[0], "451.71") and same(row[1], "33.88") and same(row[2], "417.83"), row)
truth("I order commission and seller amount", same(sql(f"select \"systemCommission\" from \"order\" where id={oI['id']}"), "33.88") and same(sql(f"select \"sellerAmount\" from \"order\" where id={oI['id']}"), "425.18"))
c, pcheck = pay(oI["id"], "459.06")
truth("I pay 459.06 in full", c in (200, 201), pcheck)
call("PATCH", f"{A}/{oI['id']}/status", ADMIN, {"status": "delivered"})
before = bal(SID1)
idsI = [int(x) for x in sql(f"select id from order_item where \"orderId\"={oI['id']}").split()]
c, rI = req(oI["id"], "items", idsI)
truth("I return the proposal line: refund 451.71", c in (200, 201) and same(rI["refundAmount"], "451.71"), (c, rI))
full_cycle(rI["id"])
b2 = bal(SID1)
truth("I commission given back is 33.88", same(before[0] - b2[0], "33.88"), (before, b2))

# ================= J  a paid order is cancelled: the refund is exactly what was paid, to the cent
before = bal(SID1)
oJ = make_order(skus=((121, 1),), paid=False, delivered=False)
mJ = model([("19.95", 1)], "7.5", "7.35")
c, pj = pay(oJ["id"], "27.30", "s1")
truth("J seller records 27.30", c in (200, 201), pj)
truth("J commission 1.50 counted", same(bal(SID1)[0] - before[0], mJ["commission"]) and mJ["commission"] == D("1.50"), (before, bal(SID1), mJ))
c, d = call("PATCH", f"{SL}/{oJ['id']}/status", S1, {"status": "cancelled", "note": "Cannot supply"})
truth("J seller cancels", c == 200, d)
truth("J commission taken back", same(bal(SID1)[0], before[0]), (before, bal(SID1)))
rec = sql(f"select id||'|'||\"expectedAmount\" from order_refund where \"orderId\"={oJ['id']}").split("|")
truth("J refund is expected at 27.30", same(rec[1], "27.30"), rec)
RJ = int(rec[0])
for who, url, tok in [("seller", "/seller/order/refunds", S1), ("admin", "/admin/order/refunds", ADMIN)]:
    c, d = call("GET", f"{url}/{RJ}", tok)
    truth(f"J {who} sees 27.30 to refund", c == 200 and same(d.get("expectedAmount", -1), "27.30"), (c, str(d)[:300]))
c, d = call("GET", f"/user/order/{oJ['id']}", USER)
truth("J buyer sees the refund of 27.30", c == 200 and same(d["refunds"][0].get("expectedAmount", d["refunds"][0].get("amount", -1)), "27.30"), (c, str(d.get("refunds"))[:300]))
multi("POST", f"/seller/order/refunds/{RJ}/status", S1, {"status": "processing"})
c, d = multi("POST", f"/seller/order/refunds/{RJ}/status", S1, {"status": "refunded", "amount": "27.29", "note": "Sent"}, PROOF)
truth("J one cent less is refused", c == 400, (c, d))
c, d = multi("POST", f"/seller/order/refunds/{RJ}/status", S1, {"status": "refunded", "amount": "27.300001", "note": "Sent"}, PROOF)
truth("J three decimals are refused", c == 400, (c, d))
c, d = multi("POST", f"/seller/order/refunds/{RJ}/status", S1, {"status": "refunded", "amount": "27.30", "note": "Sent by bank"}, PROOF)
truth("J exactly 27.30 is accepted", c == 201 and d.get("status") == "refunded", (c, d))
truth("J the refund row says 27.30", same(sql(f"select amount from order_refund where id={RJ}"), "27.30"))

# ================= K  the seller pays the marketplace its commission in cents
b = bal(SID1)
due = D(str(b[1]))
truth("K the seller owes something", due > D("1"), b)
def disb(amount, sid=SID1):
    return multi("POST", f"/admin/commission/balances/{sid}/disbursements", ADMIN, {"amount": amount})
c, d = disb(str(due + D("0.01")))
truth("K paying 1 cent more than owed is refused", c == 409, (c, d))
c, d = disb("10.005")
truth("K an amount with 3 decimals is refused", c == 400, (c, d))
c, d1 = disb("10.01")
truth("K pay 10.01", c == 201, (c, d1))
b = bal(SID1)
truth(f"K owed is now {due - D('10.01')} and paid 10.01", same(b[1], due - D("10.01")) and same(b[2], D("10.01") + D(str(bal(SID1)[2])) - D("10.01")), b)
c, dd = call("GET", f"/admin/commission/disbursements/{d1['disburseId']}", ADMIN)
truth("K the payment record says 10.01, due after and paid in total", c == 200 and same(dd["amount"], "10.01") and same(dd["dueAmount"], due - D("10.01")) and same(dd["paidAmount"], "10.01"), (c, dd))
c, d2 = disb(str(due - D("10.01")))
truth("K pay the exact rest", c == 201, (c, d2))
b = bal(SID1)
truth("K nothing owed, all paid", same(b[1], 0) and same(b[2], b[0]), b)
c, st2 = call("GET", f"/seller/reports/statement?month={month}", S1)
truth("K the statement shows everything paid", c == 200 and same(st2["summary"]["owedAtEnd"], 0) and same(st2["summary"]["paidToMarketplace"], b[2]), st2.get("summary"))
c, dash2 = call("GET", "/seller/dashboard?range=30d", S1)
truth("K the dashboard shows owe 0 and paid in full", c == 200 and same(dash2["balance"]["due"], 0) and same(dash2["balance"]["paid"], b[2]), dash2.get("balance"))

# ================= L  reports and the admin dashboard
today = datetime.date.today().isoformat()
def rep(base, name, tok, extra=""):
    c, rp = call("GET", f"{base}/reports/{name}?from={today}&to={today}{extra}", tok)
    assert c == 200, (name, c, rp)
    return {x["label"]: x["value"] for x in rp["summary"]}, rp["rows"]
paidA, paidI = mA["payable"], mI["payable"]
sales_total = paidA + paidI
refunds_total = mA["pay"][1] + D("451.71")
com_total = mA["commission"] + mI["commission"]
back_total = mA["com"][1] + mI["commission"]
sm, rows = rep("/seller", "sales", S1)
truth("L sales report: 7 orders, 2 paid", sm["Orders placed"] == 7 and sm["Paid orders"] == 2, sm)
truth(f"L sales report: sales {sales_total}, refunds {refunds_total}, after refunds {sales_total - refunds_total}", same(sm["Sales"], sales_total) and same(sm["Refunds"], refunds_total) and same(sm["Sales after refunds"], sales_total - refunds_total), sm)
truth("L sales report: average paid order is half of the sales, rounded to cents", same(sm["Average paid order"], sales_total / 2), sm)
truth("L sales report: the row says the same as the summary", same(rows[0]["sales"], sm["Sales"]) and same(rows[0]["refunds"], sm["Refunds"]) and same(rows[0]["netSales"], sm["Sales after refunds"]), rows)
em, rows = rep("/seller", "earnings", S1)
truth(f"L earnings report: commission {com_total}, given back {back_total}", same(em["System commission"], com_total) and same(em["System commission given back"], back_total), em)
truth(f"L earnings report: you keep {sales_total - com_total - refunds_total + back_total}", same(em["You keep"], sales_total - com_total - refunds_total + back_total) and same(rows[0]["keep"], em["You keep"]), em)
rm, rows = rep("/seller", "returns", S1)
truth(f"L returns report: 2 returns, refunded {refunds_total}", rm["Returns asked for"] == 2 and same(rm["Refunded so far"], refunds_total) and same(sum(D(str(r["refunded"])) for r in rows), refunds_total), (rm, rows))
om, rows = rep("/seller", "orders", S1)
truth("L orders report: 7 placed, 1 cancelled", om["Orders placed"] == 7 and om["Cancelled"] == 1, om)
pm, rows = rep("/seller", "products", S1)
want = D(sql("select coalesce(sum(coalesce(i.\"totalProposalPrice\", i.\"totalDiscountedPrice\", i.\"totalPrice\")::numeric),0) from order_item i join \"order\" o on o.id=i.\"orderId\" join seller_product p on p.id=i.\"sellerProductId\" where p.\"sellerId\"=" + str(SID1) + " and o.\"paymentStatus\"='paid' and o.status<>'cancelled' and not i.\"isReturned\" and o.\"createdAt\"::date = current_date"))
truth(f"L products report: revenue {want} matches the line sums", same(pm["Sales"], want) and same(sum(D(str(r["revenue"])) for r in rows), want), (pm, want))
am, _ = rep("/admin", "sales", ADMIN)
want = D(sql("select coalesce(sum(\"payableAmount\"::numeric),0) from \"order\" where \"paymentStatus\"='paid' and status<>'cancelled' and \"createdAt\"::date = current_date"))
truth(f"L admin sales report: sales {want} matches the paid orders of today", same(am["Sales"], want), (am, want))
c, adash = call("GET", "/admin/dashboard?range=7d", ADMIN)
ar, _ = (lambda r: ({x["label"]: x["value"] for x in r[1]["summary"]}, None))(call("GET", f"/admin/reports/sales?from={(datetime.date.today() - datetime.timedelta(days=6)).isoformat()}&to={today}", ADMIN))
truth("L admin dashboard sales equals the admin sales report for the same days", c == 200 and same(adash["totals"]["grossSales"], ar["Sales"]), (adash.get("totals") if c == 200 else adash, ar))

# ================= M  bulk price change in cents (percent and fixed amount)
put(119, "192.23", "171.37")
put(120, "49.99")
put(121, "21.35")
def prices():
    return {k: [D(x) if x else None for x in sql(f"select price||'|'||coalesce(\"discountedPrice\"::text,'') from seller_product_sku where id={k}").split("|")] for k in (119, 120, 121)}
c, d = call("POST", "/seller/products/bulk", S1, {"productIds": [94], "action": "price", "mode": "percent", "direction": "increase", "value": 10})
truth("M raise every price by 10%", c in (200, 201), (c, d))
now = prices()
truth("M 192.23 -> 211.45, 171.37 -> 188.51 (offer), 49.99 -> 54.99, 21.35 -> 23.49 (half cent rounds up)",
      now[119][0] == D("211.45") and now[119][1] == D("188.51") and now[120][0] == D("54.99") and now[121][0] == D("23.49"), now)
c, d = call("POST", "/seller/products/bulk", S1, {"productIds": [94], "action": "price", "mode": "amount", "direction": "decrease", "value": 0.01})
truth("M lower every price by 0.01", c in (200, 201), (c, d))
now = prices()
truth("M each price is exactly 1 cent lower", now[119][0] == D("211.44") and now[119][1] == D("188.50") and now[120][0] == D("54.98") and now[121][0] == D("23.48"), now)
c, d = call("POST", "/seller/products/bulk", S1, {"productIds": [94], "action": "price", "mode": "amount", "direction": "increase", "value": 0.005})
truth("M an amount with 3 decimals is refused", c == 400, (c, d))
put(119, "192.23", "171.37")
put(120, "49.99")
put(121, "19.95")

# ================= G  the cart shows the same cents
call("POST", CART + "/items", token=USER, body={"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 3})
c, cv = call("GET", f"{CART}/seller/{SID1}", USER)
tot = ((cv.get("cart") or {}).get("totals") or {}) if isinstance(cv, dict) else {}
truth("G cart: 3 x 171.37 = 514.11 payable, 3 x 192.23 = 576.69 list, 62.58 saved", same(tot.get("payableTotal", -1), "514.11") and same(tot.get("listTotal", -1), "576.69") and same(tot.get("savings", -1), "62.58"), tot)

if not os.environ.get("KEEP"):
    cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, str(dd)[:300])
sys.exit(1 if failed else 0)
