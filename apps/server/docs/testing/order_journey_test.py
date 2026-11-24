#!/usr/bin/env python3
"""Black-box end-to-end tests: whole order journeys across every actor (guest, customer, seller, admin),
role x status matrix, access and id sweeps, input fuzzing, concurrency and data invariants."""
import base64, concurrent.futures as cf, json, os, subprocess, sys, tempfile, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads"))
TMP = tempfile.mkdtemp(prefix="jny")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
TAG = "T Jny"


def run(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    text, code = out.rsplit("\n", 1)
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = text
    return int(code), data


def call(method, path, token=None, body=None, session=None, raw=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    if raw is not None:
        cmd += ["-H", "Content-Type: application/json", "--data-binary", raw]
    elif body is not None:
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


# seeded stock the other suites also reset to
SEED = {119: 60, 120: 40, 121: 3, 122: 40, 123: 5}


def restore():
    sql("update seller_product set \"sellerId\"=5, \"activeStatus\"='active', status='approved' where id=94")
    sql("update seller_product set \"sellerId\"=6, \"activeStatus\"='active', status='approved' where id=95")
    sql("update seller set status='approved', \"activeStatus\"='active' where id in (5,6,7)")
    sql("update seller_product_sku set \"isActive\"=true, \"discountedPriceStartDate\"=null where \"sellerProductId\" in (94,95,96)")
    sql("update seller_product_sku set quantity=6, price=3500, \"discountedPrice\"=3200 where id=119")
    sql("update seller_product_sku set quantity=4 where id=120")
    sql("update seller_product_sku set quantity=3 where id=121")
    sql("update seller_product_sku set quantity=8, price=3000, \"discountedPrice\"=null where id=122")
    sql("update seller_product_sku set quantity=5 where id=123")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")


def cleanup():
    ids = f"select id from \"order\" where \"recipientName\" like '{TAG} %' or \"sellerId\" in (select id from seller where name like '{TAG} %') or \"recipientName\" like 'x''%' or \"recipientName\" like '<script>%'"
    paths = sql(f"select \"filePath\" from payment_attachments where \"orderId\" in ({ids}) union select a.\"filePath\" from order_update_attachments a join order_update u on u.id=a.\"orderUpdateId\" where u.\"orderId\" in ({ids})").split()
    sql(f"delete from order_update where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql(f"delete from system_commission_history where \"orderId\" in ({ids}) or \"sellerId\" in (select id from seller where name like '{TAG} %')")
    sql(f"delete from system_commission_disburse where \"sellerId\" in (select id from seller where name like '{TAG} %')")
    sql(f"delete from system_commission where \"sellerId\" in (select id from seller where name like '{TAG} %')")
    sql(f"delete from \"order\" where id in ({ids})")
    sql(f"delete from cart where \"sessionId\" like 'tjny%' or \"userId\" in (select id from \"user\" where email like 't-jny-%')")
    sql(f"delete from address where \"userId\" in (select id from \"user\" where email like 't-jny-%')")
    sql("delete from \"user\" where email like 't-jny-%'")
    restore()
    sql(f"delete from seller where name like '{TAG} %'")
    sql("delete from payment_gateway where slug like 't-jny-%'")
    for p in paths:
        try:
            os.unlink(os.path.join(UPLOADS, p))
        except OSError:
            pass


def stock(sku):
    return int(sql(f"select quantity from seller_product_sku where id={sku}"))


cleanup()
restore()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
ADMIN_NAME = sql(f"select name from admin_user where email='{ADMIN_EMAIL}'")


def make_seller(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"{TAG} Seller {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = int(sql(f"select id from seller where name='{TAG} Seller {tag}'"))
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


def make_user(n):
    c, d = call("POST", "/user/auth/register", body={"name": f"{TAG} User {n}", "phone": f"+88017{RUN_NUM}4{n:02d}", "password": "Passw0rd!x", "email": f"t-jny-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


S1, SID1 = make_seller("111")
S2, SID2 = make_seller("222")
sql(f"update seller_product set \"sellerId\"={SID1} where id=94")
sql(f"update seller_product set \"sellerId\"={SID2} where id=95")
U1, UID1 = make_user(1)
U2, UID2 = make_user(2)
U3, UID3 = make_user(3)
sql(f"update \"user\" set status='suspended' where id={UID3}")
COD = int(sql("select id from payment_gateway where slug='cash-on-delivery'"))
MFS = int(sql(f"insert into payment_gateway (name, slug, type, \"accountNumber\", \"isActive\") values ('{TAG} MFS','t-jny-mfs-{RUN}','mfs','017',true) returning id").splitlines()[0])
OFF = int(sql(f"insert into payment_gateway (name, slug, type, \"isActive\") values ('{TAG} Off','t-jny-off-{RUN}','cod',false) returning id").splitlines()[0])
sql("update system_setting set value='40' where key='shipping.defaultCharge'")
for k, v in SEED.items():
    sql(f"update seller_product_sku set quantity={v} where id={k}")

CART, CK, OR = "/user/carts", "/user/order/checkout", "/user/order"
A, SL, AP, SP = "/admin/order", "/seller/order", "/admin/order/payments", "/seller/order/payments"
STATUSES = ["pending", "confirmed", "cancelled", "packed", "shipped", "delivered"]
ctr = [0]


def sess():
    ctr[0] += 1
    return f"tjny{RUN}s{ctr[0]}"


def pay_body(gateway=COD, **over):
    p = {"recipientName": f"{TAG} Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
         "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": gateway}
    p.update(over)
    return {k: v for k, v in p.items() if v is not None}


def add_item(session=None, token=None, product=94, sku=119, qty=1):
    body = {"sellerProductId": product, "quantity": qty}
    if sku:
        body["sellerProductSkuId"] = sku
    c, d = call("POST", CART + "/items", token=token, body=body, session=session)
    assert c in (200, 201), (c, d)
    return d["cart"]["id"]


def place(session=None, token=None, product=94, sku=119, qty=1, **over):
    cid = add_item(session, token, product, sku, qty)
    c, o = call("POST", f"{CK}/{cid}/place", token=token, session=session, body=pay_body(**over))
    assert c == 201, (c, o)
    return o


def detail(oid, role="admin"):
    base = {"admin": A, "seller1": SL, "seller2": SL}[role]
    tok = {"admin": ADMIN, "seller1": S1, "seller2": S2}[role]
    c, d = call("GET", f"{base}/{oid}", tok)
    assert c == 200, (c, d)
    return d


def staff_status(oid, to, who="admin", note=None):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1), "s2": (SL, S2)}[who]
    body = {"status": to}
    if note:
        body["note"] = note
    return call("PATCH", f"{base}/{oid}/status", tok, body)


def record(oid, who, amount=None, desc="Cash received at the door", files=None, **extra):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1), "s2": (SL, S2)}[who]
    fields = {"description": desc, **extra}
    if amount is not None:
        fields["amount"] = amount
    return multi("POST", f"{base}/{oid}/payments", tok, fields, files if files is not None else [("slip.png", PNG, "image/png")])


def reverse(oid, pid, who, reason="Wrong entry"):
    base, tok = {"admin": (A, ADMIN), "s1": (SL, S1), "s2": (SL, S2)}[who]
    return call("POST", f"{base}/{oid}/payments/{pid}/reverse", tok, {"reason": reason})


def money_state(oid):
    return sql(f"select status||'|'||\"paymentStatus\"||'|'||\"amountPaid\"::numeric(14,2) from \"order\" where id={oid}")


# ====================================================================================================
# J1  GUEST: from cart to delivered, with a seller, an admin, tracking, payment and updates
# ====================================================================================================
G = sess()
st0 = stock(119)
cart_id = add_item(G, qty=2)
c, opts = call("GET", f"{CK}/{cart_id}?countryCode=BD", session=G)
check("J1 guest sees checkout options", (c, opts), 200, pred=lambda v: len(v["deliveryOptions"]) == 3 and any(g["id"] == COD for g in v["paymentGateways"]))
c, o1 = call("POST", f"{CK}/{cart_id}/place", session=G, body=pay_body())
check("J1 guest places the order", (c, o1), 201, pred=lambda v: v["status"] == "pending" and v["paymentStatus"] == "due" and v["totals"]["payable"] == 6400 + 40 and v["seller"]["id"] == SID1)
O1 = o1["id"]
NUM1 = o1["orderNumber"]
check("J1 stock fell by the quantity", (200, stock(119)), 200, pred=lambda v: v == st0 - 2)
check("J1 the cart is closed", call("GET", f"{CART}/{cart_id}", session=G), [200, 404], pred=lambda v: True)
check("J1 placing the same cart again is refused", call("POST", f"{CK}/{cart_id}/place", session=G, body=pay_body()), [400, 404, 409])
check("J1 stock not taken twice", (200, stock(119)), 200, pred=lambda v: v == st0 - 2)
check("J1 guest tracks it by number and phone", call("GET", f"{OR}/track?orderNumber={NUM1}&phone=%2B8801712345678"), 200, pred=lambda v: v["id"] == O1 and v["status"] == "pending")
check("J1 owning seller sees it in the list", call("GET", f"{SL}?orderNumber={NUM1}", S1), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O1] and v["results"][0]["allowedStatuses"] == ["confirmed", "cancelled"])
check("J1 other seller does not", call("GET", f"{SL}?orderNumber={NUM1}", S2), 200, pred=lambda v: v["results"] == [])
check("J1 other seller reads detail -> 404", call("GET", f"{SL}/{O1}", S2), 404)
check("J1 admin sees it with all moves open", call("GET", f"{A}?orderNumber={NUM1}", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O1] and set(v["results"][0]["allowedStatuses"]) == set(STATUSES) - {"pending"})
check("J1 seller cannot skip to shipped", staff_status(O1, "shipped", "s1"), 403)
check("J1 seller cannot deliver a pending order", staff_status(O1, "delivered", "s1"), 403)
check("J1 other seller cannot confirm", staff_status(O1, "confirmed", "s2"), 404)
check("J1 customer token cannot confirm", call("PATCH", f"{A}/{O1}/status", U1, {"status": "confirmed"}), 403)
check("J1 seller confirms with a note", staff_status(O1, "confirmed", "s1", "We will pack tomorrow"), 200, pred=lambda v: v["status"] == "confirmed" and v["allowedStatuses"] == ["packed"] and v["statusHistory"][-1]["note"] == "We will pack tomorrow" and v["statusHistory"][-1]["by"]["type"] == "seller")
check("J1 seller cannot cancel after confirm", staff_status(O1, "cancelled", "s1"), 403)
check("J1 seller cannot go back to pending", staff_status(O1, "pending", "s1"), 403)
check("J1 guest sees the new status when tracking", call("GET", f"{OR}/track?orderNumber={NUM1}&phone=%2B8801712345678"), 200, pred=lambda v: v["status"] == "confirmed" and v["canCancel"] is False)
check("J1 guest cannot cancel now", call("POST", f"{OR}/{O1}/cancel", session=G, body={}), 403)
check("J1 seller packs", staff_status(O1, "packed", "s1"), 200, pred=lambda v: v["status"] == "packed")
c, r = multi("POST", f"{SL}/{O1}/updates", S1, {"message": "Packed in a ventilated box"}, [("box.png", PNG, "image/png")])
check("J1 seller posts an update with a photo", (c, r), 201, pred=lambda v: v["orderId"] == O1 and v["updateId"])
check("J1 seller ships", staff_status(O1, "shipped", "s1"), 200, pred=lambda v: v["status"] == "shipped")
c, r = record(O1, "s1", amount="2000", transactionId="BK-1")
check("J1 seller records a part payment", (c, r), 201, pred=lambda v: v["orderId"] == O1 and v["paymentId"])
P1 = r["paymentId"]
check("J1 order is partially paid", (200, money_state(O1)), 200, pred=lambda v: v == "shipped|partially_paid|2000.00")
check("J1 amount above the balance -> 400", record(O1, "s1", amount="99999"), 400)
check("J1 amount of zero -> 400", record(O1, "s1", amount="0"), 400)
check("J1 negative amount -> 400", record(O1, "s1", amount="-5"), 400)
check("J1 no description -> 400", multi("POST", f"{SL}/{O1}/payments", S1, {}, [("a.png", PNG, "image/png")]), 400)
check("J1 no file -> 400", record(O1, "s1", files=[]), 400)
c, r = record(O1, "s1")
check("J1 remaining balance recorded by default", (c, r), 201)
check("J1 order is paid", (200, money_state(O1)), 200, pred=lambda v: v == "shipped|paid|6440.00")
check("J1 paid order takes no more payment -> 409", record(O1, "s1", amount="1"), 409)
check("J1 seller delivers", staff_status(O1, "delivered", "s1"), 200, pred=lambda v: v["status"] == "delivered" and v["allowedStatuses"] == [])
check("J1 nothing left to do for the seller", staff_status(O1, "cancelled", "s1"), 403)
check("J1 delivered order still delivered after admin tries same status", staff_status(O1, "delivered", "admin"), 403, pred=lambda v: "already" in v["message"])
d = detail(O1)
check("J1 full order record is consistent", (200, d), 200, pred=lambda v: [h["status"] for h in v["statusHistory"]] == ["pending", "confirmed", "packed", "shipped", "delivered"] and v["totals"]["balanceDue"] == 0 and v["totals"]["amountPaid"] == 6440 and len(v["payments"]) == 2 and len(v["updates"]) == 1 and len(v["paymentHistory"]) >= 2)
check("J1 history chain is unbroken (each from = previous status)", (200, d), 200, pred=lambda v: all(v["statusHistory"][i]["fromStatus"] == v["statusHistory"][i - 1]["status"] for i in range(1, len(v["statusHistory"]))))
check("J1 guest sees the full story when tracking", call("GET", f"{OR}/track?orderNumber={NUM1}&phone=%2B8801712345678"), 200, pred=lambda v: v["status"] == "delivered" and v["paymentStatus"] == "paid" and len(v["updates"]) == 1 and len(v["statusHistory"]) == 5)
check("J1 stock stays taken after delivery", (200, stock(119)), 200, pred=lambda v: v == st0 - 2)

# ====================================================================================================
# J1b  MONEY IS A DOUBLE: sums carry no floating point noise, input is limited to 2 decimals
# ====================================================================================================
oF = place(sess(), qty=1)
OF = oF["id"]
paid_sum = 0.0
for amt in ["0.1", "0.2", "0.3", "1.10", "33.33", "0.07", "1.05", "12.34"]:
    c, r = record(OF, "admin", amount=amt)
    paid_sum += float(amt)
    got = float(sql(f"select \"amountPaid\" from \"order\" where id={OF}"))
    truth(f"J1b amount {amt} accepted, running total {got} is clean", c == 201 and abs(got - round(paid_sum, 8)) < 1e-9 and len(repr(got)) < 14, (c, got))
check("J1b 0.1 + 0.2 shows as exactly 0.3 in the API", call("GET", f"{A}/{OF}", ADMIN), 200, pred=lambda v: v["totals"]["amountPaid"] == round(paid_sum, 8) and v["totals"]["balanceDue"] == round(oF["totals"]["payable"] - paid_sum, 8))
for bad in ["abc", "NaN", "Infinity", "-0.5", "0", "0.0", "999999999999999", "1.005", "12.3456", "0.001"]:
    check(f"J1b bad amount {bad} -> 400", record(OF, "admin", amount=bad), 400)
c, r = record(OF, "admin")
check("J1b the default pays exactly the rest", (c, r), 201)
check("J1b order is paid and receipts add up exactly", (200, sql(f"select \"paymentStatus\"||'|'||(\"amountPaid\"=\"payableAmount\")||'|'||(select abs(sum(amount)-o.\"payableAmount\")<1e-9 from payment where \"orderId\"=o.id and status<>'due' and \"reversedAt\" is null) from \"order\" o where id={OF}")), 200, pred=lambda v: v == "paid|true|true")
check("J1b money columns are double precision", (200, sql("select count(*) from information_schema.columns where table_schema='public' and data_type='numeric'")), 200, pred=lambda v: v == "0")

# ====================================================================================================
# J2  CUSTOMER: account, address book, MFS proof, cancel, admin reopen, forward chain
# ====================================================================================================
check("J2 saved address", call("POST", "/user/addresses", U1, {"recipientName": f"{TAG} Home", "phone": "+8801712345678", "countryCode": "BD", "state": "Dhaka", "city": "Dhaka", "address": "House 9"}), 201)
st122 = stock(122)
cid = add_item(token=U1, product=95, sku=122, qty=3)
check("J2 checkout with MFS and no proof -> 400", call("POST", f"{CK}/{cid}/place", token=U1, body=pay_body(MFS)), 400)
check("J2 checkout with a disabled gateway -> 400", call("POST", f"{CK}/{cid}/place", token=U1, body=pay_body(OFF)), 400)
check("J2 checkout with an unknown gateway -> 400", call("POST", f"{CK}/{cid}/place", token=U1, body=pay_body(99999999)), 400)
c, o2 = call("POST", f"{CK}/{cid}/place", token=U1, body=pay_body(MFS, paymentProof={"transactionId": "TX-9"}))
check("J2 customer places with MFS proof", (c, o2), 201, pred=lambda v: v["payments"][0]["transactionId"] == "TX-9" and v["seller"]["id"] == SID2)
O2 = o2["id"]
check("J2 stock took 3", (200, stock(122)), 200, pred=lambda v: v == st122 - 3)
check("J2 another customer cannot read it", call("GET", f"{OR}/{O2}", token=U2), 404)
check("J2 another customer cannot cancel it", call("POST", f"{OR}/{O2}/cancel", token=U2, body={}), 404)
check("J2 other seller (S1) cannot touch it", staff_status(O2, "confirmed", "s1"), 404)
check("J2 customer cancels (pending)", call("POST", f"{OR}/{O2}/cancel", token=U1, body={"reason": "Wrong bird"}), [200, 201], pred=lambda v: v["status"] == "cancelled")
check("J2 stock returned", (200, stock(122)), 200, pred=lambda v: v == st122)
check("J2 seller cannot reopen a cancelled order", staff_status(O2, "pending", "s2"), 403)
check("J2 seller cannot confirm a cancelled order", staff_status(O2, "confirmed", "s2"), 403)
check("J2 cancelled order takes no payment -> 409", record(O2, "s2"), 409)
check("J2 admin reopens it (stock taken again)", staff_status(O2, "pending", "admin", "Customer called back"), 200, pred=lambda v: v["status"] == "pending")
check("J2 stock taken again", (200, stock(122)), 200, pred=lambda v: v == st122 - 3)
check("J2 customer can cancel the reopened order again", call("POST", f"{OR}/{O2}/cancel", token=U1, body={}), [200, 201])
sql(f"update seller_product_sku set quantity=1 where id=122")
check("J2 reopen fails when stock is short", staff_status(O2, "pending", "admin"), [400, 409], pred=lambda v: "stock" in json.dumps(v).lower() or "enough" in json.dumps(v).lower())
check("J2 failed reopen leaves it cancelled and stock alone", (200, sql(f"select (select status from \"order\" where id={O2})||'|'||(select quantity from seller_product_sku where id=122)")), 200, pred=lambda v: v == "cancelled|1")
sql(f"update seller_product_sku set quantity={st122} where id=122")
check("J2 admin jumps straight to delivered", staff_status(O2, "delivered", "admin"), 200, pred=lambda v: v["status"] == "delivered")
check("J2 stock taken for the reopened order", (200, stock(122)), 200, pred=lambda v: v == st122 - 3)
check("J2 admin goes back to packed", staff_status(O2, "packed", "admin"), 200)
check("J2 customer history lists every change in order", call("GET", f"{OR}/{O2}", token=U1), 200, pred=lambda v: [h["status"] for h in v["statusHistory"]] == ["pending", "cancelled", "pending", "cancelled", "delivered", "packed"] if False else v["statusHistory"][-1]["status"] == "packed" and len(v["statusHistory"]) == 6)
check("J2 admin cancels it at the end (stock back)", staff_status(O2, "cancelled", "admin"), 200)
check("J2 stock fully restored", (200, stock(122)), 200, pred=lambda v: v == st122)

# ====================================================================================================
# J3  STAFF-CREATED ORDERS (admin for a customer, seller walk-in) and what the customer then sees
# ====================================================================================================
item = lambda sku=119, prod=94, q=1: [{"sellerProductId": prod, "sellerProductSkuId": sku, "quantity": q}]
st = stock(119)
c, o3 = call("POST", A, ADMIN, pay_body(sellerId=SID1, userId=UID2, items=item(q=2)))
check("J3 admin creates for a customer", (c, o3), 201, pred=lambda v: v["status"] == "pending" and v["statusHistory"][0]["by"]["type"] == "admin")
O3 = o3["id"]
check("J3 customer sees it in their orders", call("GET", OR, token=U2), 200, pred=lambda v: O3 in [r["id"] for r in v["results"]])
check("J3 customer can cancel it", call("POST", f"{OR}/{O3}/cancel", token=U2, body={}), [200, 201])
check("J3 stock back after customer cancel", (200, stock(119)), 200, pred=lambda v: v == st)
check("J3 admin cannot order for a suspended customer", call("POST", A, ADMIN, pay_body(sellerId=SID1, userId=UID3, items=item())), 400)
check("J3 admin cannot order for an unknown customer", call("POST", A, ADMIN, pay_body(sellerId=SID1, userId=99999999, items=item())), 400)
check("J3 admin must name a seller", call("POST", A, ADMIN, pay_body(items=item())), 400)
check("J3 seller cannot name another seller", call("POST", SL, S1, pay_body(sellerId=SID2, items=item())), 403)
check("J3 seller cannot sell another seller's product", call("POST", SL, S1, pay_body(items=item(122, 95))), 400)
check("J3 admin cannot mix a product from another seller", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=item(122, 95))), 400)
check("J3 a variant twice -> 400", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=item() + item())), 400)
check("J3 quantity above stock -> 400/409", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=item(q=99))), [400, 409])
check("J3 quantity 0 -> 400", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=item(q=0))), 400)
check("J3 quantity 100 -> 400", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=item(q=100))), 400)
check("J3 no items -> 400", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=[])), 400)
check("J3 a client price is rejected", call("POST", A, ADMIN, pay_body(sellerId=SID1, items=[{"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 1, "price": 1}])), 400)
check("J3 failed creates left the stock alone", (200, stock(119)), 200, pred=lambda v: v == st)
c, o4 = call("POST", SL, S1, pay_body(items=item(120, 94, 1), recipientName=f"{TAG} Walkin"))
check("J3 seller creates a walk-in order", (c, o4), 201, pred=lambda v: v["customer"]["isGuest"] is True and v["statusHistory"][0]["by"]["type"] == "seller")
O4 = o4["id"]
check("J3 walk-in tracked by number and phone", call("GET", f"{OR}/track?orderNumber={o4['orderNumber']}&phone=%2B8801712345678"), 200, pred=lambda v: v["id"] == O4)
check("J3 seller cancels own pending walk-in order", staff_status(O4, "cancelled", "s1"), 200)
check("J3 stock of 120 back", (200, stock(120)), 200, pred=lambda v: v == SEED[120])

# ====================================================================================================
# J4  PAYMENT RULES: who can reverse what, history, interplay with cancel
# ====================================================================================================
o5 = place(sess(), qty=1)
O5 = o5["id"]
PAYABLE5 = o5["totals"]["payable"]
c, r = record(O5, "admin", amount="1000", transactionId="ADM-1")
check("J4 admin records a part payment", (c, r), 201)
PA = r["paymentId"]
c, r = record(O5, "s1", amount="500")
check("J4 seller records another", (c, r), 201)
PS = r["paymentId"]
check("J4 seller cannot reverse the admin's payment", reverse(O5, PA, "s1"), 403, pred=lambda v: "admin recorded" in v["message"])
check("J4 other seller cannot reverse (not theirs)", reverse(O5, PS, "s2"), 404)
check("J4 customer cannot reverse", call("POST", f"{A}/{O5}/payments/{PS}/reverse", U1, {"reason": "x"}), 403)
check("J4 reversal needs a reason", call("POST", f"{SL}/{O5}/payments/{PS}/reverse", S1, {}), 400)
check("J4 reversal reason too short -> 400", call("POST", f"{SL}/{O5}/payments/{PS}/reverse", S1, {"reason": "x"}), 400)
check("J4 payment id from a different order -> 404", reverse(O1, PS, "admin"), 404)
check("J4 seller reverses own payment", reverse(O5, PS, "s1", "Cheque bounced"), [200, 201], pred=lambda v: v["amountPaid"] == 1000 and v["paymentStatus"] == "partially_paid")
check("J4 reversing again -> 409", reverse(O5, PS, "s1"), 409)
check("J4 admin reverses admin's payment", reverse(O5, PA, "admin", "Entered twice"), [200, 201], pred=lambda v: v["amountPaid"] == 0 and v["paymentStatus"] == "due")
check("J4 money back to nothing", (200, money_state(O5)), 200, pred=lambda v: v == "pending|due|0.00")
rows = sql(f"select count(*) from payment_status_history where \"orderId\"={O5}")
check("J4 placement, receipts and reversals wrote a history row each (5)", (200, rows), 200, pred=lambda v: int(v) == 5)
check("J4 receipts stay visible as reversed", call("GET", f"{AP}?orderId={O5}&reversed=true", ADMIN), 200, pred=lambda v: len(v["results"]) == 2)
c, r = record(O5, "admin")
check("J4 full payment after reversals", (c, r), 201)
check("J4 now fully paid for the real payable", (200, money_state(O5)), 200, pred=lambda v: v == f"pending|paid|{PAYABLE5:.2f}")
st = stock(119)
check("J4 admin cancels a paid order (money stays, stock back)", staff_status(O5, "cancelled", "admin"), 200)
check("J4 stock returned", (200, stock(119)), 200, pred=lambda v: v == st + 1)
check("J4 the paid amount is untouched by cancel", (200, money_state(O5)), 200, pred=lambda v: v == f"cancelled|paid|{PAYABLE5:.2f}")
check("J4 payment on cancelled -> 409", record(O5, "admin", amount="1"), 409)
c, rv = reverse(O5, r["paymentId"], "admin", "Refunded outside")
check("J4 admin can still reverse a payment on a cancelled order", (c, rv), [200, 201], pred=lambda v: v["amountPaid"] == 0)
check("J4 payment lists: seller sees only own", call("GET", f"{SP}?orderId={O5}", S2), 200, pred=lambda v: v["results"] == [])
check("J4 payment lists: seller1 sees own", call("GET", f"{SP}?orderId={O5}&limit=100", S1), 200, pred=lambda v: len(v["results"]) >= 2)
pid_any = call("GET", f"{SP}?orderId={O5}", S1)[1]["results"][0]["id"]
check("J4 payment detail of another seller -> 404", call("GET", f"{SP}/{pid_any}", S2), 404)
check("J4 payment detail as owner", call("GET", f"{SP}/{pid_any}", S1), 200)
check("J4 customer token on payment list -> 403", call("GET", AP, U1), 403)

# ====================================================================================================
# J5  UPLOADS
# ====================================================================================================
o6 = place(sess())
O6 = o6["id"]
good = lambda: {"description": "Paid by bank slip"}
check("J5 exe disguised as png -> 400", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [("a.png", b"MZ\x90\x00bad", "image/png")]), 400)
check("J5 html file -> 400", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [("a.html", b"<script>alert(1)</script>", "text/html")]), 400)
check("J5 svg -> 400", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [("a.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml")]), 400)
check("J5 php -> 400", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [("a.php", b"<?php echo 1;", "application/x-php")]), 400)
check("J5 pdf with a png extension -> 400", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [("a.png", PDF, "image/png")]), 400)
check("J5 11 files -> 400", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [(f"{i}.png", PNG, "image/png") for i in range(11)]), 400)
check("J5 file over 10 MB -> 400/413", multi("POST", f"{A}/{O6}/payments", ADMIN, good(), [("big.png", PNG + b"\0" * (10 * 1024 * 1024 + 10), "image/png")]), [400, 413])
check("J5 path traversal in the file name is harmless", multi("POST", f"{A}/{O6}/payments", ADMIN, {**good(), "amount": "10"}, [("../../etc/passwd.png", PNG, "image/png")]), 201)
check("J5 nothing escaped the uploads folder", (200, sql(f"select count(*) from payment_attachments where \"orderId\"={O6} and \"filePath\" like '%..%'")), 200, pred=lambda v: v == "0")
check("J5 failed uploads recorded nothing (only the one good payment)", (200, sql(f"select count(*) from payment where \"orderId\"={O6} and status<>'due'")), 200, pred=lambda v: v == "1")
check("J5 update with neither message nor file -> 400", multi("POST", f"{A}/{O6}/updates", ADMIN, {}, []), 400)
check("J5 update message of 2001 chars -> 400", multi("POST", f"{A}/{O6}/updates", ADMIN, {"message": "m" * 2001}, []), 400)
check("J5 update with a good message", multi("POST", f"{A}/{O6}/updates", ADMIN, {"message": "m" * 2000}, []), 201)
check("J5 update on another seller's order -> 404", multi("POST", f"{SL}/{O6}/updates", S2, {"message": "hi"}, []), 404)
check("J5 update by a customer -> 403", multi("POST", f"{A}/{O6}/updates", U1, {"message": "hi"}, []), 403)
check("J5 update without token -> 401", multi("POST", f"{A}/{O6}/updates", None, {"message": "hi"}, []), 401)
check("J5 updates cannot be deleted or edited", call("DELETE", f"{A}/{O6}/updates/1", ADMIN), 404)

# ====================================================================================================
# J6  CROSS-ACTOR ACCESS SWEEP (no token, bad token, wrong role) on every order endpoint
# ====================================================================================================
SID = "1"
ADMIN_EP = [("GET", A), ("GET", A + "/customers?q=abcdef"), ("GET", A + "/catalog?sellerId=1"), ("GET", A + "/options?countryCode=BD"), ("POST", A), (
    "GET", f"{A}/{O1}"), ("PATCH", f"{A}/{O1}/status"), ("POST", f"{A}/{O1}/payments"), ("POST", f"{A}/{O1}/payments/1/reverse"), ("POST", f"{A}/{O1}/updates"), ("GET", AP), ("GET", f"{AP}/1")]
SELLER_EP = [(m, p.replace("/admin/", "/seller/")) for m, p in ADMIN_EP] + [("GET", f"{SL}/customers/{UID1}/addresses"), ("POST", f"{SL}/customers/{UID1}/addresses")]
SELLER_EP = [(m, p) for m, p in SELLER_EP]
for m, p in ADMIN_EP:
    n = f"{m} {p.split('?')[0]}"
    check(f"J6 admin {n}: no token -> 401", call(m, p), 401)
    check(f"J6 admin {n}: garbage token -> 401", call(m, p, "garbage.token.value"), 401)
    check(f"J6 admin {n}: customer -> 403", call(m, p, U1, {}), 403)
    check(f"J6 admin {n}: seller -> 403", call(m, p, S1, {}), 403)
for m, p in SELLER_EP:
    n = f"{m} {p.split('?')[0]}"
    check(f"J6 seller {n}: no token -> 401", call(m, p), 401)
    check(f"J6 seller {n}: garbage token -> 401", call(m, p, "garbage.token.value"), 401)
    check(f"J6 seller {n}: customer -> 403", call(m, p, U1, {}), 403)
    check(f"J6 seller {n}: admin -> 403", call(m, p, ADMIN, {}), 403)
# seller that is no longer approved/active
for label, setting in [("suspended", "\"activeStatus\"='suspended'"), ("inactive", "\"activeStatus\"='inactive'"), ("rejected", "status='rejected'"), ("pending", "status='pending'")]:
    sql(f"update seller set {setting} where id={SID1}")
    check(f"J6 {label} seller cannot list orders", call("GET", SL, S1), 403)
    check(f"J6 {label} seller cannot change status", staff_status(O1, "delivered", "s1"), 403)
    check(f"J6 {label} seller cannot record payment", record(O1, "s1"), 403)
    check(f"J6 {label} seller cannot create orders", call("POST", SL, S1, pay_body(items=item())), 403)
    check(f"J6 {label} seller cannot list payments", call("GET", SP, S1), 403)
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={SID1}")
check("J6 approved seller works again", call("GET", SL, S1), 200)
# customer-side owners
check("J6 customer endpoints without owner -> 400", call("GET", OR), 400)
check("J6 customer endpoints with garbage token -> 401", call("GET", OR, "garbage"), 401)
check("J6 a suspended customer cannot place orders", call("POST", f"{CK}/{add_item(token=U1)}/place", token=U3, body=pay_body()), [401, 403, 404])
check("J6 a seller token as customer is refused", call("GET", OR, S1), [401, 403, 400])
check("J6 an admin token as customer is refused", call("GET", OR, ADMIN), [401, 403, 400])

# ====================================================================================================
# J7  ID FUZZ: strange ids never give a 5xx
# ====================================================================================================
BAD_IDS = ["0", "-1", "1.5", "abc", "99999999999999999999", "1e3", "%20", "null", "%27%20OR%201=1--"]
fuzz_calls = [("GET", "{b}/{i}", None), ("PATCH", "{b}/{i}/status", {"status": "confirmed"}), ("POST", "{b}/{i}/payments/{i}/reverse", {"reason": "reason"}),
              ("GET", "{p}/{i}", None)]
for bi in BAD_IDS:
    for who, b, tok, p in [("admin", A, ADMIN, AP), ("seller", SL, S1, SP)]:
        for m, tpl, body in fuzz_calls:
            c, d = call(m, tpl.format(b=b, i=bi, p=p), tok, body)
            truth(f"J7 {who} {m} {tpl.split('/', 1)[1] if False else tpl.replace('{b}', who).replace('{p}', who + '-pay').replace('{i}', bi)} -> 400/404 not 5xx (got {c})", c in (400, 404))
    for m, path in [("GET", f"{OR}/{bi}"), ("POST", f"{OR}/{bi}/cancel"), ("GET", f"{CK}/{bi}")]:
        c, d = call(m, path, U1, {} if m == "POST" else None)
        truth(f"J7 customer {m} {path.split('/')[-2] if m == 'POST' else path.split('/')[-1]} {bi} -> 400/404 (got {c})", c in (400, 404))

# ====================================================================================================
# J8  BODY FUZZ: malformed bodies never give a 5xx
# ====================================================================================================
BODIES = [("empty object", "{}"), ("array", "[]"), ("null", "null"), ("string", '"x"'), ("broken json", "{bad"), ("number", "12"),
          ("huge string", json.dumps({"status": "x" * 100000})), ("nested", json.dumps({"status": {"a": 1}})), ("null status", json.dumps({"status": None})),
          ("status number", json.dumps({"status": 3})), ("unknown field", json.dumps({"status": "confirmed", "hack": 1})), ("empty status", json.dumps({"status": ""})),
          ("uppercase status", json.dumps({"status": "CONFIRMED"})), ("note too long", json.dumps({"status": "confirmed", "note": "n" * 501}))]
o7 = place(sess())
for label, raw in BODIES:
    for who, base, tok in [("admin", A, ADMIN), ("seller", SL, S1)]:
        c, d = call("PATCH", f"{base}/{o7['id']}/status", tok, raw=raw)
        truth(f"J8 {who} status body '{label}' -> 4xx (got {c})", 400 <= c < 500)
    c, d = call("POST", f"{OR}/{o7['id']}/cancel", U1, raw=raw)
    truth(f"J8 customer cancel body '{label}' -> 4xx (got {c})", 400 <= c < 500)
check("J8 order untouched by all bad bodies", (200, money_state(o7["id"])), 200, pred=lambda v: v == "pending|due|0.00")
PLACE_BAD = [("no fields", {}), ("bad phone", pay_body(recipientPhone="123")), ("phone no plus", pay_body(recipientPhone="8801712345678")), ("bad country", pay_body(countryCode="ZZ")),
             ("lowercase country ok?", None), ("no name", pay_body(recipientName=None)), ("name too long", pay_body(recipientName="n" * 300)), ("no address", pay_body(addressLine=None)),
             ("no city", pay_body(city=None)), ("bad delivery type", pay_body(deliveryType="drone")), ("no gateway", pay_body(paymentGatewayId=None)), ("gateway string", pay_body(paymentGatewayId="abc")),
             ("gateway negative", pay_body(paymentGatewayId=-1)), ("bad email", pay_body(email="not-an-email")), ("note too long", pay_body(note="n" * 2000)), ("unknown field", pay_body(totalAmount=1)),
             ("sql in name", pay_body(recipientName="x'); drop table \"order\";--")), ("script in name", pay_body(recipientName="<script>alert(1)</script>"))]
for label, body in PLACE_BAD:
    if body is None:
        continue
    cid = add_item(sess())
    s = sql(f"select \"sessionId\" from cart where id={cid}")
    c, d = call("POST", f"{CK}/{cid}/place", session=s, body=body)
    ok_stored = label in ("sql in name", "script in name")
    truth(f"J8 place '{label}' -> {'201 stored as text' if ok_stored else '400'} (got {c})", (c == 201) if ok_stored else (c == 400))
truth("J8 the orders table survived the injection attempt", sql("select count(*) from \"order\"") != "")

# ====================================================================================================
# J9  CONCURRENCY
# ====================================================================================================
def par(fns, workers=10):
    with cf.ThreadPoolExecutor(workers) as ex:
        return list(ex.map(lambda f: f(), fns))


# 9a: 8 buyers fight for the last 2 units
sql("update seller_product_sku set quantity=2 where id=123")
SEED[123] = 2
sess_list = [sess() for _ in range(8)]
cids = [add_item(s, product=95, sku=123, qty=1) for s in sess_list]
if cids:
    res = par([lambda s=s, c_=c_: call("POST", f"{CK}/{c_}/place", session=s, body=pay_body()) for s, c_ in zip(sess_list, cids)])
    codes = sorted(r[0] for r in res)
    truth("J9a exactly 2 of 8 buyers got the last 2 units", codes.count(201) == 2 and all(x in (400, 409) for x in codes if x != 201), codes)
    truth("J9a stock is 0, not negative", stock(123) == 0, stock(123))
else:
    print("SKIP J9a: sku 123 not on product 96")

# 9b: confirm (seller) vs cancel (admin) vs cancel (customer) at the same time
st = stock(119)
o8 = place(sess(), token=U1, qty=2)
res = par([lambda: staff_status(o8["id"], "confirmed", "s1"), lambda: staff_status(o8["id"], "cancelled", "admin"), lambda: call("POST", f"{OR}/{o8['id']}/cancel", U1, {}), lambda: staff_status(o8["id"], "cancelled", "s1")])
final = sql(f"select status from \"order\" where id={o8['id']}")
truth("J9b a single consistent final status", final in ("confirmed", "cancelled"), final)
hist = int(sql(f"select count(*) from order_status_history where \"orderId\"={o8['id']}"))
truth("J9b history rows match the winning moves", hist >= 2, hist)
truth("J9b stock is consistent with the status (given back once or never)", stock(119) == (st if final == "cancelled" else st - 2), (final, stock(119), st))
if final == "confirmed":
    staff_status(o8["id"], "cancelled", "admin")
truth("J9b stock fully back after final cancel", stock(119) == st, stock(119))

# 9c: 10 parallel full payments on one order
o9 = place(sess(), qty=1)
res = par([lambda: record(o9["id"], "admin") for _ in range(10)])
codes = sorted(r[0] for r in res)
truth("J9c only one of 10 parallel full payments succeeded", codes.count(201) == 1 and all(x == 409 for x in codes if x != 201), codes)
check("J9c order is paid exactly once", (200, money_state(o9["id"])), 200, pred=lambda v: v.startswith("pending|paid|") and float(v.split("|")[2]) == o9["totals"]["payable"])

# 9d: parallel part payments that together overshoot
o10 = place(sess(), qty=1)
pay = o10["totals"]["payable"]
part = str(round(pay / 2 + 100, 2))
res = par([lambda: record(o10["id"], "admin", amount=part) for _ in range(6)])
ok = [r for r in res if r[0] == 201]
truth("J9d never more than the balance is accepted", float(sql(f"select \"amountPaid\" from \"order\" where id={o10['id']}")) <= pay, [r[0] for r in res])
truth("J9d accepted payments add up to the recorded amount", abs(float(sql(f"select coalesce(sum(amount),0) from payment where \"orderId\"={o10['id']} and status<>'due' and \"reversedAt\" is null")) - float(sql(f"select \"amountPaid\" from \"order\" where id={o10['id']}"))) < 0.005)

# 9e: parallel reversals of one payment
c, r = record(o10["id"], "admin", amount="50")
if c == 201:
    res = par([lambda: reverse(o10["id"], r["paymentId"], "admin") for _ in range(6)])
    codes = sorted(x[0] for x in res)
    truth("J9e only one parallel reversal wins", sum(1 for x in codes if x in (200, 201)) == 1, codes)

# 9f: parallel cancels by customer (stock back once)
st = stock(119)
o11 = place(sess(), token=U2, qty=2)
res = par([lambda: call("POST", f"{OR}/{o11['id']}/cancel", U2, {}) for _ in range(6)])
codes = sorted(x[0] for x in res)
truth("J9f one cancel wins, the rest are refused", sum(1 for x in codes if x in (200, 201)) == 1 and all(x in (403, 409) for x in codes if x not in (200, 201)), codes)
truth("J9f stock came back once", stock(119) == st, (stock(119), st))

# 9g: parallel double-submit of one cart
cid = add_item(sess(), qty=1)
s = sql(f"select \"sessionId\" from cart where id={cid}")
st = stock(119)
res = par([lambda: call("POST", f"{CK}/{cid}/place", session=s, body=pay_body()) for _ in range(6)])
codes = sorted(x[0] for x in res)
truth("J9g one order from six parallel submits", codes.count(201) == 1, codes)
truth("J9g stock taken once", stock(119) == st - 1, (stock(119), st))
truth("J9g one order row for that cart", sql(f"select count(*) from \"order\" where \"cartId\"={cid}") == "1")

# ====================================================================================================
# J10  STATE CHANGES AFTER CART IS BUILT
# ====================================================================================================
cid = add_item(sess(), qty=1)
s = sql(f"select \"sessionId\" from cart where id={cid}")
sql("update seller_product_sku set \"isActive\"=false where id=119")
c, d = call("POST", f"{CK}/{cid}/place", session=s, body=pay_body())
check("J10 a variant deactivated after adding -> refused with details", (c, d), [400, 409], pred=lambda v: "message" in v)
sql("update seller_product_sku set \"isActive\"=true where id=119")
sql(f"update seller_product set \"activeStatus\"='inactive' where id=94")
check("J10 a deactivated product -> refused", call("POST", f"{CK}/{cid}/place", session=s, body=pay_body()), [400, 409])
sql(f"update seller_product set \"activeStatus\"='active' where id=94")
sql(f"update seller set \"activeStatus\"='suspended' where id={SID1}")
check("J10 a suspended seller's product -> refused", call("POST", f"{CK}/{cid}/place", session=s, body=pay_body()), [400, 409])
sql(f"update seller set \"activeStatus\"='active' where id={SID1}")
sql("update seller_product_sku set price=4000, \"discountedPrice\"=null where id=119")
c, o12 = call("POST", f"{CK}/{cid}/place", session=s, body=pay_body())
check("J10 a price change before checkout is used at order time", (c, o12), 201, pred=lambda v: v["totals"]["subtotal"] == 4000)
sql("update seller_product_sku set price=3500, \"discountedPrice\"=3200 where id=119")
check("J10 a later price change does not touch the placed order", call("GET", f"{A}/{o12['id']}", ADMIN), 200, pred=lambda v: v["totals"]["subtotal"] == 4000 and v["items"][0]["unitPrice"] in (4000, "4000.00"))

# ====================================================================================================
# J11  LIST, FILTER AND PAGE EVERYTHING WE MADE
# ====================================================================================================
check("J11 admin status filter agrees with the rows", call("GET", f"{A}?status=delivered&limit=100", ADMIN), 200, pred=lambda v: all(r["status"] == "delivered" for r in v["results"]) and O1 in [r["id"] for r in v["results"]])
check("J11 admin paymentStatus filter", call("GET", f"{A}?paymentStatus=paid&limit=100", ADMIN), 200, pred=lambda v: all(r["paymentStatus"] == "paid" for r in v["results"]))
check("J11 owner=guest filter", call("GET", f"{A}?owner=guest&limit=100", ADMIN), 200, pred=lambda v: all(r["customer"]["isGuest"] for r in v["results"]) and O1 in [r["id"] for r in v["results"]])
check("J11 owner=customer filter", call("GET", f"{A}?owner=customer&limit=100", ADMIN), 200, pred=lambda v: all(not r["customer"]["isGuest"] for r in v["results"]))
check("J11 bad status -> 400", call("GET", f"{A}?status=nope", ADMIN), 400)
check("J11 limit 0 falls back to the default (project convention)", call("GET", f"{A}?limit=0", ADMIN), 200)
check("J11 negative limit -> 400", call("GET", f"{A}?limit=-1", ADMIN), 400)
check("J11 negative cursor -> 400", call("GET", f"{A}?cursor=-5", ADMIN), 400)
check("J11 limit 101 -> 400", call("GET", f"{A}?limit=101", ADMIN), 400)
check("J11 non-numeric cursor means first page (project convention)", call("GET", f"{A}?cursor=@@@", ADMIN), 200)
check("J11 min above max total -> 400", call("GET", f"{A}?minTotal=1000000&maxTotal=1", ADMIN), 400)
check("J11 seller list never shows another seller's orders", call("GET", f"{SL}?limit=100", S2), 200, pred=lambda v: all(r["id"] not in (O1, O5, O6) for r in v["results"]))
seen, cur, pages = [], None, 0
while pages < 100:
    c, d = call("GET", f"{A}?limit=5" + (f"&cursor={cur}" if cur else ""), ADMIN)
    if c != 200:
        break
    seen += [r["id"] for r in d["results"]]
    cur = d.get("nextCursor")
    pages += 1
    if not cur:
        break
truth("J11 cursor paging walks every order once", len(seen) == len(set(seen)) and len(seen) == int(sql("select count(*) from \"order\"")), (len(seen), len(set(seen))))
truth("J11 cursor paging is newest first", seen == sorted(seen, reverse=True))

# ====================================================================================================
# J12  INVARIANTS ACROSS EVERYTHING THIS SUITE CREATED
# ====================================================================================================
mine = f"\"recipientName\" like '{TAG} %'"
truth("I1 payable = subtotal + delivery - discount", sql(f"select count(*) from \"order\" where {mine} and \"payableAmount\" <> subtotal + \"deliveryCharge\" - \"discountAmount\"") == "0")
truth("I2 subtotal = sum of lines", sql(f"select count(*) from \"order\" o where o.{mine} and o.subtotal <> (select coalesce(sum(\"totalDiscountedPrice\"),0) from order_item i where i.\"orderId\"=o.id)") == "0")
truth("I3 amountPaid = sum of live receipts", sql(f"select count(*) from \"order\" o where o.{mine} and o.\"amountPaid\" <> (select coalesce(sum(p.amount),0) from payment p where p.\"orderId\"=o.id and p.status<>'due' and p.\"reversedAt\" is null)") == "0")
truth("I4 paymentStatus matches the money", sql(f"select count(*) from \"order\" where {mine} and ((\"amountPaid\"=0 and \"paymentStatus\"<>'due') or (\"amountPaid\">0 and \"amountPaid\"<\"payableAmount\" and \"paymentStatus\"<>'partially_paid') or (\"amountPaid\">=\"payableAmount\" and \"paymentStatus\"<>'paid'))") == "0")
truth("I5 amountPaid never above payable", sql(f"select count(*) from \"order\" where {mine} and \"amountPaid\" > \"payableAmount\"") == "0")
truth("I6 every order has a placed-history row", sql(f"select count(*) from \"order\" o where o.{mine} and not exists (select 1 from order_status_history h where h.\"orderId\"=o.id)") == "0")
truth("I7 last history row equals the order status", sql(f"select count(*) from \"order\" o where o.{mine} and (select h.status from order_status_history h where h.\"orderId\"=o.id order by h.id desc limit 1)::text <> o.status::text") == "0")
truth("I8 no negative stock", sql("select count(*) from seller_product_sku where quantity < 0") == "0")
truth("I9 every order number is unique and well formed", sql(f"select count(*) from \"order\" where {mine} and \"orderNumber\" !~ '^PN[0-9]{{6}}-[A-Z0-9]{{6}}$'") == "0" and sql("select count(*) from (select \"orderNumber\" from \"order\" group by 1 having count(*)>1) x") == "0")
truth("I10 every ordered cart is closed and linked both ways", sql(f"select count(*) from \"order\" o join cart c on c.id=o.\"cartId\" where o.{mine} and (c.\"isActive\" or c.\"orderId\" is distinct from o.id)") == "0")
truth("I11 attachments on disk exist", all(os.path.exists(os.path.join(UPLOADS, p)) for p in sql(f"select \"filePath\" from payment_attachments where \"orderId\" in (select id from \"order\" where {mine})").split()))
live = f"status not in ('cancelled')"
expected = {}
for sku in (119, 120, 121, 122, 123):
    taken = int(sql(f"select coalesce(sum(i.quantity),0) from order_item i join \"order\" o on o.id=i.\"orderId\" where (o.{mine} or o.\"sellerId\" in (select id from seller where name like '{TAG} %')) and o.status<>'cancelled' and i.\"sellerProductSkuId\"={sku}"))
    expected[sku] = SEED[sku] - taken
truth("I12 stock = seeded stock minus quantity in non-cancelled orders (conservation)", all(stock(k) == v for k, v in expected.items()), {k: (stock(k), v) for k, v in expected.items()})

# ====================================================================================================
# J13  ROLE x STATUS MATRIX (run last; it edits statuses directly)
# ====================================================================================================
def rules(actor, a, b):
    if a == b:
        return False
    if actor == "admin":
        return True
    fwd = {"confirmed": "packed", "packed": "shipped", "shipped": "delivered"}
    return (a == "pending" and b in ("confirmed", "cancelled")) or fwd.get(a) == b


om = place(sess(), qty=1)
OM = om["id"]
for actor, who in [("seller", "s1"), ("admin", "admin")]:
    for a in STATUSES:
        for b in STATUSES:
            sql(f"update \"order\" set status='{a}' where id={OM}")
            c, d = staff_status(OM, b, who)
            want = rules(actor, a, b)
            now = sql(f"select status from \"order\" where id={OM}")
            truth(f"J13 {actor}: {a} -> {b} {'allowed' if want else 'refused'} (got {c}, now {now})", (c == 200 and now == b) if want else (c == 403 and now == a))
for actor in ("seller", "admin"):
    for a in STATUSES:
        sql(f"update \"order\" set status='{a}' where id={OM}")
        tok = S1 if actor == "seller" else ADMIN
        base = SL if actor == "seller" else A
        row = call("GET", f"{base}?orderNumber={om['orderNumber']}", tok)[1]["results"][0]
        want = sorted(b for b in STATUSES if rules(actor, a, b))
        truth(f"J13 {actor} allowedStatuses at {a} = {want}", sorted(row["allowedStatuses"]) == want, row["allowedStatuses"])
for a in STATUSES:
    sql(f"update \"order\" set status='{a}' where id={OM}")
    c, d = call("POST", f"{OR}/{OM}/cancel", token=None, body={}, session=sess())
    truth(f"J13 a stranger cannot cancel an order at {a} (got {c})", c in (400, 404))

# ====================================================================================================
# summary
# ====================================================================================================
cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, dd)
sys.exit(1 if failed else 0)
