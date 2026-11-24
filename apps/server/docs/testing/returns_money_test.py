#!/usr/bin/env python3
"""Money audit for returns. Every expected amount is worked out here from the raw rules (prices, quantities, the
commission rule, the delivery charge) with its own rounding, then compared with what the API and the database hold:
line and order commission, seller amounts, refunds, delivery handling, balance moves, ledger rows, change log, undo,
disbursed commission, and the sums that must always agree. Reuses the set-up of returns_test.py."""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "returns_test.py")).read().split("# ============================================================ S  settings")[0]
# Own names, so this suite never clashes with returns_test.py data.
_src = _src.replace('"T Ret"', '"T Mny"').replace("t-ret-", "t-mny-").replace("tret{RUN}", "tmny{RUN}")
_ledger = "    sql(f\"delete from system_commission_history where \\\"sellerId\\\" in ({sellers})\")\n"
assert _ledger in _src
_src = _src.replace(
    _ledger,
    _ledger
    + "    sql(f\"delete from system_commission_disburse_attachments where \\\"disburseId\\\" in (select id from system_commission_disburse where \\\"sellerId\\\" in ({sellers}))\")\n"
    + "    sql(f\"delete from system_commission_disburse where \\\"sellerId\\\" in ({sellers})\")\n",
    1,
)
exec(compile(_src, "returns_test_prelude", "exec"))

EPS = 2.220446049250313e-16
CA = "/admin/commission"


# ---------------------------------------------------------------- the model (independent of the server code)
def tidy(n):
    return math.floor((n + EPS) * 100 + 0.5) / 100


def line_commission(rule, payable):
    kind, value = rule
    raw = payable * value / 100 if kind == "percentage" else value
    return min(tidy(max(0, raw)), tidy(payable))


def model_order(rule, lines, delivery):
    """lines: [(unit payable, qty)] -> payables, line commissions, line seller amounts, order totals."""
    pay = [tidy(u * q) for u, q in lines]
    com = [line_commission(rule, p) for p in pay]
    sell = [tidy(p - c) for p, c in zip(pay, com)]
    subtotal = tidy(sum(pay))
    commission = tidy(sum(com))
    payable = tidy(subtotal + delivery)
    return {"pay": pay, "com": com, "sell": sell, "subtotal": subtotal, "commission": commission,
            "payable": payable, "seller": tidy(payable - commission)}


def near(a, b):
    return abs(float(a) - float(b)) < 0.0049


def vals(q):
    return [float(x) for x in sql(q).split("|")]


def order_row(oid):
    return vals(f"select subtotal||'|'||\"deliveryCharge\"||'|'||\"payableAmount\"||'|'||\"systemCommission\"||'|'||\"sellerAmount\" from \"order\" where id={oid}")


def line_rows(oid):
    out = []
    for r in sql(f"select \"totalPrice\"||'|'||coalesce(\"totalDiscountedPrice\",-1)||'|'||\"systemCommission\"||'|'||\"sellerAmount\"||'|'||quantity from order_item where \"orderId\"={oid} order by id").splitlines():
        out.append([float(x) for x in r.split("|")])
    return out


def line_ids(oid, sku):
    return [int(x) for x in sql(f"select id from order_item where \"orderId\"={oid} and \"sellerProductSkuId\"={sku} order by id").split()]


def settle(rid, include=None):
    """Seller accepts (optionally choosing the delivery refund), processes, sends money; admin confirms. Returns the final body."""
    assert seller_do(rid, "accept", {} if include is None else {"includeDeliveryCharge": include})[0] == 201
    assert seller_do(rid, "processing")[0] == 201
    c, d = multi("POST", f"{RS}/{rid}/returning-money", S1, {"note": "Refunded by bank transfer"}, PROOF)
    assert c == 201, d
    c, d = admin_status(rid, "returned", "Money confirmed")
    assert c == 201, d
    return d


def live_rows(rid):
    return [(float(a), None if b == "" else int(b)) for a, b in (r.split("|") for r in sql(f"select \"totalAmount\"||'|'||coalesce(\"orderItemId\"::text,'') from system_commission_history where \"orderReturnId\"={rid} and type='order_return' and \"deletedAt\" is null order by id").splitlines())]


def drop(before, after):
    """How far total, due, paid fell."""
    return [tidy(b - a) for b, a in zip(before, after)]


def set_global(kind, amount):
    call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": kind, "commission.amount": amount}})


def set_seller_rule(sid, kind, amount):
    return call("PUT", f"/admin/commission/sellers/{sid}/setting", ADMIN, {"commissionType": kind, "commissionAmount": amount})


# ---------------------------------------------------------------- prices used throughout
# sku 119 -> 1999 (no discount): chosen so a share of it ends on a half cent. sku 120 -> 3800. sku 121 -> 6500 (discounted from 7000).
sql("update seller_product_sku set price=1999, \"discountedPrice\"=null where id=119")
P119, P120, P121 = 1999, 3800, 6500
DELIVERY = 100
set_global("percentage", 12.5)

# ============================================================ A  percentage rule, several quantities, partial returns
print("--- A: 12.5% global rule, quantities 3/1/2, item returns until the order is gone")
mA = model_order(("percentage", 12.5), [(P119, 3), (P120, 1), (P121, 2)], DELIVERY)
b0 = bal(SID1)
OA = make_order(((119, 3), (120, 1), (121, 2)))
oid = OA["id"]
truth("A the model itself: half-cent line rounds up (749.63)", mA["com"][0] == 749.63, mA)
sub, dlv, pay, com, sel = order_row(oid)
truth("A order subtotal is the sum of lines", near(sub, mA["subtotal"]), (sub, mA["subtotal"]))
truth("A order payable = subtotal + delivery", near(pay, mA["payable"]) and near(dlv, DELIVERY), (pay, dlv))
truth("A order commission is the sum of the line commissions", near(com, mA["commission"]), (com, mA["commission"]))
truth("A order seller amount = payable - commission", near(sel, mA["seller"]), (sel, mA["seller"]))
ls = line_rows(oid)
truth("A every line commission matches the model", all(near(l[2], c) for l, c in zip(ls, mA["com"])), (ls, mA["com"]))
truth("A every line seller amount matches the model", all(near(l[3], s) for l, s in zip(ls, mA["sell"])), (ls, mA["sell"]))
truth("A order seller amount = sum of line seller amounts + delivery", near(sel, tidy(sum(mA["sell"]) + DELIVERY)))
b1 = bal(SID1)
truth("A balance rose by the order commission, due with it, paid untouched", [tidy(x - y) for x, y in zip(b1, b0)] == [mA["commission"], mA["commission"], 0.0], (b0, b1))
ia, ib, ic_ = line_ids(oid, 119)[0], line_ids(oid, 120)[0], line_ids(oid, 121)[0]

# first return: the 3 x 1999 line, by the customer
c, r1 = req(oid, "items", [ia])
check("A item return refunds that line only, no delivery", (c, r1), 201, pred=lambda v: near(v["refundAmount"], mA["pay"][0]) and v["deliveryAmount"] == 0 and near(v["itemsAmount"], mA["pay"][0]))
done = settle(r1["id"])
truth("A return holds the line's commission", near(done["commissionAmount"], mA["com"][0]) and near(done["items"][0]["commissionAmount"], mA["com"][0]), done)
b2 = bal(SID1)
truth("A balance fell by that line's commission (total and due), paid unchanged", drop(b1, b2) == [mA["com"][0], mA["com"][0], 0.0], (b1, b2))
truth("A one ledger row with the item id and the commission", live_rows(r1["id"]) == [(mA["com"][0], ia)], live_rows(r1["id"]))
truth("A the customer's refund less the commission is the line's seller amount", near(tidy(mA["pay"][0] - mA["com"][0]), mA["sell"][0]))
truth("A only the first line is flagged", flags(oid) == ("f", "t,f,f"), flags(oid))

# second return: the 2 x 6500 line, by the customer
c, r2 = req(oid, "items", [ic_])
check("A second item return refunds 13000", (c, r2), 201, pred=lambda v: near(v["refundAmount"], mA["pay"][2]) and v["deliveryAmount"] == 0)
settle(r2["id"])
b3 = bal(SID1)
truth("A balance fell by the second line's commission", drop(b2, b3) == [mA["com"][2], mA["com"][2], 0.0], (b2, b3))
truth("A order not yet returned, two lines flagged", flags(oid) == ("f", "t,f,t"), flags(oid))

# last line through a full-order return by an admin: delivery comes with it
check("A a customer cannot now ask for the full order", req(oid, "full_order"), 409)
c, r3 = adm_req(oid, "full_order")
want3 = tidy(mA["pay"][1] + DELIVERY)
check("A admin full return of what is left: remaining line + delivery", (c, r3), 201, pred=lambda v: near(v["refundAmount"], want3) and near(v["itemsAmount"], mA["pay"][1]) and near(v["deliveryAmount"], DELIVERY) and len(v["items"]) == 1)
done3 = settle(r3["id"])
truth("A final return commission is the last line's", near(done3["commissionAmount"], mA["com"][1]), done3)
b4 = bal(SID1)
truth("A balance fell by the last commission, as one order row", drop(b3, b4) == [mA["com"][1], mA["com"][1], 0.0] and live_rows(r3["id"]) == [(mA["com"][1], None)], (b3, b4, live_rows(r3["id"])))
truth("A the order is now returned, every line flagged", flags(oid) == ("t", "t,t,t"), flags(oid))
truth("A whole order refunded exactly once: refunds add up to the payable amount", near(tidy(mA["pay"][0] + mA["pay"][2] + want3), mA["payable"]), (mA["pay"], want3, mA["payable"]))
truth("A all the commission came back: balance is where it started", drop(b0, b4) == [0.0, 0.0, 0.0], (b0, b4))
truth("A commission taken back across the three returns = the order's commission", near(tidy(mA["com"][0] + mA["com"][2] + mA["com"][1]), mA["commission"]))
truth("A seller keeps nothing from a fully returned order beyond the delivery they were already paid (sum of seller amounts of lines + delivery = refunds - commission)", near(tidy(sum(mA["sell"]) + DELIVERY), tidy(mA["payable"] - mA["commission"])))

# ============================================================ B  seller rule overrides; later rate changes never reach an old order
print("--- B: seller 33.33% rule, rate changed after placing, full-order return with a delivery choice")
set_seller_rule(SID1, "percentage", 33.33)
mB = model_order(("percentage", 33.33), [(P119, 1), (P120, 1)], DELIVERY)
bB0 = bal(SID1)
OB = make_order(((119, 1), (120, 1)))
sub, dlv, pay, com, sel = order_row(OB["id"])
truth("B the seller's own rule beats the global one: commission matches the model", near(com, mB["commission"]) and near(sel, mB["seller"]) and near(pay, mB["payable"]), (com, mB))
truth("B line commissions match the model (666.27 + 1266.54)", all(near(l[2], c) for l, c in zip(line_rows(OB["id"]), mB["com"])), (line_rows(OB["id"]), mB["com"]))
set_seller_rule(SID1, "fixed", 1)  # a later change must not touch OB
set_global("percentage", 50)
c, rb = req(OB["id"], "full_order")
check("B customer full-order refund defaults to lines + delivery", (c, rb), 201, pred=lambda v: near(v["refundAmount"], mB["payable"]) and near(v["deliveryAmount"], DELIVERY))
check("B seller turns the delivery refund off at accept", seller_do(rb["id"], "accept", {"includeDeliveryCharge": False}), 201, pred=lambda v: near(v["refundAmount"], mB["subtotal"]) and v["deliveryAmount"] == 0)
assert seller_do(rb["id"], "processing")[0] == 201
assert multi("POST", f"{RS}/{rb['id']}/returning-money", S1, {"note": "Sent by bank transfer"}, PROOF)[0] == 201
check("B admin puts the delivery back before the final step", admin_status(rb["id"], "returned", "Delivery goes back too", {"includeDeliveryCharge": "true"}), 201,
      pred=lambda v: v["status"] == "returned" and near(v["refundAmount"], mB["payable"]) and near(v["deliveryAmount"], DELIVERY) and near(v["commissionAmount"], mB["commission"]))
bB1 = bal(SID1)
truth("B balance fell by the stored order commission, not by the new rates", drop([bB0[0] + mB["commission"], bB0[1] + mB["commission"], bB0[2]], bB1) == [mB["commission"], mB["commission"], 0.0], (bB0, bB1))
truth("B back to the starting balance", [tidy(a - b) for a, b in zip(bB0, bB1)] == [0.0, 0.0, 0.0], (bB0, bB1))
truth("B one order-level ledger row with the whole commission", live_rows(rb["id"]) == [(mB["commission"], None)], live_rows(rb["id"]))
truth("B the order's own stored commission is untouched", near(order_row(OB["id"])[3], mB["commission"]))
set_global("percentage", 12.5)

# ============================================================ C  fixed rule per line, and the cap
print("--- C: fixed amount per line, then a fixed amount bigger than the line")
mC = model_order(("fixed", 30), [(P119, 1), (P120, 1), (P121, 1)], DELIVERY)
set_seller_rule(SID1, "fixed", 30)
bC0 = bal(SID1)
OC = make_order(((119, 1), (120, 1), (121, 1)))
truth("C a fixed 30 on each of 3 lines = 90", near(order_row(OC["id"])[3], 90) and mC["com"] == [30, 30, 30], (order_row(OC["id"]), mC))
trio = items_of(OC["id"])
c, rc = req(OC["id"], "items", [trio[2]])
check("C returning one line refunds that line (6500), no delivery", (c, rc), 201, pred=lambda v: near(v["refundAmount"], P121) and v["deliveryAmount"] == 0)
dn = settle(rc["id"])
truth("C and takes back exactly 30", near(dn["commissionAmount"], 30), dn)
truth("C balance is +60 over the start (two lines still earned)", [tidy(a - b) for a, b in zip(bal(SID1), bC0)] == [60.0, 60.0, 0.0], (bC0, bal(SID1)))

mCap = model_order(("fixed", 5000), [(P119, 1), (P120, 1)], DELIVERY)
set_seller_rule(SID1, "fixed", 5000)
bCap0 = bal(SID1)
OCAP = make_order(((119, 1), (120, 1)))
truth("C a huge fixed amount is capped at each line: commission = lines total", mCap["com"] == [P119, P120] and near(order_row(OCAP["id"])[3], 5799), (mCap, order_row(OCAP["id"])))
truth("C the seller keeps the delivery charge only, no line below zero", near(order_row(OCAP["id"])[4], DELIVERY) and all(l[3] == 0 for l in line_rows(OCAP["id"])), line_rows(OCAP["id"]))
c, rcap = req(OCAP["id"], "full_order")
check("C full return refunds lines + delivery (5899)", (c, rcap), 201, pred=lambda v: near(v["refundAmount"], 5899))
dcap = settle(rcap["id"])
truth("C and takes back the capped commission (5799)", near(dcap["commissionAmount"], 5799), dcap)
truth("C balance back to the start", [tidy(a - b) for a, b in zip(bal(SID1), bCap0)] == [0.0, 0.0, 0.0], (bCap0, bal(SID1)))

# ============================================================ D  commission already paid to the platform
print("--- D: seller already paid the commission, then the order is returned")
set_seller_rule(SID1, "percentage", 10)
OD = make_order(((121, 1),))
due = bal(SID1)[1]
c, dis = multi("POST", f"{CA}/balances/{SID1}/disbursements", ADMIN, {"amount": f"{due:.2f}", "notes": "Paid in full by the seller"}, None)
check("D seller pays all the commission due", (c, dis), [200, 201])
bD1 = bal(SID1)
truth("D after paying: due is 0, paid holds it all", near(bD1[1], 0) and near(bD1[2], bD1[0]), bD1)
c, rd = req(OD["id"], "full_order")
settle(rd["id"])
bD2 = bal(SID1)
truth("D the return takes 650 off total and off due, paid is not touched", near(bD1[0] - bD2[0], 650) and near(bD1[1] - bD2[1], 650) and near(bD1[2], bD2[2]), (bD1, bD2))
truth("D total always equals due + paid", near(bD2[0], tidy(bD2[1] + bD2[2])), bD2)
truth("D the platform now owes the seller 650 (due is -650)", near(bD2[1], -650), bD2)
print("NOTE D: due is negative after a return of commission that was already paid; it is a credit to the seller.")
check("D a seller with a credit cannot pay more commission", multi("POST", f"{CA}/balances/{SID1}/disbursements", ADMIN, {"amount": "1.00"}, None), 409)
OD2 = make_order(((120, 1),))
bD3 = bal(SID1)
truth("D the next order's commission first cancels the credit (due -650 + 380 = -270)", near(bD3[1], tidy(-650 + 380)) and near(bD3[0], tidy(bD2[0] + 380)), (bD2, bD3))
truth("D total still equals due + paid", near(bD3[0], tidy(bD3[1] + bD3[2])), bD3)

# ============================================================ E  undo and redo are exact
print("--- E: admin undoes a finished return, then finishes it again")
set_seller_rule(SID1, "percentage", 10)
OE = make_order(((119, 1), (121, 1)))
mE = model_order(("percentage", 10), [(P119, 1), (P121, 1)], DELIVERY)
ide = items_of(OE["id"])
bE0 = bal(SID1)
c, re_ = req(OE["id"], "items", [ide[1]])
settle(re_["id"])
bE1 = bal(SID1)
truth("E returned: balance fell by the line's commission (650)", drop(bE0, bE1) == [mE["com"][1], mE["com"][1], 0.0], (bE0, bE1))
check("E admin moves it back to processing", admin_status(re_["id"], "processing", "Customer sent the wrong bird"), 201, pred=lambda v: v["status"] == "processing" and not v.get("returnedAt"))
bE2 = bal(SID1)
truth("E undo: balance is exactly what it was before the return", [tidy(a - b) for a, b in zip(bE2, bE0)] == [0.0, 0.0, 0.0], (bE0, bE2))
truth("E undo: the line is no longer flagged; the open return shows the commission at stake (650) but takes none", flags(OE["id"]) == ("f", "f,f") and near(float(sql(f"select \"commissionAmount\" from order_return where id={re_['id']}")), mE["com"][1]), (flags(OE["id"]), sql(f"select \"commissionAmount\" from order_return where id={re_['id']}")))
truth("E undo: the ledger row is voided, none live", live_rows(re_["id"]) == [] and sql(f"select count(*) from system_commission_history where \"orderReturnId\"={re_['id']} and \"deletedAt\" is not null") == "1")
check("E finish it again", admin_status(re_["id"], "returned", "Money confirmed after all"), 201, pred=lambda v: v["status"] == "returned" and near(v["commissionAmount"], mE["com"][1]))
bE3 = bal(SID1)
truth("E redo: balance fell once more by exactly 650, never twice", drop(bE0, bE3) == [mE["com"][1], mE["com"][1], 0.0], (bE0, bE3))
truth("E redo: exactly one live ledger row", live_rows(re_["id"]) == [(mE["com"][1], ide[1])], live_rows(re_["id"]))
ret_rows = int(sql(f"select count(*) from system_commission_change_history c where c.\"historyId\" in (select id from system_commission_history where \"orderReturnId\"={re_['id']})"))
truth("E the return left 3 change rows: take back, undo, take back again", ret_rows == 3, ret_rows)
net = float(sql(f"select coalesce(sum(\"newTotalCommission\" - \"currentTotalCommission\"),0) from system_commission_change_history c where c.\"historyId\" in (select id from system_commission_history where \"orderReturnId\"={re_['id']})"))
truth("E those change rows add up to -650", near(net, -mE["com"][1]), net)

# ============================================================ F  delivery charge handling
print("--- F: free delivery, and the delivery refund setting off")
sql("update system_setting set value='0' where key='shipping.defaultCharge'")
OF0 = make_order(((120, 1),))
truth("F free delivery: payable = subtotal", near(order_row(OF0["id"])[2], P120) and near(order_row(OF0["id"])[1], 0), order_row(OF0["id"]))
c, rf0 = req(OF0["id"], "full_order")
check("F free delivery: full return refunds just the line", (c, rf0), 201, pred=lambda v: near(v["refundAmount"], P120) and v["deliveryAmount"] == 0)
sql("update system_setting set value='100' where key='shipping.defaultCharge'")
call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.refundDeliveryCharge": False}})
OF1 = make_order(((120, 1),))
c, rf1 = req(OF1["id"], "full_order")
check("F setting off: a full return refunds the lines only by default", (c, rf1), 201, pred=lambda v: near(v["refundAmount"], P120) and v["deliveryAmount"] == 0 and v["includeDeliveryCharge"] is False)
check("F the seller can still add the delivery charge at accept", seller_do(rf1["id"], "accept", {"includeDeliveryCharge": True}), 201, pred=lambda v: near(v["refundAmount"], tidy(P120 + DELIVERY)) and near(v["deliveryAmount"], DELIVERY))
check("F an item return never gets delivery, even when asked", req(OF1["id"], "items", items_of(OF1["id"])[:1], extra={"includeDeliveryCharge": "true"}), 400)
call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.refundDeliveryCharge": True}})

# ============================================================ G  guest order
print("--- G: guest order, admin returns it")
OG = make_order(((119, 2), (120, 1)), who="guest")
mG = model_order(("percentage", 10), [(P119, 2), (P120, 1)], DELIVERY)
truth("G guest order amounts match the model", near(order_row(OG["id"])[3], mG["commission"]) and near(order_row(OG["id"])[2], mG["payable"]), (order_row(OG["id"]), mG))
bG0 = bal(SID1)
c, rg = adm_req(OG["id"], "full_order")
check("G admin full return refunds the whole payable amount", (c, rg), 201, pred=lambda v: near(v["refundAmount"], mG["payable"]))
dg = settle(rg["id"])
truth("G commission taken back = order commission", near(dg["commissionAmount"], mG["commission"]) and drop(bG0, bal(SID1)) == [mG["commission"], mG["commission"], 0.0], (bG0, bal(SID1)))

# ============================================================ H  what each role sees agrees
print("--- H: the three views of one return agree")
OH = make_order(((121, 1), (120, 1)))
c, rh = req(OH["id"], "full_order")
rid = rh["id"]
cu = call("GET", f"{RU}/{rid}", USER)[1]
se = call("GET", f"{RS}/{rid}", S1)[1]
ad = call("GET", f"{RA}/{rid}", ADMIN)[1]
truth("H refund, items and delivery are the same for customer, seller and admin", all(near(cu[k], se[k]) and near(se[k], ad[k]) for k in ("refundAmount", "itemsAmount", "deliveryAmount")), (cu, se, ad))
truth("H the customer cannot see commission, seller and admin see the same figure", "commissionAmount" not in cu and near(se["commissionAmount"], ad["commissionAmount"]), (se.get("commissionAmount"), ad.get("commissionAmount")))
sel_order = call("GET", f"{SL}/{OH['id']}", S1)[1]
truth("H the order screen for the seller shows the same line commissions that the return will take", [i["systemCommission"] for i in sel_order["items"]] == [l[2] for l in line_rows(OH["id"])])
elig = call("GET", f"{RU}/eligibility/{OH['id']}", USER)[1]
truth("H eligibility says what the request then did", near(elig["fullOrder"]["refundAmount"], cu["refundAmount"]) and near(elig["fullOrder"]["itemsAmount"], cu["itemsAmount"]), (elig["fullOrder"], cu))

# ============================================================ I  invariants over everything this run created
print("--- I: invariants")
sellers = f"select id from seller where name like '{TAG} %'"
for sid in (SID1, SID2):
    t, d_, p_ = bal(sid)
    earned = float(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"sellerId\"={sid} and type='order_commission' and \"deletedAt\" is null"))
    back = float(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"sellerId\"={sid} and type='order_return' and \"deletedAt\" is null"))
    truth(f"I seller {sid}: total = earned - returned (live ledger)", near(t, tidy(earned - back)), (t, earned, back))
    truth(f"I seller {sid}: total = due + paid", near(t, tidy(d_ + p_)), (t, d_, p_))
    paid_out = float(sql(f"select coalesce(sum(amount),0) from system_commission_disburse where \"sellerId\"={sid}"))
    truth(f"I seller {sid}: paid = the sum of the disbursements", near(p_, paid_out), (p_, paid_out))
truth("I change log chains for every seller (each row starts where the last ended)", sql(f"select count(*) from (select \"currentTotalCommission\" c, lag(\"newTotalCommission\") over (partition by \"sellerId\" order by id) p, \"currentDueCommission\" cd, lag(\"newDueCommission\") over (partition by \"sellerId\" order by id) pd, \"currentPaidCommission\" cp, lag(\"newPaidCommission\") over (partition by \"sellerId\" order by id) pp from system_commission_change_history where \"sellerId\" in ({sellers})) x where p is not null and (abs(c-p) > 0.005 or abs(cd-pd) > 0.005 or abs(cp-pp) > 0.005)") == "0")
truth("I last change row equals the live balance", sql(f"select count(*) from system_commission sc where sc.\"sellerId\" in ({sellers}) and exists (select 1 from system_commission_change_history c where c.\"sellerId\"=sc.\"sellerId\") and not exists (select 1 from system_commission_change_history c where c.\"sellerId\"=sc.\"sellerId\" and c.id=(select max(id) from system_commission_change_history where \"sellerId\"=sc.\"sellerId\") and abs(c.\"newTotalCommission\"-sc.\"totalCommission\")<0.005 and abs(c.\"newDueCommission\"-sc.\"dueCommission\")<0.005 and abs(c.\"newPaidCommission\"-sc.\"paidCommission\")<0.005)") == "0")
truth("I ledger 'after' numbers agree with the change log row of the same entry", sql(f"select count(*) from system_commission_history h join system_commission_change_history c on c.\"historyId\"=h.id and c.\"commissionStatus\" in ('for_system','order_returned_to_customer','commission_payment') where h.\"sellerId\" in ({sellers}) and (abs(h.\"totalAfter\"-c.\"newTotalCommission\")>0.005 or abs(h.\"dueAfter\"-c.\"newDueCommission\")>0.005 or abs(h.\"paidAfter\"-c.\"newPaidCommission\")>0.005)") == "0")
truth("I every order: commission = sum of lines, payable = subtotal + delivery, seller = payable - commission", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and (abs(o.\"systemCommission\" - (select coalesce(sum(i.\"systemCommission\"),0) from order_item i where i.\"orderId\"=o.id))>0.005 or abs(o.\"payableAmount\" - o.subtotal - o.\"deliveryCharge\" + o.\"discountAmount\")>0.005 or abs(o.\"sellerAmount\" - o.\"payableAmount\" + o.\"systemCommission\")>0.005)") == "0")
truth("I every line: seller amount + commission = what it was payable at", sql(f"select count(*) from order_item i join \"order\" o on o.id=i.\"orderId\" where o.\"sellerId\" in ({sellers}) and abs(i.\"sellerAmount\" + i.\"systemCommission\" - coalesce(i.\"totalProposalPrice\", i.\"totalDiscountedPrice\", i.\"totalPrice\"))>0.005") == "0")
truth("I no line commission above its payable amount, none negative", sql(f"select count(*) from order_item i join \"order\" o on o.id=i.\"orderId\" where o.\"sellerId\" in ({sellers}) and (i.\"systemCommission\" < 0 or i.\"systemCommission\" - coalesce(i.\"totalProposalPrice\", i.\"totalDiscountedPrice\", i.\"totalPrice\") > 0.005)") == "0")
truth("I every return: refund = items + delivery; items = sum of its lines", sql(f"select count(*) from order_return r where r.\"sellerId\" in ({sellers}) and (abs(r.\"refundAmount\" - r.\"itemsAmount\" - r.\"deliveryAmount\")>0.005 or abs(r.\"itemsAmount\" - (select coalesce(sum(\"refundAmount\"),0) from order_return_item where \"orderReturnId\"=r.id))>0.005)") == "0")
truth("I returned returns hold the commission of their lines, and that equals their live ledger rows", sql(f"select count(*) from order_return r where r.\"sellerId\" in ({sellers}) and r.status='returned' and (abs(r.\"commissionAmount\" - (select coalesce(sum(\"commissionAmount\"),0) from order_return_item where \"orderReturnId\"=r.id))>0.005 or abs(r.\"commissionAmount\" - (select coalesce(sum(\"totalAmount\"),0) from system_commission_history h where h.\"orderReturnId\"=r.id and h.\"deletedAt\" is null))>0.005)") == "0")
truth("I returned lines each hold exactly their order line's commission", sql(f"select count(*) from order_return r join order_return_item ri on ri.\"orderReturnId\"=r.id join order_item i on i.id=ri.\"orderItemId\" where r.\"sellerId\" in ({sellers}) and abs(ri.\"commissionAmount\" - i.\"systemCommission\")>0.005") == "0")
truth("I refunds of returned returns never exceed the order's payable amount", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and (select coalesce(sum(r.\"refundAmount\"),0) from order_return r where r.\"orderId\"=o.id and r.status='returned') - o.\"payableAmount\" > 0.005") == "0")
truth("I returned commission never exceeds the order's commission", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and (select coalesce(sum(r.\"commissionAmount\"),0) from order_return r where r.\"orderId\"=o.id and r.status='returned') - o.\"systemCommission\" > 0.005") == "0")
truth("I a fully returned order refunded its whole payable amount (delivery included when chosen)", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and o.\"isReturned\" and (select coalesce(sum(r.\"itemsAmount\"),0) from order_return r where r.\"orderId\"=o.id and r.status='returned') - o.subtotal not between -0.005 and 0.005") == "0")
truth("I an order is flagged returned exactly when every line is", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and o.\"isReturned\" <> not exists (select 1 from order_item i where i.\"orderId\"=o.id and not i.\"isReturned\")") == "0")

# ============================================================ summary
if not os.environ.get("KEEP"):
    cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, dd)
sys.exit(1 if failed else 0)
