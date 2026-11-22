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
TAG = "T Ret"


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




def restore():
    sql("update seller_product set \"sellerId\"=5, \"activeStatus\"='active', status='approved' where id=94")
    sql("update seller_product set \"sellerId\"=6, \"activeStatus\"='active', status='approved' where id=95")
    sql("update seller_product_sku set \"isActive\"=true, \"discountedPriceStartDate\"=null where \"sellerProductId\" in (94,95,96)")
    sql("update seller_product_sku set quantity=60, price=3500, \"discountedPrice\"=3200 where id=119")
    sql("update seller_product_sku set quantity=4, price=3800, \"discountedPrice\"=3800 where id=120")
    sql("update seller_product_sku set quantity=3, price=7000, \"discountedPrice\"=6500 where id=121")
    sql("update seller_product_sku set quantity=40, price=3000, \"discountedPrice\"=null where id=122")
    sql("delete from system_setting where key like 'commission.%' or key like 'returns.%'")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")


def cleanup():
    sellers = f"select id from seller where name like '{TAG} %'"
    ids = f"select id from \"order\" where \"recipientName\" like '{TAG} %' or \"sellerId\" in ({sellers})"
    paths = sql(f"select \"filePath\" from payment_attachments where \"orderId\" in ({ids}) union select \"filePath\" from order_return_attachments where \"orderReturnId\" in (select id from order_return where \"orderId\" in ({ids}))").split()
    sql(f"delete from system_commission_change_history where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission_history where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission where \"sellerId\" in ({sellers})")
    sql(f"delete from order_return_attachments where \"orderReturnId\" in (select id from order_return where \"orderId\" in ({ids}))")
    sql(f"delete from order_return_status_history where \"orderReturnId\" in (select id from order_return where \"orderId\" in ({ids}))")
    sql(f"delete from order_return_item where \"orderReturnId\" in (select id from order_return where \"orderId\" in ({ids}))")
    sql(f"delete from order_return where \"orderId\" in ({ids})")
    sql(f"delete from order_update where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql(f"delete from \"order\" where id in ({ids})")
    sql(f"delete from cart where \"sessionId\" like 'tret{RUN}%'")
    sql("delete from cart where \"userId\" in (select id from \"user\" where email like 't-ret-%')")
    sql("delete from \"user\" where email like 't-ret-%'")
    restore()
    sql(f"delete from seller_setting_history where \"sellerId\" in ({sellers})")
    sql(f"delete from seller_setting where \"sellerId\" in ({sellers})")
    sql(f"delete from seller where name like '{TAG} %'")
    for p in paths:
        try:
            os.unlink(os.path.join(UPLOADS, p))
        except OSError:
            pass


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
COD = int(sql("select id from payment_gateway where slug='cash-on-delivery'"))
A, SL, CK, CART = "/admin/orders", "/seller/orders", "/user/checkout", "/user/carts"
RA, RS, RU = "/admin/returns", "/seller/returns", "/user/returns"


def make_seller(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"{TAG} Seller {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = int(sql(f"select id from seller where name='{TAG} Seller {tag}'"))
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


def make_user(tag):
    c, d = call("POST", "/user/auth/register", body={"name": f"{TAG} User {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x", "email": f"t-ret-{tag}-{RUN}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


S1, SID1 = make_seller("111")
S2, SID2 = make_seller("222")
USER, UID = make_user("333")
OTHER, OID_ = make_user("444")
sql(f"update seller_product set \"sellerId\"={SID1} where id=94")
sql(f"update seller_product set \"sellerId\"={SID2} where id=95")
sql("update system_setting set value='100' where key='shipping.defaultCharge'")
sql("update seller_product_sku set quantity=60 where id in (120,121)")
call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": "percentage", "commission.amount": 10, "returns.windowDays": 7, "returns.refundDeliveryCharge": True}})
ctr = [0]
PROOF = [("proof.png", PNG, "image/png")]


def sess():
    ctr[0] += 1
    return f"tret{RUN}s{ctr[0]}"


def addr(**over):
    p = {"recipientName": f"{TAG} Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
         "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": COD}
    p.update(over)
    return p


def make_order(skus=((119, 1),), product=94, token=None, delivered=True, paid=True, who="user"):
    """Place an order (customer or guest), pay it, deliver it. Returns the order."""
    s = sess() if who == "guest" else None
    tok = (token or USER) if who == "user" else None
    cart = None
    for sku, qty in skus:
        c, d = call("POST", CART + "/items", token=tok, body={"sellerProductId": product, "sellerProductSkuId": sku, "quantity": qty}, session=s)
        assert c in (200, 201), d
        cart = d["cart"]["id"]
    c, o = call("POST", f"{CK}/{cart}/place", token=tok, session=s, body=addr())
    assert c == 201, o
    if paid:
        c, p = multi("POST", f"{A}/{o['id']}/payments", ADMIN, {"description": "Cash received at the door"}, PROOF)
        assert c in (200, 201), p
    if delivered:
        c, p = call("PATCH", f"{A}/{o['id']}/status", ADMIN, {"status": "delivered"})
        assert c == 200, p
    return o


def items_of(oid):
    return [int(x) for x in sql(f"select id from order_item where \"orderId\"={oid} order by id").split()]


def bal(sid):
    r = sql(f"select \"totalCommission\"||'|'||\"dueCommission\"||'|'||\"paidCommission\" from system_commission where \"sellerId\"={sid}")
    return [float(x) for x in r.split("|")] if r else [0.0, 0.0, 0.0]


def flags(oid):
    return sql(f"select \"isReturned\" from \"order\" where id={oid}"), sql(f"select string_agg(case when \"isReturned\" then 't' else 'f' end, ',' order by id) from order_item where \"orderId\"={oid}")


def req(oid, scope="items", ids=None, reason="Item arrived damaged", token=None, files=None, extra=None):
    f = {"orderId": oid, "scope": scope, "reason": reason}
    if ids is not None:
        f["orderItemIds"] = ",".join(str(i) for i in ids)
    f.update(extra or {})
    return multi("POST", RA if token == ADMIN else RU, token or USER, f, files)


def adm_req(oid, scope="items", ids=None, reason="Admin opened this return", extra=None, files=None):
    return req(oid, scope, ids, reason, ADMIN, files, extra)


def seller_do(rid, step, body=None, token=None):
    return call("POST", f"{RS}/{rid}/{step}", token or S1, body or {})


def admin_status(rid, status, note="Admin moved it", extra=None, files=None):
    f = {"status": status, "note": note}
    f.update(extra or {})
    return multi("POST", f"{RA}/{rid}/status", ADMIN, f, files)


def rstate(rid):
    return sql(f"select status from order_return where id={rid}")


def full_cycle(rid):
    """accept -> processing -> returning_money (with proof) -> admin returned."""
    assert seller_do(rid, "accept")[0] == 201
    assert seller_do(rid, "processing")[0] == 201
    c, d = multi("POST", f"{RS}/{rid}/returning-money", S1, {"note": "Refunded by bank transfer"}, PROOF)
    assert c == 201, d
    c, d = admin_status(rid, "returned", "Money confirmed")
    assert c == 201, d


def changes(sid, status=None):
    where = f"where \"sellerId\"={sid}" + (f" and \"commissionStatus\"='{status}'" if status else "")
    return int(sql(f"select count(*) from system_commission_change_history {where}"))


# ============================================================ S  settings
c, s = call("GET", "/admin/settings", ADMIN)
check("S settings list has the return window", (c, s), 200, pred=lambda v: any(x["key"] == "returns.windowDays" and x["value"] == 7 for x in v))
check("S settings list has the delivery refund choice", (c, s), 200, pred=lambda v: any(x["key"] == "returns.refundDeliveryCharge" and x["value"] is True and x["type"] == "boolean" for x in v))
check("S window of 366 days -> 400", call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.windowDays": 366}}), 400)
check("S window of -1 -> 400", call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.windowDays": -1}}), 400)
check("S refund choice as text -> 400", call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.refundDeliveryCharge": "yes"}}), 400)
check("S seller cannot change settings", call("PATCH", "/admin/settings", S1, {"settings": {"returns.windowDays": 3}}), 403)

# ============================================================ C  per-item commission
o1 = make_order(((119, 1), (120, 1), (121, 1)))
rows = sql(f"select string_agg(\"systemCommission\"::text, ',' order by id) from order_item where \"orderId\"={o1['id']}")
truth("C each line carries its own commission (10% of 3200, 3800, 6500)", rows == "320,380,650", rows)
truth("C order commission is the sum of its lines", sql(f"select \"systemCommission\" from \"order\" where id={o1['id']}") == "1350")
truth("C line seller amounts are payable minus commission", sql(f"select string_agg(\"sellerAmount\"::text, ',' order by id) from order_item where \"orderId\"={o1['id']}") == "2880,3420,5850")
truth("C order seller amount = payable (with delivery) minus commission", sql(f"select \"sellerAmount\" from \"order\" where id={o1['id']}") == "12250")
check("C seller's order view shows line commission", call("GET", f"{SL}/{o1['id']}", S1), 200, pred=lambda v: [i["systemCommission"] for i in v["items"]] == [320, 380, 650] and all(i["isReturned"] is False for i in v["items"]))
check("C customer's order view hides line commission", call("GET", f"/user/orders/{o1['id']}", USER), 200, pred=lambda v: all("systemCommission" not in i and "sellerAmount" not in i for i in v["items"]) and v["returns"] == [])
call("PUT", f"/admin/sellers/{SID1}/commission-setting", ADMIN, {"commissionType": "fixed", "commissionAmount": 50})
of = make_order(((119, 1), (120, 1)))
truth("C a fixed amount applies per line (2 lines -> 100)", sql(f"select \"systemCommission\" from \"order\" where id={of['id']}") == "100")
call("PUT", f"/admin/sellers/{SID1}/commission-setting", ADMIN, {"commissionType": "fixed", "commissionAmount": 99999})
oc = make_order(((119, 1), (120, 1)))
truth("C a fixed amount never exceeds the line (commission = lines total, delivery stays with the seller)", sql(f"select \"systemCommission\"||'|'||\"sellerAmount\" from \"order\" where id={oc['id']}") == "7000|100")
truth("C no line seller amount below zero", sql(f"select count(*) from order_item where \"orderId\"={oc['id']} and \"sellerAmount\" < 0") == "0")
call("PUT", f"/admin/sellers/{SID1}/commission-setting", ADMIN, {"commissionType": "percentage", "commissionAmount": 10})
truth("C earlier orders were not touched by the rule change", sql(f"select \"systemCommission\" from \"order\" where id={o1['id']}") == "1350")

# ============================================================ L  ledger and change log on earning
tot = bal(SID1)
truth("L balance = commission of the paid orders so far", abs(tot[0] - (1350 + 100 + 7000)) < 0.005, tot)
truth("L earning wrote a change row per paid order with status for_system", changes(SID1, "for_system") == 3)
truth("L ledger rows say for_system", sql(f"select count(*) from system_commission_history where \"sellerId\"={SID1} and type='order_commission' and status='for_system'") == "3")
c, ch = call("GET", f"/admin/commission/changes?sellerId={SID1}", ADMIN)
check("L admin change log lists them newest first", (c, ch), 200, pred=lambda v: len(v["results"]) == 3 and v["results"][0]["id"] > v["results"][1]["id"] and v["results"][0]["commissionStatus"] == "for_system")
check("L change rows show before and after", (c, ch), 200, pred=lambda v: v["results"][0]["newTotalCommission"] - v["results"][0]["currentTotalCommission"] == 7000 and v["results"][0]["newDueCommission"] - v["results"][0]["currentDueCommission"] == 7000 and v["results"][0]["newPaidCommission"] == v["results"][0]["currentPaidCommission"])
check("L change rows link to the order and the seller name", (c, ch), 200, pred=lambda v: v["results"][0]["orderId"] == oc["id"] and v["results"][0]["sellerName"].startswith(TAG))
check("L change log needs a token", call("GET", "/admin/commission/changes"), 401)
check("L seller cannot use the admin change log", call("GET", "/admin/commission/changes", S1), 403)
check("L customer cannot use it", call("GET", "/admin/commission/changes", USER), 403)
check("L seller sees only their own changes", call("GET", f"/seller/commission/changes?sellerId={SID2}", S1), 200, pred=lambda v: len(v["results"]) == 3 and all(r["sellerId"] == SID1 for r in v["results"]))
check("L seller of no activity sees none", call("GET", "/seller/commission/changes", S2), 200, pred=lambda v: v["results"] == [])
check("L filter by status", call("GET", f"/admin/commission/changes?sellerId={SID1}&status=order_returned_to_customer", ADMIN), 200, pred=lambda v: v["results"] == [])
check("L bad status -> 400", call("GET", "/admin/commission/changes?status=nope", ADMIN), 400)
c, p1 = call("GET", f"/admin/commission/changes?sellerId={SID1}&limit=2", ADMIN)
check("L change log pages with a cursor", (c, p1), 200, pred=lambda v: len(v["results"]) == 2 and v["nextCursor"])
check("L change log page 2", call("GET", f"/admin/commission/changes?sellerId={SID1}&limit=2&cursor={p1['nextCursor']}", ADMIN), 200, pred=lambda v: len(v["results"]) == 1)
check("L ledger filter by status", call("GET", f"/admin/commission/history?sellerId={SID1}&status=for_system", ADMIN), 200, pred=lambda v: len(v["results"]) == 3 and all(r["status"] == "for_system" for r in v["results"]))

# ============================================================ E  eligibility
ou = make_order(((119, 1),), delivered=False)
c, e = call("GET", f"{RU}/eligibility/{ou['id']}", USER)
check("E an order not delivered cannot be returned", (c, e), 200, pred=lambda v: v["fullOrder"]["allowed"] is False and "delivered" in v["fullOrder"]["reason"] and v["items"][0]["allowed"] is False)
oun = make_order(((119, 1),), paid=False, delivered=True)
check("E an unpaid order cannot be returned", call("GET", f"{RU}/eligibility/{oun['id']}", USER), 200, pred=lambda v: "paid" in v["fullOrder"]["reason"])
check("E creating on an undelivered order -> 409", req(ou["id"], "full_order"), 409)
check("E creating on an unpaid order -> 409", req(oun["id"], "full_order"), 409)
oe = make_order(((119, 1), (120, 1)))
check("E a delivered paid order: full order allowed, refund = lines + delivery", call("GET", f"{RU}/eligibility/{oe['id']}", USER), 200, pred=lambda v: v["fullOrder"]["allowed"] and v["fullOrder"]["refundAmount"] == 7100 and v["fullOrder"]["itemsAmount"] == 7000 and v["fullOrder"]["deliveryCharge"] == 100 and v["fullOrder"]["includeDeliveryCharge"] is True)
check("E each item shows what it would refund (no delivery)", call("GET", f"{RU}/eligibility/{oe['id']}", USER), 200, pred=lambda v: [i["refundAmount"] for i in v["items"]] == [3200, 3800] and all(i["allowed"] for i in v["items"]))
check("E return window is shown", call("GET", f"{RU}/eligibility/{oe['id']}", USER), 200, pred=lambda v: v["returnWindowDays"] == 7 and v["windowEndsAt"])
check("E someone else's order -> 404", call("GET", f"{RU}/eligibility/{oe['id']}", OTHER), 404)
check("E unknown order -> 404", call("GET", f"{RU}/eligibility/99999999", USER), 404)
check("E bad id -> 400", call("GET", f"{RU}/eligibility/abc", USER), 400)
check("E no token -> 401", call("GET", f"{RU}/eligibility/{oe['id']}"), 401)
check("E seller token on the customer route -> 403", call("GET", f"{RU}/eligibility/{oe['id']}", S1), 403)

# ============================================================ V  create: validation and access
ids_e = items_of(oe["id"])
check("V no token -> 401", multi("POST", RU, None, {"orderId": oe["id"], "scope": "full_order", "reason": "Wrong bird sent"}), 401)
check("V seller token -> 403", multi("POST", RU, S1, {"orderId": oe["id"], "scope": "full_order", "reason": "Wrong bird sent"}), 403)
check("V someone else's order -> 404", req(oe["id"], "full_order", token=OTHER), 404)
check("V unknown order -> 404", req(99999999, "full_order"), 404)
check("V orderId missing -> 400", multi("POST", RU, USER, {"scope": "full_order", "reason": "Wrong bird sent"}), 400)
check("V scope missing -> 400", multi("POST", RU, USER, {"orderId": oe["id"], "reason": "Wrong bird sent"}), 400)
check("V scope unknown -> 400", req(oe["id"], "half"), 400)
check("V reason missing -> 400", multi("POST", RU, USER, {"orderId": oe["id"], "scope": "full_order"}), 400)
check("V reason too short -> 400", req(oe["id"], "full_order", reason="no"), 400)
check("V reason too long -> 400", req(oe["id"], "full_order", reason="x" * 2001), 400)
check("V scope items without ids -> 400", req(oe["id"], "items"), 400)
check("V empty id list -> 400", req(oe["id"], "items", ids=[]), 400)
check("V item that is not on the order -> 400", req(oe["id"], "items", ids=[99999999]), 400)
check("V an item of another order -> 400", req(oe["id"], "items", ids=items_of(o1["id"])[:1]), 400)
check("V duplicate ids -> 400", multi("POST", RU, USER, {"orderId": oe["id"], "scope": "items", "orderItemIds": f"{ids_e[0]},{ids_e[0]}", "reason": "Wrong bird sent"}), 400)
check("V ids as text -> 400", multi("POST", RU, USER, {"orderId": oe["id"], "scope": "items", "orderItemIds": "a,b", "reason": "Wrong bird sent"}), 400)
check("V ids sent with a full-order return -> 400", req(oe["id"], "full_order", ids=ids_e[:1]), 400)
check("V unknown field -> 400", req(oe["id"], "full_order", extra={"refundAmount": 1}), 400)
check("V a bad file is refused", req(oe["id"], "full_order", files=[("x.exe", b"MZ", "application/x-msdownload")]), 400)
truth("V nothing was stored by the failures", sql(f"select count(*) from order_return where \"orderId\"={oe['id']}") == "0")

# ============================================================ F  the one-request rules
OF = make_order(((119, 1), (120, 1), (121, 1)))
ia, ib, ic = items_of(OF["id"])
c, ra = req(OF["id"], "items", [ia])
check("F a customer asks to return one item", (c, ra), 201, pred=lambda v: v["status"] == "return_requested" and v["scope"] == "items" and v["refundAmount"] == 3200 and v["deliveryAmount"] == 0 and v["includeDeliveryCharge"] is False and len(v["items"]) == 1 and v["returnNumber"].startswith("RT") and v["requestedBy"]["type"] == "user")
check("F the first history row is the request", (c, ra), 201, pred=lambda v: len(v["history"]) == 1 and v["history"][0]["status"] == "return_requested" and v["history"][0]["fromStatus"] is None and v["history"][0]["by"]["type"] == "user")
check("F the customer never sees commission", (c, ra), 201, pred=lambda v: "commissionAmount" not in v and "commissionAmount" not in v["items"][0])
RA_ID = ra["id"]
check("F the same item again -> 409", req(OF["id"], "items", [ia]), 409)
check("F a full-order request after an item request -> 409", req(OF["id"], "full_order"), 409)
check("F another item is still fine", req(OF["id"], "items", [ib]), 201)
c, rc = req(OF["id"], "items", [ic], files=PROOF)
check("F a request with a photo", (c, rc), 201, pred=lambda v: len(v["history"][0]["attachments"]) == 1 and v["history"][0]["attachments"][0]["kind"] == "image")
RB_ID = int(sql(f"select id from order_return where \"orderId\"={OF['id']} and exists (select 1 from order_return_item i where i.\"orderReturnId\"=order_return.id and i.\"orderItemId\"={ib})"))
RC_ID = rc["id"]
check("F the eligibility now blocks the requested items", call("GET", f"{RU}/eligibility/{OF['id']}", USER), 200, pred=lambda v: not v["fullOrder"]["allowed"] and all(not i["allowed"] and "already requested" in i["reason"] for i in v["items"]))
check("F the customer cancels a request that is only requested", call("POST", f"{RU}/{RA_ID}/cancel", USER, {}), 201, pred=lambda v: v["status"] == "cancelled" and v["history"][-1]["status"] == "cancelled")
check("F cancelling again -> 409", call("POST", f"{RU}/{RA_ID}/cancel", USER, {}), 409)
check("F after cancelling, the customer cannot ask again (one request for life)", req(OF["id"], "items", [ia]), 409)
check("F eligibility still says so", call("GET", f"{RU}/eligibility/{OF['id']}", USER), 200, pred=lambda v: v["items"][0]["allowed"] is False)
c, ra2 = adm_req(OF["id"], "items", [ia])
check("F an admin can open another one for the cancelled item", (c, ra2), 201, pred=lambda v: v["requestedBy"]["type"] == "admin" and v["status"] == "return_requested")
check("F an admin cannot open a second one while one is open", adm_req(OF["id"], "items", [ia]), 409)
check("F an admin cannot open a full return while items are in open returns", adm_req(OF["id"], "full_order"), 409)
RA2_ID = ra2["id"]
check("F a customer cannot cancel someone else's request -> 404", call("POST", f"{RU}/{RB_ID}/cancel", OTHER, {}), 404)
check("F unknown return -> 404", call("POST", f"{RU}/99999999/cancel", USER, {}), 404)

# ============================================================ T  seller steps and who may do what
check("T reject needs a note -> 400", seller_do(RB_ID, "reject", {}), 400)
check("T reject with a short note -> 400", seller_do(RB_ID, "reject", {"note": "n"}), 400)
check("T another seller cannot see it -> 404", seller_do(RB_ID, "reject", {"note": "Not mine to reject"}, S2), 404)
check("T a customer cannot use the seller route -> 403", call("POST", f"{RS}/{RB_ID}/accept", USER, {}), 403)
check("T no token -> 401", call("POST", f"{RS}/{RB_ID}/accept", None, {}), 401)
check("T processing straight from requested -> 409", seller_do(RB_ID, "processing"), 409)
check("T returning money straight from requested -> 409", multi("POST", f"{RS}/{RB_ID}/returning-money", S1, {"note": "Sent the money"}), 409)
check("T the seller rejects with a reason", seller_do(RB_ID, "reject", {"note": "The bird was healthy when it left"}), 201, pred=lambda v: v["status"] == "rejected" and v["history"][-1]["note"] == "The bird was healthy when it left" and v["history"][-1]["by"]["type"] == "seller")
check("T the customer sees the rejection note", call("GET", f"{RU}/{RB_ID}", USER), 200, pred=lambda v: v["history"][-1]["note"] and v["status"] == "rejected")
check("T a rejected item cannot be requested again by the customer", req(OF["id"], "items", [ib]), 409)
check("T accepting a rejected return -> 409", seller_do(RB_ID, "accept"), 409)
check("T cancelling a rejected return -> 409", call("POST", f"{RU}/{RB_ID}/cancel", USER, {}), 409)
c, rb2 = adm_req(OF["id"], "items", [ib])
check("T an admin can still open one for a rejected item", (c, rb2), 201)
check("T the delivery choice is for full-order returns only -> 400", seller_do(RC_ID, "accept", {"includeDeliveryCharge": False}), 400)
check("T the seller accepts", seller_do(RC_ID, "accept", {"note": "Please send it back"}), 201, pred=lambda v: v["status"] == "accepted" and v["history"][-1]["note"] == "Please send it back")
check("T accepting twice -> 409", seller_do(RC_ID, "accept"), 409)
check("T rejecting after accepting -> 409", seller_do(RC_ID, "reject", {"note": "Changed my mind"}), 409)
check("T the customer cannot cancel after accept -> 409", call("POST", f"{RU}/{RC_ID}/cancel", USER, {}), 409)
check("T returning money before processing -> 409", multi("POST", f"{RS}/{RC_ID}/returning-money", S1, {"note": "Sent the money"}), 409)
check("T processing", seller_do(RC_ID, "processing", {"note": "Bird is back, checking it"}), 201, pred=lambda v: v["status"] == "processing")
check("T processing twice -> 409", seller_do(RC_ID, "processing"), 409)
check("T returning money needs a description -> 400", multi("POST", f"{RS}/{RC_ID}/returning-money", S1, {}), 400)
check("T returning money: a bad file is refused", multi("POST", f"{RS}/{RC_ID}/returning-money", S1, {"note": "Sent the money"}, [("x.exe", b"MZ", "application/x-msdownload")]), 400)
truth("T the failed attempts changed nothing", rstate(RC_ID) == "processing")
c, rm = multi("POST", f"{RS}/{RC_ID}/returning-money", S1, {"note": "Refunded 6500 by bank transfer"}, PROOF)
check("T returning money with a description and proof", (c, rm), 201, pred=lambda v: v["status"] == "returning_money" and v["history"][-1]["note"] == "Refunded 6500 by bank transfer" and len(v["history"][-1]["attachments"]) == 1)
check("T the seller cannot mark it returned (no such route)", seller_do(RC_ID, "returned"), 404)
check("T a seller's admin-route call -> 403", call("POST", f"{RA}/{RC_ID}/status", S1, {"status": "returned", "note": "I did it"}), 403)
check("T a customer's admin-route call -> 403", call("POST", f"{RA}/{RC_ID}/status", USER, {"status": "returned", "note": "I did it"}), 403)
bal_before = bal(SID1)
c, done = admin_status(RC_ID, "returned", "Money confirmed by the bank")
check("T an admin confirms it as returned", (c, done), 201, pred=lambda v: v["status"] == "returned" and v["returnedAt"] and v["commissionAmount"] == 650 and v["items"][0]["isReturned"] is True)
b2 = bal(SID1)
truth("T the line's commission (650) came off total and due", abs((bal_before[0] - b2[0]) - 650) < 0.005 and abs((bal_before[1] - b2[1]) - 650) < 0.005 and b2[2] == bal_before[2], (bal_before, b2))
truth("T only that item is flagged returned", flags(OF["id"]) == ("f", "f,f,t"), flags(OF["id"]))
truth("T the ledger got an item row with the item id", sql(f"select count(*) from system_commission_history where \"orderReturnId\"={RC_ID} and \"orderItemId\"={ic} and \"orderId\"={OF['id']} and type='order_return' and status='order_returned_to_customer' and \"totalAmount\"=650 and \"deletedAt\" is null") == "1")
truth("T the change log has the take-back with before and after", sql(f"select count(*) from system_commission_change_history c join system_commission_history h on h.id=c.\"historyId\" where h.\"orderReturnId\"={RC_ID} and c.\"commissionStatus\"='order_returned_to_customer' and c.\"newTotalCommission\" = c.\"currentTotalCommission\" - 650 and c.\"newDueCommission\" = c.\"currentDueCommission\" - 650") == "1")
check("T a returned item cannot be requested again (customer)", req(OF["id"], "items", [ic]), 409)
check("T nor by an admin", adm_req(OF["id"], "items", [ic]), 409)
check("T the order view says which item is returned", call("GET", f"/user/orders/{OF['id']}", USER), 200, pred=lambda v: [i["isReturned"] for i in v["items"]] == [False, False, True] and v["isReturned"] is False  and len(v["returns"]) == 5)

# ============================================================ M  money: full-order returns and the delivery charge
OM = make_order(((119, 1), (120, 1)))
bM = bal(SID1)
c, rf = req(OM["id"], "full_order")
check("M a full-order request refunds the lines and the delivery charge", (c, rf), 201, pred=lambda v: v["scope"] == "full_order" and v["refundAmount"] == 7100 and v["itemsAmount"] == 7000 and v["deliveryAmount"] == 100 and v["includeDeliveryCharge"] is True and len(v["items"]) == 2)
RF = rf["id"]
check("M accepting with delivery refunded off", seller_do(RF, "accept", {"includeDeliveryCharge": False}), 201, pred=lambda v: v["refundAmount"] == 7000 and v["deliveryAmount"] == 0 and v["includeDeliveryCharge"] is False)
check("M a wrongly typed delivery choice -> 400", seller_do(RF, "processing", {"includeDeliveryCharge": "no"}), 400)
check("M the delivery choice cannot be set when only moving to processing -> 400", seller_do(RF, "processing", {"includeDeliveryCharge": True}), 400)
assert seller_do(RF, "processing")[0] == 201
assert multi("POST", f"{RS}/{RF}/returning-money", S1, {"note": "Refunded by cash"}, PROOF)[0] == 201
check("M an admin can change the delivery choice with the status", admin_status(RF, "returning_money", "Delivery goes back too", {"includeDeliveryCharge": "true"}), 201, pred=lambda v: v["status"] == "returning_money" and v["refundAmount"] == 7100 and v["deliveryAmount"] == 100)
check("M the delivery choice cannot be set on an item return -> 400", admin_status(RC_ID, "processing", "Item return, no delivery", {"includeDeliveryCharge": "true"}), 400)
check("M changing nothing at all -> 400", admin_status(RF, "returning_money", "Same again", {"includeDeliveryCharge": "true"}), 400)
c, mr = admin_status(RF, "returned", "Money confirmed")
check("M an admin confirms the full return", (c, mr), 201, pred=lambda v: v["status"] == "returned" and v["commissionAmount"] == 700 and v["refundAmount"] == 7100)
bM2 = bal(SID1)
truth("M the whole order's commission (700) came off the balance", abs((bM[0] - bM2[0]) - 700) < 0.005 and abs((bM[1] - bM2[1]) - 700) < 0.005, (bM, bM2))
truth("M exactly 700 was taken for this order", abs(float(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"orderId\"={OM['id']} and type='order_return' and \"deletedAt\" is null")) - 700) < 0.005)
truth("M a full return writes one ledger row, with the order id and no item id", sql(f"select count(*)||'|'||count(\"orderItemId\") from system_commission_history where \"orderReturnId\"={RF} and type='order_return'") == "1|0")
truth("M the order and both items are flagged returned", flags(OM["id"]) == ("t", "t,t"), flags(OM["id"]))
check("M a second full request -> 409 (customer)", req(OM["id"], "full_order"), 409)
check("M a second full request -> 409 (admin)", adm_req(OM["id"], "full_order"), 409)
check("M an item request on a returned order -> 409", adm_req(OM["id"], "items", items_of(OM["id"])[:1]), 409)
check("M the order view says it is returned", call("GET", f"/user/orders/{OM['id']}", USER), 200, pred=lambda v: v["isReturned"] is True and all(i["isReturned"] for i in v["items"]) and v["returns"][0]["status"] == "returned")
check("M the staff order view says it is returned", call("GET", f"{A}/{OM['id']}", ADMIN), 200, pred=lambda v: v["isReturned"] is True and all(i["isReturned"] for i in v["items"]))

OM2 = make_order(((119, 1),))
c, rf2 = req(OM2["id"], "full_order")
assert c == 201
check("M accepted as it is, the delivery stays in the refund", seller_do(rf2["id"], "accept"), 201, pred=lambda v: v["refundAmount"] == 3300 and v["deliveryAmount"] == 100)
c, rf3 = adm_req(make_order(((119, 1),))["id"], "full_order", extra={"includeDeliveryCharge": "false"})
check("M an admin opens a full return without the delivery charge", (c, rf3), 201, pred=lambda v: v["refundAmount"] == 3200 and v["deliveryAmount"] == 0 and v["includeDeliveryCharge"] is False)
check("M the delivery choice on an item return -> 400", adm_req((o_x := make_order(((119, 1),)))["id"], "items", items_of(o_x["id"]), extra={"includeDeliveryCharge": "true"}), 400)

# ============================================================ P  item by item until the order is returned
OP = make_order(((119, 1), (120, 1), (121, 1)))
pa, pb, pc = items_of(OP["id"])
bP = bal(SID1)
c, r1 = req(OP["id"], "items", [pa])
full_cycle(r1["id"])
truth("P first item back: order not flagged, one item is", flags(OP["id"]) == ("f", "t,f,f"), flags(OP["id"]))
truth("P its commission (320) came off", abs((bP[0] - bal(SID1)[0]) - 320) < 0.005)
c, r2 = req(OP["id"], "items", [pb, pc])
check("P two items in one request refund both lines, no delivery", (c, r2), 201, pred=lambda v: v["refundAmount"] == 10300 and v["deliveryAmount"] == 0 and len(v["items"]) == 2)
full_cycle(r2["id"])
truth("P all items returned: the order is flagged too", flags(OP["id"]) == ("t", "t,t,t"), flags(OP["id"]))
truth("P commission taken per item, three ledger rows with item ids", sql(f"select count(*) from system_commission_history where \"orderId\"={OP['id']} and type='order_return' and \"orderItemId\" is not null and \"deletedAt\" is null") == "3")
truth("P the whole order's commission (1350) came off, nothing more", abs((bP[0] - bal(SID1)[0]) - 1350) < 0.005)
check("P nothing is left to return", call("GET", f"{RU}/eligibility/{OP['id']}", USER), 200, pred=lambda v: not v["fullOrder"]["allowed"] and all(not i["allowed"] for i in v["items"]))

OP2 = make_order(((119, 1), (120, 1), (121, 1)))
qa, qb, qc = items_of(OP2["id"])
c, q1 = req(OP2["id"], "items", [qa])
full_cycle(q1["id"])
c, qf = adm_req(OP2["id"], "full_order")
check("P an admin opens a full return after a partial one: only what is left, with delivery", (c, qf), 201, pred=lambda v: v["refundAmount"] == 10400 and v["itemsAmount"] == 10300 and v["deliveryAmount"] == 100 and len(v["items"]) == 2 and v["commissionAmount"] == 1030)
bQ = bal(SID1)
full_cycle(qf["id"])
truth("P the rest of the commission (1030) came off as one order row", abs((bQ[0] - bal(SID1)[0]) - 1030) < 0.005 and sql(f"select count(*) from system_commission_history where \"orderReturnId\"={qf['id']} and \"orderItemId\" is null and \"totalAmount\"=1030") == "1")
truth("P the order is flagged returned", flags(OP2["id"]) == ("t", "t,t,t"))

OP3 = make_order(((119, 1), (120, 1)))
p3a = items_of(OP3["id"])[0]
c, q3 = req(OP3["id"], "items", [p3a])
assert seller_do(q3["id"], "reject", {"note": "Looks fine to me"})[0] == 201
check("P a customer who was rejected cannot ask for the full order either", req(OP3["id"], "full_order"), 409)
check("P an admin can open the full order after a rejection", adm_req(OP3["id"], "full_order"), 201)

# ============================================================ A  admin: any status, always with a note
OA = make_order(((119, 1),))
(aa,) = items_of(OA["id"])
c, ar = req(OA["id"], "items", [aa])
AR = ar["id"]
check("A no token -> 401", multi("POST", f"{RA}/{AR}/status", None, {"status": "accepted", "note": "Fine by me"}), 401)
check("A a note is required -> 400", multi("POST", f"{RA}/{AR}/status", ADMIN, {"status": "accepted"}), 400)
check("A a short note -> 400", multi("POST", f"{RA}/{AR}/status", ADMIN, {"status": "accepted", "note": "x"}), 400)
check("A an unknown status -> 400", admin_status(AR, "refunded"), 400)
check("A the same status -> 400", admin_status(AR, "return_requested"), 400)
check("A an unknown return -> 404", admin_status(99999999, "accepted"), 404)
check("A unknown field -> 400", multi("POST", f"{RA}/{AR}/status", ADMIN, {"status": "accepted", "note": "Fine by me", "refundAmount": "1"}), 400)
bA = bal(SID1)
check("A an admin can jump straight to returned", admin_status(AR, "returned", "Verified offline, money sent"), 201, pred=lambda v: v["status"] == "returned" and v["history"][-1]["by"]["type"] == "admin" and v["history"][-1]["fromStatus"] == "return_requested")
truth("A commission (320) came off", abs((bA[0] - bal(SID1)[0]) - 320) < 0.005)
truth("A the item is flagged returned", flags(OA["id"]) == ("t", "t"))
check("A the same status again -> 400 and nothing moves twice", admin_status(AR, "returned", "Doing it twice"), 400)
truth("A the commission was taken only once", abs((bA[0] - bal(SID1)[0]) - 320) < 0.005)
check("A moving it back out of returned restores everything", admin_status(AR, "processing", "Sent too early, undoing"), 201, pred=lambda v: v["status"] == "processing" and v["returnedAt"] is None)
truth("A commission is earned again (balance back)", abs(bal(SID1)[0] - bA[0]) < 0.005 and abs(bal(SID1)[1] - bA[1]) < 0.005)
truth("A the item and the order are no longer returned", flags(OA["id"]) == ("f", "f"))
truth("A the return ledger row is voided with the reason, not deleted", sql(f"select count(*) from system_commission_history where \"orderReturnId\"={AR} and type='order_return' and \"deletedAt\" is not null and \"voidReason\" is not null") == "1" and sql(f"select count(*) from system_commission_history where \"orderReturnId\"={AR} and \"deletedAt\" is null") == "0")
truth("A the change log recorded the undo", changes(SID1, "return_undone") >= 1)
check("A returned again", admin_status(AR, "returned", "Confirmed after all"), 201)
truth("A a new live ledger row exists", sql(f"select count(*) from system_commission_history where \"orderReturnId\"={AR} and \"deletedAt\" is null") == "1" and abs((bA[0] - bal(SID1)[0]) - 320) < 0.005)
check("A a returned return cannot change its refund", admin_status(AR, "returned", "Changing it", {"includeDeliveryCharge": "true"}), 400)
check("A rejected from returned", admin_status(AR, "rejected", "Mistake, no refund"), 201, pred=lambda v: v["status"] == "rejected")
truth("A restored again", abs(bal(SID1)[0] - bA[0]) < 0.005 and flags(OA["id"]) == ("f", "f"))
check("A reopened from rejected while the goods are free", admin_status(AR, "return_requested", "Reopened"), 201)
check("A cancelled by an admin", admin_status(AR, "cancelled", "Customer called to withdraw"), 201)
c, ar2 = adm_req(OA["id"], "items", [aa])
check("A an admin opens a new one", (c, ar2), 201)
check("A reopening the old one while the new one is open -> 409", admin_status(AR, "accepted", "Back on"), 409)
check("A the old one stays cancelled", (200, rstate(AR)), 200, pred=lambda v: v == "cancelled")
check("A an admin can move through any order of statuses", admin_status(ar2["id"], "returning_money", "Skipping ahead"), 201)
check("A a file can go with an admin step", admin_status(ar2["id"], "accepted", "Back one step, with a slip", files=PROOF), 201, pred=lambda v: len(v["history"][-1]["attachments"]) == 1)
check("A the history keeps every step", call("GET", f"{RA}/{ar2['id']}", ADMIN), 200, pred=lambda v: [h["status"] for h in v["history"]] == ["return_requested", "returning_money", "accepted"])
check("A a seller step after an admin jump follows the real status", seller_do(ar2["id"], "processing"), 201)

# ============================================================ G  guards on the order
OG = make_order(((119, 1),))
(ga,) = items_of(OG["id"])
c, gr = req(OG["id"], "items", [ga])
check("G cancelling an order with an open return -> 409", call("PATCH", f"{A}/{OG['id']}/status", ADMIN, {"status": "cancelled"}), 409)
pid = int(sql(f"select id from payment where \"orderId\"={OG['id']} and status<>'due' and \"reversedAt\" is null order by id desc limit 1"))
check("G reversing the payment with an open return -> 409", call("POST", f"{A}/{OG['id']}/payments/{pid}/reverse", ADMIN, {"reason": "Wrong entry"}), 409)
truth("G the order and its commission are untouched", sql(f"select status||'|'||\"paymentStatus\" from \"order\" where id={OG['id']}") == "delivered|paid")
assert seller_do(gr["id"], "reject", {"note": "Looks fine to me"})[0] == 201
check("G after the return is rejected the order can be cancelled", call("PATCH", f"{A}/{OG['id']}/status", ADMIN, {"status": "cancelled"}), 200)
check("G a cancelled order cannot be returned", adm_req(OG["id"], "items", [ga]), 409)
OG2 = make_order(((119, 1),))
(ga2,) = items_of(OG2["id"])
c, gr2 = req(OG2["id"], "items", [ga2])
full_cycle(gr2["id"])
check("G cancelling an order with a finished return -> 409", call("PATCH", f"{A}/{OG2['id']}/status", ADMIN, {"status": "cancelled"}), 409)
pid2 = int(sql(f"select id from payment where \"orderId\"={OG2['id']} and status<>'due' and \"reversedAt\" is null order by id desc limit 1"))
check("G reversing the payment after a finished return -> 409", call("POST", f"{A}/{OG2['id']}/payments/{pid2}/reverse", ADMIN, {"reason": "Wrong entry"}), 409)
check("G after the return is moved back out of returned, cancelling works again", admin_status(gr2["id"], "cancelled", "Withdrawn"), 201)
check("G cancelling the order now", call("PATCH", f"{A}/{OG2['id']}/status", ADMIN, {"status": "cancelled"}), 200)

# ============================================================ K  two at once
OK = make_order(((119, 1), (120, 1)))
(ka, kb) = items_of(OK["id"])
with cf.ThreadPoolExecutor(6) as ex:
    res = list(ex.map(lambda _: req(OK["id"], "items", [ka]), range(6)))
truth("K six identical requests at once: exactly one is made", sorted(r[0] for r in res).count(201) == 1 and all(r[0] in (201, 409) for r in res), [r[0] for r in res])
truth("K one return row for the item", sql(f"select count(*) from order_return_item where \"orderItemId\"={ka}") == "1")
with cf.ThreadPoolExecutor(6) as ex:
    res = list(ex.map(lambda _: adm_req(OK["id"], "items", [kb]), range(6)))
truth("K six admin requests at once: exactly one is made", sorted(r[0] for r in res).count(201) == 1, [r[0] for r in res])
kid = int(sql(f"select \"orderReturnId\" from order_return_item where \"orderItemId\"={kb}"))
bK = bal(SID1)
with cf.ThreadPoolExecutor(6) as ex:
    res = list(ex.map(lambda _: admin_status(kid, "returned", "Confirmed twice"), range(6)))
truth("K six confirmations at once: exactly one wins", sorted(r[0] for r in res).count(201) == 1, [r[0] for r in res])
truth("K the commission (380) came off once", abs((bK[0] - bal(SID1)[0]) - 380) < 0.005, (bK, bal(SID1)))
truth("K one live ledger row", sql(f"select count(*) from system_commission_history where \"orderReturnId\"={kid} and \"deletedAt\" is null") == "1")
rk = int(sql(f"select \"orderReturnId\" from order_return_item where \"orderItemId\"={ka}"))
with cf.ThreadPoolExecutor(4) as ex:
    res = list(ex.map(lambda i: [call("POST", f"{RU}/{rk}/cancel", USER, {}), seller_do(rk, "accept")][i % 2], range(6)))
truth("K cancel and accept racing: the return ends in one consistent status", rstate(rk) in ("cancelled", "accepted") and sql(f"select count(*) from order_return_status_history where \"orderReturnId\"={rk} and status in ('cancelled','accepted')") == "1", (rstate(rk), [r[0] for r in res]))

# ============================================================ X  return window and guests
call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.windowDays": 1}})
OX = make_order(((119, 1),))
(xa,) = items_of(OX["id"])
check("X inside the window it is allowed", call("GET", f"{RU}/eligibility/{OX['id']}", USER), 200, pred=lambda v: v["items"][0]["allowed"] and v["returnWindowDays"] == 1)
sql(f"update order_status_history set \"createdAt\" = now() - interval '3 days' where \"orderId\"={OX['id']} and status='delivered'")
check("X after the window the customer is refused", call("GET", f"{RU}/eligibility/{OX['id']}", USER), 200, pred=lambda v: not v["fullOrder"]["allowed"] and "window" in v["fullOrder"]["reason"] and not v["items"][0]["allowed"])
check("X creating after the window -> 409", req(OX["id"], "items", [xa]), 409)
check("X an admin is not held to the window", call("GET", f"{RA}/eligibility/{OX['id']}", ADMIN), 200, pred=lambda v: v["items"][0]["allowed"] and v["fullOrder"]["allowed"])
check("X an admin can open one after the window", adm_req(OX["id"], "items", [xa]), 201)
call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.windowDays": 0}})
OX2 = make_order(((119, 1),))
sql(f"update order_status_history set \"createdAt\" = now() - interval '300 days' where \"orderId\"={OX2['id']} and status='delivered'")
check("X a window of 0 means no limit", call("GET", f"{RU}/eligibility/{OX2['id']}", USER), 200, pred=lambda v: v["items"][0]["allowed"] and v["windowEndsAt"] is None)
call("PATCH", "/admin/settings", ADMIN, {"settings": {"returns.windowDays": 7}})
OGU = make_order(((119, 1),), who="guest")
check("X a guest order cannot be returned by a customer -> 404", req(OGU["id"], "full_order"), 404)
c, gu = adm_req(OGU["id"], "full_order")
check("X an admin opens a return for a guest order", (c, gu), 201, pred=lambda v: v["customer"]["isGuest"] is True and v["customer"]["userId"] is None)
check("X the guest return runs the normal steps", seller_do(gu["id"], "accept"), 201)

# ============================================================ W  lists, detail and who sees what
check("W the customer's list shows only theirs", call("GET", RU, USER), 200, pred=lambda v: v["total"] >= 10 and all(r["order"]["orderNumber"] for r in v["results"]))
check("W another customer sees none", call("GET", RU, OTHER), 200, pred=lambda v: v["total"] == 0 and v["results"] == [])
check("W list needs a token", call("GET", RU), 401)
check("W a seller cannot use the customer list -> 403", call("GET", RU, S1), 403)
check("W filter by status", call("GET", f"{RU}?status=returned", USER), 200, pred=lambda v: v["total"] >= 3 and all(r["status"] == "returned" for r in v["results"]))
check("W filter by scope", call("GET", f"{RU}?scope=full_order", USER), 200, pred=lambda v: v["total"] >= 3 and all(r["scope"] == "full_order" for r in v["results"]))
check("W bad status -> 400", call("GET", f"{RU}?status=lost", USER), 400)
check("W bad scope -> 400", call("GET", f"{RU}?scope=half", USER), 400)
check("W unknown query -> 400", call("GET", f"{RU}?x=1", USER), 400)
check("W search by return number", call("GET", f"{RU}?search={ra['returnNumber']}", USER), 200, pred=lambda v: v["total"] == 1 and v["results"][0]["id"] == ra["id"])
check("W search by order number", call("GET", f"{RU}?search={OF['orderNumber']}", USER), 200, pred=lambda v: v["total"] == 5)
check("W pages", call("GET", f"{RU}?pageSize=2&page=2", USER), 200, pred=lambda v: len(v["results"]) == 2 and v["page"] == 2 and v["totalPages"] >= 5)
check("W newest first", call("GET", RU, USER), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted((r["id"] for r in v["results"]), reverse=True))
check("W a customer's list hides commission", call("GET", RU, USER), 200, pred=lambda v: all("commissionAmount" not in r for r in v["results"]))
check("W a customer opens their own return", call("GET", f"{RU}/{RC_ID}", USER), 200, pred=lambda v: v["id"] == RC_ID and v["items"][0]["productName"] and len(v["history"]) == 5 and v["actions"]["canCancel"] is False)
check("W the customer sees the proof on the history", call("GET", f"{RU}/{RC_ID}", USER), 200, pred=lambda v: any(h["attachments"] for h in v["history"]))
check("W an admin-opened request can be cancelled by the customer (flag)", call("GET", f"{RU}/{rb2['id']}", USER), 200, pred=lambda v: v["status"] == "return_requested" and v["actions"]["canCancel"] is True and v["requestedBy"]["type"] == "admin")
check("W another customer's return -> 404", call("GET", f"{RU}/{RC_ID}", OTHER), 404)
check("W unknown return -> 404", call("GET", f"{RU}/99999999", USER), 404)
check("W bad id -> 400", call("GET", f"{RU}/abc", USER), 400)
check("W the seller's list shows only their returns", call("GET", RS, S1), 200, pred=lambda v: v["total"] >= 10 and all(r["seller"]["id"] == SID1 for r in v["results"]))
check("W the other seller sees none", call("GET", RS, S2), 200, pred=lambda v: v["total"] == 0)
check("W the seller sees commission and the customer name", call("GET", f"{RS}/{RC_ID}", S1), 200, pred=lambda v: v["commissionAmount"] == 650 and v["items"][0]["commissionAmount"] == 650 and v["customer"]["name"] and v["actions"]["sellerNext"] == [])
check("W the seller's next steps follow the status", call("GET", f"{RS}/{ra2['id']}", S1), 200, pred=lambda v: v["actions"]["sellerNext"] == ["accept", "reject"])
check("W another seller's detail -> 404", call("GET", f"{RS}/{RC_ID}", S2), 404)
check("W a customer on the seller list -> 403", call("GET", RS, USER), 403)
check("W seller list filter by status", call("GET", f"{RS}?status=return_requested", S1), 200, pred=lambda v: v["total"] >= 1 and all(r["status"] == "return_requested" for r in v["results"]))
check("W the admin list shows everything", call("GET", RA, ADMIN), 200, pred=lambda v: v["total"] >= 20)
check("W admin filter by seller", call("GET", f"{RA}?sellerId={SID2}", ADMIN), 200, pred=lambda v: v["total"] == 0)
check("W admin filter by customer", call("GET", f"{RA}?userId={OID_}", ADMIN), 200, pred=lambda v: v["total"] == 0)
check("W admin filter by order", call("GET", f"{RA}?orderId={OF['id']}", ADMIN), 200, pred=lambda v: v["total"] == 5)
check("W admin sees the allowed targets", call("GET", f"{RA}/{RC_ID}", ADMIN), 200, pred=lambda v: "processing" in v["actions"]["adminTargets"] and "returned" not in v["actions"]["adminTargets"] and v["commissionAmount"] == 650)
check("W the seller cannot use the admin list -> 403", call("GET", RA, S1), 403)
check("W the customer cannot use the admin list -> 403", call("GET", RA, USER), 403)
check("W admin eligibility needs a token", call("GET", f"{RA}/eligibility/{OF['id']}"), 401)
check("W the order view lists its returns, newest first", call("GET", f"{SL}/{OF['id']}", S1), 200, pred=lambda v: len(v["returns"]) == 5 and v["returns"][0]["id"] > v["returns"][-1]["id"] and all("orderItemIds" in r for r in v["returns"]))
check("W the admin order view has them too", call("GET", f"{A}/{OF['id']}", ADMIN), 200, pred=lambda v: len(v["returns"]) == 5)

# ============================================================ I  invariants
sellers = f"{SID1},{SID2}"
for sid in (SID1, SID2):
    t, d_, p_ = bal(sid)
    truth(f"I seller {sid}: total = due + paid", abs(t - d_ - p_) < 0.005, (t, d_, p_))
    earned = float(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"sellerId\"={sid} and type='order_commission' and \"deletedAt\" is null"))
    back = float(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"sellerId\"={sid} and type='order_return' and \"deletedAt\" is null"))
    truth(f"I seller {sid}: total = live earned - live taken back ({earned} - {back})", abs(t - (earned - back)) < 0.005, (t, earned, back))
truth("I change log chains: every row starts where the last one ended", sql(f"select count(*) from (select \"currentTotalCommission\" c, lag(\"newTotalCommission\") over (partition by \"sellerId\" order by id) p, \"currentDueCommission\" cd, lag(\"newDueCommission\") over (partition by \"sellerId\" order by id) pd, \"currentPaidCommission\" cp, lag(\"newPaidCommission\") over (partition by \"sellerId\" order by id) pp from system_commission_change_history where \"sellerId\" in ({sellers})) x where p is not null and (abs(c-p) > 0.005 or abs(cd-pd) > 0.005 or abs(cp-pp) > 0.005)") == "0")
truth("I the last change row matches the live balance", sql(f"select count(*) from system_commission sc where sc.\"sellerId\" in ({sellers}) and exists (select 1 from system_commission_change_history c where c.\"sellerId\"=sc.\"sellerId\") and not exists (select 1 from system_commission_change_history c where c.\"sellerId\"=sc.\"sellerId\" and c.id = (select max(id) from system_commission_change_history where \"sellerId\"=sc.\"sellerId\") and abs(c.\"newTotalCommission\" - sc.\"totalCommission\") < 0.005 and abs(c.\"newDueCommission\" - sc.\"dueCommission\") < 0.005)") == "0")
truth("I every change moves total by what due moved (nothing paid here)", sql(f"select count(*) from system_commission_change_history where \"sellerId\" in ({sellers}) and abs((\"newTotalCommission\" - \"currentTotalCommission\") - (\"newDueCommission\" - \"currentDueCommission\")) > 0.005") == "0")
truth("I an order's commission is the sum of its lines", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and abs(o.\"systemCommission\" - (select coalesce(sum(i.\"systemCommission\"),0) from order_item i where i.\"orderId\"=o.id)) > 0.005") == "0")
truth("I a line's seller amount + commission = what it was payable at", sql(f"select count(*) from order_item i join \"order\" o on o.id=i.\"orderId\" where o.\"sellerId\" in ({sellers}) and abs(i.\"sellerAmount\" + i.\"systemCommission\" - coalesce(i.\"totalProposalPrice\", i.\"totalDiscountedPrice\", i.\"totalPrice\")) > 0.005") == "0")
truth("I an order is flagged returned exactly when all its lines are", sql(f"select count(*) from \"order\" o where o.\"sellerId\" in ({sellers}) and o.\"isReturned\" <> (not exists (select 1 from order_item i where i.\"orderId\"=o.id and not i.\"isReturned\"))") == "0")
truth("I a line is flagged returned exactly when a returned return covers it", sql(f"select count(*) from order_item i join \"order\" o on o.id=i.\"orderId\" where o.\"sellerId\" in ({sellers}) and i.\"isReturned\" <> exists (select 1 from order_return_item ri join order_return r on r.id=ri.\"orderReturnId\" where ri.\"orderItemId\"=i.id and r.status='returned')") == "0")
truth("I no line is in two open or returned returns", sql(f"select count(*) from (select ri.\"orderItemId\" from order_return_item ri join order_return r on r.id=ri.\"orderReturnId\" where r.\"sellerId\" in ({sellers}) and r.status in ('return_requested','accepted','processing','returning_money','returned') group by 1 having count(*) > 1) x") == "0")
truth("I refund = items + delivery everywhere", sql(f"select count(*) from order_return where \"sellerId\" in ({sellers}) and abs(\"refundAmount\" - \"itemsAmount\" - \"deliveryAmount\") > 0.005") == "0")
truth("I the items amount is the sum of the return's lines", sql(f"select count(*) from order_return r where r.\"sellerId\" in ({sellers}) and abs(r.\"itemsAmount\" - (select coalesce(sum(\"refundAmount\"),0) from order_return_item where \"orderReturnId\"=r.id)) > 0.005") == "0")
truth("I the delivery amount is zero unless it was chosen", sql(f"select count(*) from order_return where \"sellerId\" in ({sellers}) and ((not \"includeDeliveryCharge\" and \"deliveryAmount\" <> 0) or (scope='items' and \"deliveryAmount\" <> 0))") == "0")
truth("I item returns never include delivery", sql(f"select count(*) from order_return where \"sellerId\" in ({sellers}) and scope='items' and \"includeDeliveryCharge\" ") == "0")
truth("I the last history row is the return's status", sql(f"select count(*) from order_return r where r.\"sellerId\" in ({sellers}) and (select status from order_return_status_history h where h.\"orderReturnId\"=r.id order by h.id desc limit 1) <> r.status") == "0")
truth("I every history row after the first knows where it came from", sql(f"select count(*) from order_return_status_history h join order_return r on r.id=h.\"orderReturnId\" where r.\"sellerId\" in ({sellers}) and ((h.\"fromStatus\" is null) <> (h.id = (select min(id) from order_return_status_history where \"orderReturnId\"=r.id)))") == "0")
truth("I returnedAt is set exactly for returned returns", sql(f"select count(*) from order_return where \"sellerId\" in ({sellers}) and ((status='returned') <> (\"returnedAt\" is not null))") == "0")
truth("I a returned return's commission equals its live ledger rows", sql(f"select count(*) from order_return r where r.\"sellerId\" in ({sellers}) and r.status='returned' and abs(r.\"commissionAmount\" - (select coalesce(sum(\"totalAmount\"),0) from system_commission_history h where h.\"orderReturnId\"=r.id and h.\"deletedAt\" is null)) > 0.005") == "0")
truth("I only returned returns hold live ledger rows", sql(f"select count(*) from system_commission_history h join order_return r on r.id=h.\"orderReturnId\" where h.\"sellerId\" in ({sellers}) and h.\"deletedAt\" is null and r.status <> 'returned'") == "0")
truth("I every return ledger row says order_returned_to_customer", sql(f"select count(*) from system_commission_history where \"sellerId\" in ({sellers}) and type='order_return' and status <> 'order_returned_to_customer'") == "0")
truth("I every earned row says for_system", sql(f"select count(*) from system_commission_history where \"sellerId\" in ({sellers}) and type='order_commission' and status <> 'for_system'") == "0")
truth("I the customer on a return is the customer on the order", sql(f"select count(*) from order_return r join \"order\" o on o.id=r.\"orderId\" where r.\"sellerId\" in ({sellers}) and (r.\"userId\" is distinct from o.\"userId\" or r.\"sellerId\" <> o.\"sellerId\")") == "0")

# ============================================================ summary
if not os.environ.get("KEEP"):  # KEEP=1 leaves the data in place for looking at the screens
    cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, dd)
sys.exit(1 if failed else 0)
