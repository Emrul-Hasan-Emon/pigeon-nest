#!/usr/bin/env python3
"""Black-box tests: returns and refunds (full order or items), the one-request rules, the seller and admin steps,
refund amounts, the delivery-charge choice, per-item commission and its take-back, the commission ledger and change log,
guards on cancel and payment reversal, concurrency, access and invariants."""
import base64, concurrent.futures as cf, json, os, subprocess, sys, tempfile, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads"))
TMP = tempfile.mkdtemp(prefix="ret")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
TAG = "T Olc"


def run(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    text, code = out.rsplit("\n", 1)
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = text
    return int(code), data


def call(method, path, token=None, body=None, session=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    return run(cmd)


def multi(method, path, token, fields=None, files=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    for k, v in (fields or {}).items():
        cmd += ["--form-string", f"{k}={v}"]
    for i, (name, data, mime) in enumerate(files or []):
        p = os.path.join(TMP, f"{i}-{uuid.uuid4().hex[:4]}")
        open(p, "wb").write(data)
        cmd += ["-F", f"files=@{p};type={mime};filename={name}"]
    return run(cmd)


def check(name, got, expected, pred=None):
    ok = got[0] in (expected if isinstance(expected, (list, tuple, set)) else [expected])
    note = ""
    if ok and pred is not None:
        try:
            ok = bool(pred(got[1]))
        except Exception as exc:  # noqa
            ok, note = False, f"predicate error: {exc!r}"
    detail = "" if ok else f"expected {expected} got {got[0]} {note} body={str(got[1])[:400]}"
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + detail))


def truth(name, cond, detail=""):
    results.append((bool(cond), name, "" if cond else detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  <-- " + str(detail)))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()




PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PROOF = [("proof.png", PNG, "image/png")]


def restore():
    sql("update seller_product set \"sellerId\"=5, \"activeStatus\"='active', status='approved' where id=94")
    sql("update seller_product_sku set \"isActive\"=true, \"discountedPriceStartDate\"=null where \"sellerProductId\" in (94,95,96)")
    sql("update seller_product_sku set quantity=60, price=3500, \"discountedPrice\"=3200 where id=119")
    sql("delete from system_setting where key like 'commission.%' or key like 'returns.%'")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")


def cleanup():
    sellers = f"select id from seller where name like '{TAG} %'"
    ids = f"select id from \"order\" where \"recipientName\" like '{TAG} %' or \"sellerId\" in ({sellers})"
    rets = f"select id from order_return where \"orderId\" in ({ids})"
    paths = sql(f"select \"filePath\" from payment_attachments where \"orderId\" in ({ids}) union select \"filePath\" from order_return_attachments where \"orderReturnId\" in ({rets})").split()
    sql(f"delete from system_commission_change_history where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission_history where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission_disburse where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission where \"sellerId\" in ({sellers})")
    sql(f"delete from order_refund_status_history where \"orderRefundId\" in (select id from order_refund where \"orderId\" in ({ids}))")
    sql(f"delete from order_refund where \"orderId\" in ({ids})")
    sql(f"delete from payment_claim where \"orderId\" in ({ids})")
    sql(f"delete from order_return_attachments where \"orderReturnId\" in ({rets})")
    sql(f"delete from order_return_status_history where \"orderReturnId\" in ({rets})")
    sql(f"delete from order_return_item where \"orderReturnId\" in ({rets})")
    sql(f"delete from order_return where \"orderId\" in ({ids})")
    sql(f"delete from order_update where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql(f"delete from \"order\" where id in ({ids})")
    sql("delete from cart where \"userId\" in (select id from \"user\" where email like 't-olc-%')")
    sql("delete from \"user\" where email like 't-olc-%'")
    restore()
    sql(f"delete from seller_setting_history where \"sellerId\" in ({sellers})")
    sql(f"delete from seller_setting where \"sellerId\" in ({sellers})")
    sql(f"delete from seller where name like '{TAG} %'")
    sql("delete from payment_gateway where slug like 't-olc-%'")
    for p in paths:
        try:
            os.unlink(os.path.join(UPLOADS, p))
        except OSError:
            pass


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
COD = int(sql("select id from payment_gateway where slug='cash-on-delivery'"))
A, SL, CK, CART, OR = "/admin/order", "/seller/order", "/user/order/checkout", "/user/carts", "/user/order"


def make_seller(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"{TAG} Seller {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = int(sql(f"select id from seller where name='{TAG} Seller {tag}'"))
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


def make_user(tag):
    c, d = call("POST", "/user/auth/register", body={"name": f"{TAG} User {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x", "email": f"t-olc-{tag}-{RUN}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


S1, SID1 = make_seller("111")
S2, SID2 = make_seller("222")
U1, UID1 = make_user("333")
U2, UID2 = make_user("444")
sql(f"update seller_product set \"sellerId\"={SID1} where id=94")
sql("update seller_product_sku set quantity=100, price=3200, \"discountedPrice\"=null where id=119")
sql("update system_setting set value='100' where key='shipping.defaultCharge'")
call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": "percentage", "commission.amount": 10, "returns.windowDays": 7, "returns.refundDeliveryCharge": True}})
MFS = int(sql(f"insert into payment_gateway (name, slug, type, \"accountNumber\", \"isActive\") values ('{TAG} MFS','t-olc-mfs-{RUN}','mfs','017',true) returning id").splitlines()[0])
PAYABLE, ITEMS, COMM = 3300, 3200, 320   # one bird 3200 + delivery 100; 10% of the item


def stock():
    return int(sql("select quantity from seller_product_sku where id=119"))


def bal(sid=SID1):
    r = sql(f"select \"totalCommission\"||'|'||\"dueCommission\"||'|'||\"paidCommission\" from system_commission where \"sellerId\"={sid}")
    return [float(x) for x in r.split("|")] if r else [0.0, 0.0, 0.0]


def addr(gateway=COD):
    return {"recipientName": f"{TAG} Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
            "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": gateway}


def place(token=None, gateway=COD, qty=1):
    token = token or U1
    c, d = call("POST", CART + "/items", token=token, body={"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": qty})
    assert c in (200, 201), d
    cart = d["cart"]["id"]
    body = addr(gateway)
    if gateway != COD:
        body["paymentProof"] = {"transactionId": "TX-" + uuid.uuid4().hex[:6]}
    c, o = call("POST", f"{CK}/{cart}/place", token=token, body=body)
    assert c == 201, o
    return o


def status(oid, to, who="s1", note=None):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1), "s2": (SL, S2)}[who]
    body = {"status": to}
    if note:
        body["note"] = note
    return call("PATCH", f"{base}/{oid}/status", tok, body)


def pay(oid, who="s1", amount=None, desc="Cash received at the door"):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1), "s2": (SL, S2)}[who]
    f = {"description": desc}
    if amount is not None:
        f["amount"] = amount
    return multi("POST", f"{base}/{oid}/payments", tok, f, PROOF)


def reverse(oid, pid, who="s1"):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1), "s2": (SL, S2)}[who]
    return call("POST", f"{base}/{oid}/payments/{pid}/reverse", tok, {"reason": "Wrong entry"})


def st(oid):
    return sql(f"select status||'|'||\"paymentStatus\"||'|'||\"amountPaid\"::numeric(14,2)||'|'||coalesce(\"refundStatus\",'-') from \"order\" where id={oid}")


def claim(oid, token=None, files=PROOF, **over):
    f = {"amount": PAYABLE, "transactionId": "BK-" + uuid.uuid4().hex[:6], "method": "bKash"}
    f.update(over)
    return multi("POST", f"/user/orders/{oid}/payment-claims", token or U1, f, files)


# ====================================================================================================
# A  placing and cancelling
# ====================================================================================================
s0 = stock()
o = place()
OA = o["id"]
check("A buyer places a cash on delivery order", (201, o), 201, pred=lambda v: v["status"] == "pending" and v["paymentStatus"] == "due" and v["totals"]["payable"] == PAYABLE)
truth("A stock went down by one", stock() == s0 - 1)
truth("A no commission yet (not paid)", bal() == [0.0, 0.0, 0.0], bal())
check("A buyer cancels while pending", call("POST", f"{OR}/{OA}/cancel", U1, {"reason": "Changed my mind"}), [200, 201], pred=lambda v: v["status"] == "cancelled")
truth("A cancelled order: stock came back", stock() == s0)
truth("A unpaid cancelled order has no refund record", sql(f"select count(*) from order_refund where \"orderId\"={OA}") == "0" and st(OA).endswith("|-"))
check("A another buyer cannot cancel it", call("POST", f"{OR}/{OA}/cancel", U2, {}), [403, 404])

ob = place()
OB = ob["id"]
check("A seller cancels a pending order", status(OB, "cancelled", "s1", "Out of stock"), 200, pred=lambda v: v["status"] == "cancelled")
truth("A seller cancel: stock came back", stock() == s0)

oc = place()
OC = oc["id"]
check("A seller confirms", status(OC, "confirmed"), 200)
check("A buyer cannot cancel after confirm", call("POST", f"{OR}/{OC}/cancel", U1, {}), 403)
check("A seller cannot cancel after confirm", status(OC, "cancelled", "s1"), 403)
check("A admin can cancel after confirm", status(OC, "cancelled", "admin"), 200, pred=lambda v: v["status"] == "cancelled")
truth("A admin cancel: stock came back", stock() == s0)
check("A seller cannot reopen a cancelled order", status(OC, "confirmed", "s1"), 403)

# ====================================================================================================
# B  payments and commission
# ====================================================================================================
od = place()
OD = od["id"]
status(OD, "confirmed")
c, p1 = pay(OD, amount=1000)
check("B seller records a part payment", (c, p1), 201)
truth("B part paid", st(OD).startswith("confirmed|partially_paid|1000"), st(OD))
truth("B commission not counted until fully paid", bal() == [0.0, 0.0, 0.0], bal())
check("B paying more than the balance is refused", pay(OD, amount=PAYABLE), 400)
check("B a payment without a proof file is refused", multi("POST", f"{SL}/{OD}/payments", S1, {"description": "No file"}), 400)
check("B another seller cannot pay it", pay(OD, "s2", amount=10), 404)
c, p2 = pay(OD)
check("B seller records the rest (no amount = the balance)", (c, p2), 201)
truth("B fully paid", st(OD).startswith(f"confirmed|paid|{PAYABLE}"), st(OD))
truth("B commission counted: 10% of the item", bal() == [COMM, COMM, 0.0], bal())
check("B a fully paid order takes no more payment", pay(OD, amount=5), 409)
check("B seller reverses the last payment", reverse(OD, p2["paymentId"]), [200, 201])
truth("B back to part paid", st(OD).startswith("confirmed|partially_paid|1000"), st(OD))
truth("B reversing took the commission back", bal() == [0.0, 0.0, 0.0], bal())
c, p3 = pay(OD)
truth("B paid again, commission counted again", st(OD).startswith(f"confirmed|paid|{PAYABLE}") and bal() == [COMM, COMM, 0.0], (st(OD), bal()))
for to in ("packed", "shipped", "delivered"):
    check(f"B seller moves it to {to}", status(OD, to), 200, pred=lambda v, to=to: v["status"] == to)
truth("B delivering keeps the commission", bal() == [COMM, COMM, 0.0], bal())
c, ds = multi("POST", f"/admin/commission/balances/{SID1}/disbursements", ADMIN, {"amount": 100, "notes": "First payment"}, PROOF)
check("B admin records a commission payment", (c, ds), 201)
truth("B total = due + paid after the payment", bal() == [COMM, COMM - 100, 100.0], bal())
check("B seller sees the balance", call("GET", "/seller/commission/balance", S1), 200, pred=lambda v: float(v["totalCommission"]) == COMM and float(v["paidCommission"]) == 100)
check("B seller cannot record a commission payment", multi("POST", f"/admin/commission/balances/{SID1}/disbursements", S1, {"amount": 5}), 403)

oe = place()
OE = oe["id"]
status(OE, "confirmed")
c, ap = pay(OE, "admin", amount=500)
check("B admin records a payment", (c, ap), 201)
check("B seller cannot reverse an admin's payment", reverse(OE, ap["paymentId"], "s1"), 403)
check("B admin can reverse it", reverse(OE, ap["paymentId"], "admin"), [200, 201])
check("B a cancelled order takes no payment", pay(OC), 409)

# ====================================================================================================
# C  mark as paid (cash on delivery claims)
# ====================================================================================================
b0 = bal()
of = place()
OF = of["id"]
check("C claim on a pending order -> 409", claim(OF), 409)
status(OF, "confirmed")
check("C claim with no proof file -> 400", claim(OF, files=[]), 400)
check("C claim with no transaction id -> 400", claim(OF, transactionId=""), 400)
check("C claim with no method -> 400", claim(OF, method=""), 400)
check("C claim for more than the balance -> 400", claim(OF, amount=PAYABLE + 1), 400)
check("C another buyer cannot claim", claim(OF, token=U2), 404)
check("C no token -> 401", multi("POST", f"/user/orders/{OF}/payment-claims", None, {"amount": 10, "transactionId": "x", "method": "bKash"}, PROOF), 401)
c, cl = claim(OF, transactionId="BK-OK-1")
check("C buyer sends a valid claim", (c, cl), 201, pred=lambda v: v["status"] == "pending")
CL1 = cl["id"]
check("C a second claim for the same order -> 409", claim(OF), 409)
check("C seller's pending count includes it", call("GET", "/seller/payment-claims/summary", S1), 200, pred=lambda v: v["pending"] >= 1)
check("C seller lists it", call("GET", "/seller/payment-claims?status=pending", S1), 200, pred=lambda v: CL1 in [r["id"] for r in v["results"]])
check("C admin lists it", call("GET", "/admin/payment-claims?status=pending", ADMIN), 200, pred=lambda v: CL1 in [r["id"] for r in v["results"]])
check("C other seller cannot see it", call("GET", "/seller/payment-claims?status=pending", S2), 200, pred=lambda v: CL1 not in [r["id"] for r in v["results"]])
check("C other seller cannot confirm", call("POST", f"/seller/payment-claims/{CL1}/confirm", S2, {}), 404)
check("C a buyer token cannot confirm", call("POST", f"/seller/payment-claims/{CL1}/confirm", U1, {}), 403)
truth("C the order is still unpaid before the decision", st(OF).startswith("confirmed|due|0"), st(OF))
check("C seller accepts: mark as paid", call("POST", f"/seller/payment-claims/{CL1}/confirm", S1, {}), 201, pred=lambda v: v["status"] == "confirmed" and v["paymentId"])
truth("C the order is now paid in full", st(OF).startswith(f"confirmed|paid|{PAYABLE}"), st(OF))
truth("C a payment row exists with the buyer's proof", sql(f"select count(*) from payment p join payment_attachments a on a.\"paymentId\"=p.id where p.\"orderId\"={OF}") != "0")
truth("C the commission was counted", bal()[0] == b0[0] + COMM, (b0, bal()))
check("C accepting again -> 409", call("POST", f"/seller/payment-claims/{CL1}/confirm", S1, {}), 409)
check("C the buyer sees the order with the confirmed claim", call("GET", f"{OR}/{OF}", U1), 200, pred=lambda v: v["paymentStatus"] == "paid" and any(x["status"] == "confirmed" for x in v.get("paymentClaims", [])))

og = place()
OG = og["id"]
status(OG, "confirmed")
c, cl = claim(OG)
CL2 = cl["id"]
check("C reject needs a reason -> 400", call("POST", f"/seller/payment-claims/{CL2}/reject", S1, {}), 400)
check("C seller rejects with a reason", call("POST", f"/seller/payment-claims/{CL2}/reject", S1, {"reason": "I cannot find this transaction ID"}), 201, pred=lambda v: v["status"] == "rejected")
truth("C a rejected claim leaves the order unpaid", st(OG).startswith("confirmed|due|0"), st(OG))
truth("C and adds no commission", bal()[0] == b0[0] + COMM, bal())
check("C a rejection is final: no second claim -> 409", claim(OG), 409)
check("C rejecting again -> 409", call("POST", f"/seller/payment-claims/{CL2}/reject", S1, {"reason": "again"}), 409)
check("C the buyer reads the reason", call("GET", f"{OR}/{OG}", U1), 200, pred=lambda v: any(x["status"] == "rejected" and "cannot find" in (x.get("decisionNote") or "") for x in v.get("paymentClaims", [])))
check("C the seller can still record the payment the normal way", pay(OG), 201)

oh = place()
OH = oh["id"]
status(OH, "confirmed")
c, cl = claim(OH, amount=1000)
check("C admin accepts a claim with a different amount", call("POST", f"/admin/payment-claims/{cl['id']}/confirm", ADMIN, {"amount": 900}), 201)
truth("C part paid with the amount the admin confirmed", st(OH).startswith("confirmed|partially_paid|900"), st(OH))
check("C a second claim after a decision -> 409", claim(OH, amount=100), 409)

omfs = place(gateway=MFS)
status(omfs["id"], "confirmed")
check("C claim on a non-cash-on-delivery order -> 400", claim(omfs["id"]), 400)
oi = place()
status(oi["id"], "confirmed")
pay(oi["id"])
check("C claim on a fully paid order -> 409", claim(oi["id"]), 409)
oj = place()
status(oj["id"], "cancelled", "s1")
check("C claim on a cancelled order -> 409", claim(oj["id"]), 409)

# ====================================================================================================
# D  refunds of cancelled paid orders
# ====================================================================================================
r0 = bal()
ok = place()
OK = ok["id"]
check("D seller records the full payment while pending", pay(OK), 201)
truth("D commission counted when paid", bal()[0] == r0[0] + COMM, (r0, bal()))
check("D seller cancels the paid pending order", status(OK, "cancelled", "s1", "Cannot supply"), 200)
truth("D the order says needs_to_refund", st(OK).endswith("|needs_to_refund"), st(OK))
truth("D the cancel took the commission back", bal()[0] == r0[0], (r0, bal()))
rec = sql(f"select id||'|'||kind||'|'||status||'|'||\"expectedAmount\"::numeric(14,2) from order_refund where \"orderId\"={OK}")
truth("D one refund record: cancelled_order, needs_to_refund, expected = amount paid", rec.endswith(f"|cancelled_order|needs_to_refund|{PAYABLE}.00"), rec)
RID = int(rec.split("|")[0])
check("D seller list has it", call("GET", "/seller/order/refunds", S1), 200, pred=lambda v: RID in [r["id"] for r in v["results"]])
check("D seller summary counts it", call("GET", "/seller/order/refunds/summary", S1), 200, pred=lambda v: v["needsToRefund"] >= 1)
check("D dashboard attention counts it", call("GET", "/seller/dashboard/attention", S1), 200, pred=lambda v: v["refundsToSend"] >= 1)
check("D admin list has it", call("GET", "/admin/order/refunds", ADMIN), 200, pred=lambda v: RID in [r["id"] for r in v["results"]])
check("D other seller cannot read it", call("GET", f"/seller/order/refunds/{RID}", S2), 404)
check("D buyer sees the refund state, read only", call("GET", f"{OR}/{OK}", U1), 200, pred=lambda v: v["refundStatus"] == "needs_to_refund" and len(v["refunds"]) == 1)
check("D a buyer cannot use the seller refund route", call("POST", f"/seller/order/refunds/{RID}/status", U1, {"status": "processing"}), 403)
check("D seller cannot jump to refunded", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "refunded", "amount": PAYABLE, "note": "Sent"}, PROOF), [400, 403, 409])
check("D seller starts the refund", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "processing"}), 201, pred=lambda v: v["status"] == "processing")
truth("D the order follows: processing", st(OK).endswith("|processing"), st(OK))
check("D refunded with no amount -> 400", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "refunded", "note": "Sent"}, PROOF), 400)
check("D refunded with the wrong amount -> 400 (must match)", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "refunded", "amount": PAYABLE - 300, "note": "Sent"}, PROOF), 400, pred=lambda v: "exactly" in str(v))
check("D refunded with no note -> 400", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "refunded", "amount": PAYABLE}, PROOF), 400)
check("D refunded with no proof file -> 400", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "refunded", "amount": PAYABLE, "note": "Sent"}), 400)
check("D a cancelled order cannot be reopened while refunding", status(OK, "pending", "admin"), 409)
check("D seller marks it refunded with amount, note and proof", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "refunded", "amount": PAYABLE, "note": "Sent by bKash 3pm", "transactionId": "REF1"}, PROOF), 201, pred=lambda v: v["status"] == "refunded" and float(v["amount"]) == PAYABLE)
truth("D the order follows: refunded", st(OK).endswith("|refunded"), st(OK))
truth("D history has every step", int(sql(f"select count(*) from order_refund_status_history where \"orderRefundId\"={RID}")) >= 3)
check("D a seller cannot move a refunded refund back", multi("POST", f"/seller/order/refunds/{RID}/status", S1, {"status": "processing"}), [400, 403, 409])
check("D buyer sees the finished refund", call("GET", f"{OR}/{OK}", U1), 200, pred=lambda v: v["refundStatus"] == "refunded" and v["refunds"][0]["status"] == "refunded")
check("D admin adds another record on the order (buyer says it never came)", multi("POST", f"{A}/{OK}/refunds", ADMIN, {"status": "refunded", "amount": PAYABLE, "note": "Sent again by bank", "transactionId": "REF2"}), 201)
check("D now the order has two records, all visible to the buyer", call("GET", f"{OR}/{OK}", U1), 200, pred=lambda v: len(v["refunds"]) == 2)
check("D admin can set any status", multi("POST", f"{A}/refunds/{RID}/status", ADMIN, {"status": "needs_to_refund"}), 201)
check("D an admin cannot add a record with a wrong amount", multi("POST", f"{A}/{OK}/refunds", ADMIN, {"status": "refunded", "amount": 1, "note": "wrong"}), 400)

ol = place()
OL = ol["id"]
pay(OL, amount=1000)
status(OL, "cancelled", "s1")
truth("D part paid cancel: expected refund = what was paid", sql(f"select \"expectedAmount\"::numeric(14,2) from order_refund where \"orderId\"={OL}") == "1000.00", sql(f"select \"expectedAmount\" from order_refund where \"orderId\"={OL}"))

om = place()
OM = om["id"]
status(OM, "confirmed", "s1")
pay(OM)
before = bal()[0]
check("D admin cancels a paid confirmed order", status(OM, "cancelled", "admin"), 200)
truth("D refund opened, commission taken back", st(OM).endswith("|needs_to_refund") and bal()[0] == before - COMM, (st(OM), before, bal()))
check("D admin reopens it before any refund started", status(OM, "confirmed", "admin"), 200)
truth("D the refund record is voided and the order has no refund", st(OM).endswith("|-") and sql(f"select count(*) from order_refund where \"orderId\"={OM} and status='voided'") == "1", st(OM))
truth("D the commission counted again", bal()[0] == before, (before, bal()))

# ====================================================================================================
# E  returns, money records and commission
# ====================================================================================================
on = place()
ON = on["id"]
status(ON, "confirmed", "s1")
pay(ON)
for to in ("packed", "shipped", "delivered"):
    status(ON, to, "s1")
cb = bal()
check("E buyer can ask for a return after delivery", call("GET", f"/user/returns/eligibility/{ON}", U1), 200, pred=lambda v: v["fullOrder"]["allowed"] is True)
c, r = multi("POST", "/user/returns", U1, {"orderId": ON, "scope": "full_order", "reasonCode": "not_as_described", "reason": "The bird is not as shown"}, PROOF)
check("E buyer asks to return the whole order", (c, r), 201, pred=lambda v: v["status"] == "return_requested" and v["reasonCode"] == "not_as_described")
RT = r["id"]
check("E a second request for the same order is refused", multi("POST", "/user/returns", U1, {"orderId": ON, "scope": "full_order", "reasonCode": "other", "reason": "again please"}), [400, 409])
check("E seller reject needs a note", call("POST", f"/seller/returns/{RT}/reject", S1, {}), 400)
check("E seller cannot skip to money", multi("POST", f"/seller/returns/{RT}/returning-money", S1, {"note": "Sent it already"}, PROOF), 409)
check("E seller accepts", call("POST", f"/seller/returns/{RT}/accept", S1, {"includeDeliveryCharge": True}), 201, pred=lambda v: v["status"] == "accepted" and float(v["refundAmount"]) == PAYABLE)
check("E seller starts processing", call("POST", f"/seller/returns/{RT}/processing", S1, {}), 201)
check("E returning money needs a note", multi("POST", f"/seller/returns/{RT}/returning-money", S1, {}, PROOF), 400)
check("E seller says the money is on its way", multi("POST", f"/seller/returns/{RT}/returning-money", S1, {"note": "Refunded by bKash"}, PROOF), 201, pred=lambda v: v["status"] == "returning_money")
truth("E commission is not taken back until an admin confirms", bal() == cb, (cb, bal()))
check("E a seller cannot confirm returned", multi("POST", f"/admin/returns/{RT}/status", S1, {"status": "returned"}), 403)
check("E admin confirms returned", multi("POST", f"/admin/returns/{RT}/status", ADMIN, {"status": "returned", "note": "Money confirmed"}), 201, pred=lambda v: v["status"] == "returned" and v["commissionAmount"] == COMM)
truth("E the commission came back off the balance", bal()[0] == cb[0] - COMM, (cb, bal()))
truth("E the order is flagged returned", sql(f"select \"isReturned\" from \"order\" where id={ON}") == "t")
check("E admin adds another money record (buyer says it never came)", multi("POST", f"/admin/order/returns/{RT}/money-records", ADMIN, {"status": "refunded", "amount": PAYABLE, "note": "Sent again by bank"}), 201)
check("E the buyer sees the money records on the return", call("GET", f"/user/returns/{RT}", U1), 200, pred=lambda v: len(v.get("moneyRecords", [])) >= 1)
check("E the seller sees them too", call("GET", f"/seller/returns/{RT}", S1), 200, pred=lambda v: len(v.get("moneyRecords", [])) >= 1)

oo = place()
OO = oo["id"]
status(OO, "confirmed", "s1")
pay(OO)
for to in ("packed", "shipped", "delivered"):
    status(OO, to, "s1")
sql(f"update order_status_history set \"createdAt\" = now() - interval '9 days' where \"orderId\"={OO} and status='delivered'")
check("E after the window the buyer cannot ask", multi("POST", "/user/returns", U1, {"orderId": OO, "scope": "full_order", "reasonCode": "other", "reason": "too late now"}), [400, 409])
check("E an admin still can", multi("POST", "/admin/returns", ADMIN, {"orderId": OO, "scope": "full_order", "reasonCode": "other", "reason": "Admin opened this return"}), 201)

# ====================================================================================================
# I  invariants
# ====================================================================================================
sellers = f"select id from seller where name like '{TAG} %'"
truth("I total = due + paid for every test seller", sql(f"select count(*) from system_commission where \"sellerId\" in ({sellers}) and abs(\"totalCommission\" - \"dueCommission\" - \"paidCommission\") > 0.005") == "0")
truth("I amountPaid is never negative", sql(f"select count(*) from \"order\" where \"sellerId\" in ({sellers}) and \"amountPaid\" < 0") == "0")
truth("I amountPaid equals the live receipts on every test order", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and o.\"amountPaid\" <> coalesce((select sum(amount) from payment p where p.\"orderId\"=o.id and p.status <> 'due'),0)") == "0")
truth("I at most one claim for each order", sql(f"select count(*) from (select \"orderId\" from payment_claim where \"sellerId\" in ({sellers}) group by 1 having count(*) > 1) x") == "0")
truth("I order.refundStatus matches the latest record that counts", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and o.\"refundStatus\" is distinct from (select r.status from order_refund r where r.\"orderId\"=o.id and r.kind='cancelled_order' and r.status<>'voided' order by r.id desc limit 1)") == "0")

cleanup()
fails = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(fails)}/{len(results)} passed, {len(fails)} failed ====")
for _, name, detail in fails:
    print("FAILED:", name, detail[:300])
sys.exit(1 if fails else 0)
