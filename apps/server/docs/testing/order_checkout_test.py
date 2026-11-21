#!/usr/bin/env python3
"""Black-box tests: checkout of one cart into one order, stock, guests, customer order list/detail/cancel."""
import concurrent.futures as cf, json, os, re, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)


def call(method, path, token=None, body=None, session=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    text, code = out.rsplit("\n", 1)
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = text
    return int(code), data


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


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


def register(n):
    phone = f"+88017{RUN_NUM}{n:03d}"
    c, d = call("POST", "/user/auth/register", body={"name": f"T Order {n}", "phone": phone, "password": "Passw0rd!x", "email": f"t-order-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"], phone


P_HOMER, S_HOMER_M = 94, 119      # seller 5
P_SPRINT, S_SPRINT_M = 95, 122    # seller 6
CART, CK, OR = "/user/carts", "/user/checkout", "/user/orders"
SETTINGS = ("shipping.defaultCharge",)


def restore():
    sql("update seller_product set \"activeStatus\"='active', status='approved' where id in (94,95,96)")
    sql("update seller set status='approved', \"activeStatus\"='active' where id in (5,6,7)")
    sql("update seller_product_sku set \"isActive\"=true, \"discountedPriceStartDate\"=null where \"sellerProductId\" in (94,95,96)")
    sql("update seller_product_sku set quantity=6, price=3500, \"discountedPrice\"=3200 where id=119")
    sql("update seller_product_sku set quantity=4 where id=120")
    sql("update seller_product_sku set quantity=3 where id=121")
    sql("update seller_product_sku set quantity=8, price=3000, \"discountedPrice\"=null where id=122")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")


def cleanup():
    sql("update cart set \"orderId\"=null where \"orderId\" in (select id from \"order\" where \"recipientName\" like 'T Order %')")
    sql("delete from payment where \"orderId\" in (select id from \"order\" where \"recipientName\" like 'T Order %')")
    sql("delete from system_commission_history where \"orderId\" in (select id from \"order\" where \"recipientName\" like 'T Order %')")
    sql("delete from \"order\" where \"recipientName\" like 'T Order %'")
    sql(f"delete from cart where \"sessionId\" like 'torder{RUN}%' or \"userId\" in (select id from \"user\" where email like 't-order-{RUN}-%')")
    sql(f"delete from \"user\" where email like 't-order-{RUN}-%'")
    sql("delete from payment_gateway where slug like 't-order-%'")
    sql("delete from shipping_zone where name like 'T Order %'")
    restore()


cleanup()
restore()
sql("update system_setting set value='50' where key='shipping.defaultCharge'")
MFS = int(sql(f"insert into payment_gateway (name, slug, type, \"accountNumber\", \"isActive\") values ('T Order MFS','t-order-mfs-{RUN}','mfs','01700000000',true) returning id").splitlines()[0])
OFF = int(sql(f"insert into payment_gateway (name, slug, type, \"isActive\") values ('T Order Off','t-order-off-{RUN}','cod',false) returning id").splitlines()[0])
BANK = int(sql(f"insert into payment_gateway (name, slug, type, \"accountName\", \"accountNumber\", \"bankName\", \"isActive\") values ('T Order Bank','t-order-bank-{RUN}','bank','A','1','B',true) returning id").splitlines()[0])
COD = int(sql("select id from payment_gateway where slug='cash-on-delivery'"))


def sess(tag):
    return f"torder{RUN}{tag}"


def add(session=None, token=None, product=P_HOMER, qty=1, sku=None):
    body = {"sellerProductId": product, "quantity": qty}
    if sku:
        body["sellerProductSkuId"] = sku
    c, d = call("POST", CART + "/items", token=token, body=body, session=session)
    assert c in (200, 201), (c, d)
    return d["cart"]["id"]


def stock(sku):
    return int(sql(f"select quantity from seller_product_sku where id={sku}"))


def payload(gateway=COD, **over):
    p = {
        "recipientName": "T Order Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD",
        "city": "Dhaka", "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": gateway,
    }
    p.update(over)
    return {k: v for k, v in p.items() if v is not None}


# ================================================================= A options
G1 = sess("a1")
cart_a = add(G1)
check("A options without owner -> 400", call("GET", f"{CK}/{cart_a}"), 400)
check("A options for someone else's cart -> 404", call("GET", f"{CK}/{cart_a}", session=sess("zz")), 404)
check("A options unknown cart -> 404", call("GET", f"{CK}/99999999", session=G1), 404)
check("A options bad id -> 400", call("GET", f"{CK}/abc", session=G1), 400)
check("A options bad country -> 400", call("GET", f"{CK}/{cart_a}?countryCode=ZZZ", session=G1), 400)
check("A options bad token -> 401", call("GET", f"{CK}/{cart_a}", token="garbage"), 401)
c, v = call("GET", f"{CK}/{cart_a}", session=G1)
check("A options without country: cart and gateways, no delivery prices", (c, v), 200, pred=lambda v: v["cart"]["id"] == cart_a and v["deliveryOptions"] == [] and v["countryCode"] is None)
check("A options list only active gateways", (c, v), 200, pred=lambda v: {g["id"] for g in v["paymentGateways"]} >= {COD, MFS, BANK} and OFF not in {g["id"] for g in v["paymentGateways"]})
check("A mfs gateway lists its proof fields", (c, v), 200, pred=lambda v: next(g for g in v["paymentGateways"] if g["id"] == MFS)["proofFields"][0]["key"] == "transactionId")
check("A cod gateway needs no proof", (c, v), 200, pred=lambda v: next(g for g in v["paymentGateways"] if g["id"] == COD)["proofFields"] == [])
c, v = call("GET", f"{CK}/{cart_a}?countryCode=bd", session=G1)
check("A options with country: one price per delivery type (global default)", (c, v), 200, pred=lambda v: v["countryName"] == "Bangladesh" and [o["deliveryType"] for o in v["deliveryOptions"]] == ["standard", "express", "pickup"] and all(o["charge"] == 50 and o["estimatedDays"] == 7 for o in v["deliveryOptions"]))
check("A payable includes delivery", (c, v), 200, pred=lambda v: v["deliveryOptions"][0]["payable"] == v["cart"]["totals"]["payableTotal"] + 50)
sql(f"insert into shipping_zone (name, charge, \"estimatedDays\", \"deliveryType\", \"countryCodes\") values ('T Order Zone', 120, 3, 'express', '[\"BD\"]')")
c, v = call("GET", f"{CK}/{cart_a}?countryCode=BD", session=G1)
check("A zone price beats the default for its country and type", (c, v), 200, pred=lambda v: next(o for o in v["deliveryOptions"] if o["deliveryType"] == "express")["charge"] == 120 and next(o for o in v["deliveryOptions"] if o["deliveryType"] == "express")["zoneName"] == "T Order Zone" and next(o for o in v["deliveryOptions"] if o["deliveryType"] == "standard")["charge"] == 50)

# ================================================================= B place validation
PL = lambda cart, body, s=G1, token=None: call("POST", f"{CK}/{cart}/place", token=token, body=body, session=s)
check("B place without owner -> 400", PL(cart_a, payload(), s=None), 400)
check("B place someone else's cart -> 404", PL(cart_a, payload(), s=sess("zz")), 404)
check("B place unknown cart -> 404", PL(99999999, payload()), 404)
check("B empty body -> 400", PL(cart_a, {}), 400)
check("B unknown field -> 400", PL(cart_a, payload(total=1)), 400)
check("B price in body is not accepted -> 400", PL(cart_a, payload(deliveryCharge=0)), 400)
check("B name too short -> 400", PL(cart_a, payload(recipientName="A")), 400)
check("B name number -> 400", PL(cart_a, payload(recipientName=5)), 400)
check("B phone without country code -> 400", PL(cart_a, payload(recipientPhone="01712345678")), 400)
check("B phone invalid -> 400", PL(cart_a, payload(recipientPhone="+1")), 400)
check("B email invalid -> 400", PL(cart_a, payload(contactEmail="nope")), 400)
check("B country missing -> 400", PL(cart_a, payload(countryCode=None)), 400)
check("B country unknown -> 400", PL(cart_a, payload(countryCode="ZZ")), 400)
check("B country 3 letters -> 400", PL(cart_a, payload(countryCode="BGD")), 400)
check("B city missing -> 400", PL(cart_a, payload(city=None)), 400)
check("B city blank -> 400", PL(cart_a, payload(city="   ")), 400)
check("B address too short -> 400", PL(cart_a, payload(addressLine="abc")), 400)
check("B address too long -> 400", PL(cart_a, payload(addressLine="a" * 501)), 400)
check("B delivery type invalid -> 400", PL(cart_a, payload(deliveryType="drone")), 400)
check("B gateway missing -> 400", PL(cart_a, payload(gateway=None)), 400)
check("B gateway string -> 400", PL(cart_a, payload(gateway="2")), 400)
check("B gateway unknown -> 400", PL(cart_a, payload(gateway=99999999)), 400)
check("B gateway inactive -> 400", PL(cart_a, payload(gateway=OFF)), 400)
check("B note too long -> 400", PL(cart_a, payload(note="n" * 1001)), 400)
check("B proof not an object -> 400", PL(cart_a, payload(paymentProof="x")), 400)
check("B cod rejects proof fields -> 400", PL(cart_a, payload(paymentProof={"transactionId": "X"})), 400)
check("B mfs without proof -> 400", PL(cart_a, payload(gateway=MFS)), 400)
check("B mfs blank proof -> 400", PL(cart_a, payload(gateway=MFS, paymentProof={"transactionId": "  "})), 400)
check("B mfs proof wrong type -> 400", PL(cart_a, payload(gateway=MFS, paymentProof={"transactionId": 5})), 400)
check("B mfs proof too long -> 400", PL(cart_a, payload(gateway=MFS, paymentProof={"transactionId": "x" * 201})), 400)
check("B mfs unknown proof field -> 400", PL(cart_a, payload(gateway=MFS, paymentProof={"transactionId": "T1", "other": "x"})), 400)
check("B bank needs both proof fields -> 400", PL(cart_a, payload(gateway=BANK, paymentProof={"senderName": "A"})), 400)
check("B nothing was created by failed attempts", (200, sql(f"select count(*) from \"order\" where \"recipientName\" like 'T Order %'")), 200, pred=lambda v: v == "0")
check("B ...and the cart is still active", (200, sql(f"select \"isActive\" from cart where id={cart_a}")), 200, pred=lambda v: v == "t")
check("B ...and stock untouched", (200, stock(S_HOMER_M)), 200, pred=lambda v: v == 6)

# ================================================================= C place as guest, COD
before = stock(S_HOMER_M)
cart_c = add(sess("c"), qty=2)
c, o = PL(cart_c, payload(note="Ring the bell", state="Dhaka Division", postalCode="1207", contactEmail="buyer@example.com"), s=sess("c"))
check("C place -> 201", (c, o), 201)
check("C order number format", (c, o), 201, pred=lambda v: re.fullmatch(r"PN\d{6}-[A-HJ-NP-Z2-9]{6}", v["orderNumber"]))
check("C starts pending with payment due", (c, o), 201, pred=lambda v: v["status"] == "pending" and v["paymentStatus"] == "due")
check("C seller is the cart's seller", (c, o), 201, pred=lambda v: v["seller"]["id"] == 5)
check("C item priced live: 2 x 3200", (c, o), 201, pred=lambda v: v["items"][0]["quantity"] == 2 and v["items"][0]["unitPayable"] == 3200 and v["items"][0]["unitPrice"] == 3500 and v["items"][0]["lineTotal"] == 6400)
check("C totals: list, subtotal, delivery, payable", (c, o), 201, pred=lambda v: v["totals"] == {"listTotal": 7000, "subtotal": 6400, "savings": 600, "deliveryCharge": 50, "discountAmount": 0, "payable": 6450, "amountPaid": 0, "balanceDue": 6450})
check("C delivery recorded", (c, o), 201, pred=lambda v: v["delivery"]["type"] == "standard" and v["delivery"]["estimatedDays"] == 7 and v["delivery"]["charge"] == 50)
check("C address recorded", (c, o), 201, pred=lambda v: v["address"] == {"recipientName": "T Order Buyer", "phone": "+8801712345678", "email": "buyer@example.com", "line": "House 1, Road 2", "city": "Dhaka", "state": "Dhaka Division", "postalCode": "1207", "countryCode": "BD", "countryName": "Bangladesh"})
check("C note kept", (c, o), 201, pred=lambda v: v["note"] == "Ring the bell")
check("C payment row carries gateway id, name, slug", (c, o), 201, pred=lambda v: len(v["payments"]) == 1 and v["payments"][0]["gateway"] == {"id": COD, "name": "Cash on Delivery", "slug": "cash-on-delivery"} and v["payments"][0]["status"] == "due" and v["payments"][0]["amount"] == 6450)
check("C history starts with 'pending' by the buyer", (c, o), 201, pred=lambda v: len(v["statusHistory"]) == 1 and v["statusHistory"][0]["status"] == "pending" and v["statusHistory"][0]["fromStatus"] is None and v["statusHistory"][0]["by"] == {"name": "T Order Buyer", "type": "user"})
check("C buyer can cancel while pending", (c, o), 201, pred=lambda v: v["canCancel"] is True)
OID_C = o["id"]
check("C stock decreased by the quantity", (200, stock(S_HOMER_M)), 200, pred=lambda v: v == before - 2)
check("C order row stores cartId and gateway fields", (200, sql(f"select \"cartId\"||'|'||\"paymentGatewayName\"||'|'||\"paymentGatewaySlug\"||'|'||coalesce(\"userId\"::text,'guest')||'|'||\"guestSessionId\" from \"order\" where id={OID_C}")), 200, pred=lambda v: v == f"{cart_c}|Cash on Delivery|cash-on-delivery|guest|{sess('c')}")
check("C cart is inactive and points at the order", (200, sql(f"select \"isActive\"||'|'||\"orderId\" from cart where id={cart_c}")), 200, pred=lambda v: v == f"false|{OID_C}")
check("C cart no longer in the active list", call("GET", CART, session=sess("c")), 200, pred=lambda v: v["carts"] == [])
check("C placing the same cart again -> 409", PL(cart_c, payload(), s=sess("c")), 409, pred=lambda v: "already been ordered" in v["message"])
check("C ...no second order", (200, sql(f"select count(*) from \"order\" where \"cartId\"={cart_c}")), 200, pred=lambda v: v == "1")
check("C options for an ordered cart -> 404", call("GET", f"{CK}/{cart_c}", session=sess("c")), 404)
cart_c2 = add(sess("c"))
check("C a new add after ordering starts a fresh cart", (200, cart_c2), 200, pred=lambda v: v != cart_c)
check("C two carts now exist for the session, one active", (200, sql(f"select count(*)||'/'||count(*) filter (where \"isActive\") from cart where id in ({cart_c},{cart_c2})")), 200, pred=lambda v: v == "2/1")

# ================================================================= D customer, zone price, MFS proof
tok, uid, phone = register(1)
cart_d = add(token=tok, product=P_SPRINT, qty=3)
c, o = PL(cart_d, payload(gateway=MFS, deliveryType="express", paymentProof={"transactionId": "TX-100"}), s=None, token=tok)
check("D place as customer -> 201", (c, o), 201)
check("D zone charge and days used", (c, o), 201, pred=lambda v: v["delivery"]["charge"] == 120 and v["delivery"]["estimatedDays"] == 3 and v["delivery"]["zoneName"] == "T Order Zone" and v["totals"]["payable"] == 9000 + 120)
check("D seller 6, unit 3000 x 3", (c, o), 201, pred=lambda v: v["seller"]["id"] == 6 and v["items"][0]["lineTotal"] == 9000)
check("D proof stored on the payment", (c, o), 201, pred=lambda v: v["payments"][0]["transactionId"] == "TX-100" and v["payments"][0]["proof"] == {"transactionId": "TX-100"} and v["payments"][0]["gateway"]["slug"] == f"t-order-mfs-{RUN}")
check("D customer history by name", (c, o), 201, pred=lambda v: v["statusHistory"][0]["by"] == {"name": "T Order 1", "type": "user"})
check("D email taken from the account", (c, o), 201, pred=lambda v: v["address"]["email"] == f"t-order-{RUN}-1@example.com")
check("D order belongs to the account", (200, sql(f"select \"userId\"||'|'||coalesce(\"guestSessionId\",'-') from \"order\" where id={o['id']}")), 200, pred=lambda v: v == f"{uid}|-")
check("D stock took 3", (200, stock(S_SPRINT_M)), 200, pred=lambda v: v == 5)
check("D payment row has the user", (200, sql(f"select \"userId\" from payment where \"orderId\"={o['id']}")), 200, pred=lambda v: v == str(uid))
OID_D = o["id"]
c, o = call("POST", f"{CK}/{add(token=tok, product=P_SPRINT)}/place", token=tok, body=payload(gateway=BANK, paymentProof={"senderName": "Buyer", "transactionReference": "REF9"}))
check("D bank order with two proof fields", (c, o), 201, pred=lambda v: v["payments"][0]["transactionId"] == "REF9" and v["payments"][0]["proof"] == {"senderName": "Buyer", "transactionReference": "REF9"})
OID_D2 = o["id"]

# ================================================================= E stock is re-checked at order time
cart_e = add(sess("e"), product=P_SPRINT, qty=4)
sql(f"update seller_product_sku set quantity=2 where id={S_SPRINT_M}")
c, e = PL(cart_e, payload(), s=sess("e"))
check("E not enough stock -> 409 with issues", (c, e), 409, pred=lambda v: len(v["issues"]) == 1 and "Only 2" in v["issues"][0])
check("E nothing taken", (200, stock(S_SPRINT_M)), 200, pred=lambda v: v == 2)
check("E cart stays active", (200, sql(f"select \"isActive\" from cart where id={cart_e}")), 200, pred=lambda v: v == "t")
sql(f"update seller_product_sku set quantity=0 where id={S_SPRINT_M}")
check("E out of stock -> 409", PL(cart_e, payload(), s=sess("e")), 409)
sql(f"update seller_product_sku set quantity=8, \"isActive\"=false where id={S_SPRINT_M}")
check("E inactive sku -> 409", PL(cart_e, payload(), s=sess("e")), 409)
sql(f"update seller_product_sku set \"isActive\"=true where id={S_SPRINT_M}")
sql("update seller set \"activeStatus\"='inactive' where id=6")
check("E seller switched off -> 409", PL(cart_e, payload(), s=sess("e")), 409)
sql("update seller set \"activeStatus\"='active' where id=6")
sql(f"update seller_product_sku set quantity=8 where id={S_SPRINT_M}")
sql(f"update seller_product_sku set price=2500 where id={S_SPRINT_M}")
c, e = PL(cart_e, payload(), s=sess("e"))
check("E live price used, not the price when added", (c, e), 201, pred=lambda v: v["items"][0]["unitPayable"] == 2500 and v["totals"]["subtotal"] == 10000)
sql(f"update seller_product_sku set price=3000 where id={S_SPRINT_M}")
OID_E = e["id"]

# race: two guests, one unit left
sql(f"update seller_product_sku set quantity=1 where id={S_SPRINT_M}")
r1, r2 = add(sess("r1"), product=P_SPRINT), add(sess("r2"), product=P_SPRINT)
with cf.ThreadPoolExecutor(2) as ex:
    f1 = ex.submit(PL, r1, payload(), sess("r1"))
    f2 = ex.submit(PL, r2, payload(), sess("r2"))
    codes = sorted([f1.result()[0], f2.result()[0]])
check("E race for the last unit: one wins, one gets 409", (200, codes), 200, pred=lambda v: v == [201, 409])
check("E ...stock is exactly 0, never negative", (200, stock(S_SPRINT_M)), 200, pred=lambda v: v == 0)
sql(f"update seller_product_sku set quantity=8 where id={S_SPRINT_M}")

# double submit of one cart
dbl = add(sess("dbl"), product=P_SPRINT)
with cf.ThreadPoolExecutor(2) as ex:
    f1 = ex.submit(PL, dbl, payload(), sess("dbl"))
    f2 = ex.submit(PL, dbl, payload(), sess("dbl"))
    codes = sorted([f1.result()[0], f2.result()[0]])
check("E double submit of one cart: one order only", (200, codes), 200, pred=lambda v: v == [201, 409])
check("E ...one order row for that cart", (200, sql(f"select count(*) from \"order\" where \"cartId\"={dbl}")), 200, pred=lambda v: v == "1")

# ================================================================= F reading orders
L = lambda q="", s=None, token=None: call("GET", f"{OR}{q}", token=token, session=s)
check("F list without owner -> 400", L(), 400)
check("F bad token -> 401", L(token="garbage"), 401)
c, v = L(s=sess("c"))
check("F guest list: only own orders", (c, v), 200, pred=lambda v: v["total"] == 1 and v["results"][0]["id"] == OID_C and v["page"] == 1 and v["pageSize"] == 20 and v["totalPages"] == 1)
check("F list row shape", (c, v), 200, pred=lambda v: v["results"][0]["orderNumber"] and v["results"][0]["itemCount"] == 2 and v["results"][0]["payable"] == 6450 and v["results"][0]["previewItems"][0]["productName"] and v["results"][0]["canCancel"] is True and v["results"][0]["gateway"]["slug"] == "cash-on-delivery")
check("F another guest sees nothing", L(s=sess("nobody")), 200, pred=lambda v: v["total"] == 0)
c, v = L(token=tok)
check("F customer list has both orders newest first", (c, v), 200, pred=lambda v: [r["id"] for r in v["results"]] == [OID_D2, OID_D])
check("F customer does not see guest orders", (c, v), 200, pred=lambda v: OID_C not in [r["id"] for r in v["results"]])
check("F filter status", L("?status=pending", token=tok), 200, pred=lambda v: v["total"] == 2)
check("F filter status none", L("?status=shipped", token=tok), 200, pred=lambda v: v["total"] == 0)
check("F filter paymentStatus", L("?paymentStatus=due", token=tok), 200, pred=lambda v: v["total"] == 2)
check("F filter paymentStatus paid none", L("?paymentStatus=paid", token=tok), 200, pred=lambda v: v["total"] == 0)
check("F bad status -> 400", L("?status=processing", token=tok), 400)
check("F bad paymentStatus -> 400", L("?paymentStatus=pending", token=tok), 400)
num_d = call("GET", f"{OR}/{OID_D}", token=tok)[1]["orderNumber"]
check("F search by order number (case-insensitive part)", L(f"?search={num_d[-6:].lower()}", token=tok), 200, pred=lambda v: [r["id"] for r in v["results"]] == [OID_D])
check("F search no match", L("?search=ZZZZZZZZ", token=tok), 200, pred=lambda v: v["total"] == 0)
check("F page size", L("?pageSize=1", token=tok), 200, pred=lambda v: len(v["results"]) == 1 and v["totalPages"] == 2 and v["total"] == 2)
check("F page 2", L("?pageSize=1&page=2", token=tok), 200, pred=lambda v: [r["id"] for r in v["results"]] == [OID_D])
check("F pageSize 51 -> 400", L("?pageSize=51", token=tok), 400)
check("F page 0 -> 400", L("?page=0", token=tok), 400)
check("F unknown query -> 400", L("?foo=1", token=tok), 400)

check("F detail as owner", call("GET", f"{OR}/{OID_D}", token=tok), 200, pred=lambda v: v["id"] == OID_D and len(v["items"]) == 1 and v["cartId"] is not None and len(v["statusHistory"]) == 1)
check("F detail as guest owner", call("GET", f"{OR}/{OID_C}", session=sess("c")), 200)
check("F detail of someone else's -> 404", call("GET", f"{OR}/{OID_D}", session=sess("c")), 404)
check("F detail of guest order as another customer -> 404", call("GET", f"{OR}/{OID_C}", token=tok), 404)
check("F detail unknown -> 404", call("GET", f"{OR}/99999999", token=tok), 404)
check("F detail bad id -> 400", call("GET", f"{OR}/abc", token=tok), 400)
check("F detail without owner -> 400", call("GET", f"{OR}/{OID_C}"), 400)

num_c = call("GET", f"{OR}/{OID_C}", session=sess("c"))[1]["orderNumber"]
check("F track by number and phone (no session)", call("GET", f"{OR}/track?orderNumber={num_c.lower()}&phone=%2B8801712345678"), 200, pred=lambda v: v["id"] == OID_C)
check("F track wrong phone -> 404", call("GET", f"{OR}/track?orderNumber={num_c}&phone=%2B8801712345679"), 404)
check("F track unknown number -> 404", call("GET", f"{OR}/track?orderNumber=PN000000-AAAAAA&phone=%2B8801712345678"), 404)
check("F track needs phone -> 400", call("GET", f"{OR}/track?orderNumber={num_c}"), 400)
check("F track phone without + -> 400", call("GET", f"{OR}/track?orderNumber={num_c}&phone=8801712345678"), 400)

# ================================================================= G cancel
check("G cancel without owner -> 400", call("POST", f"{OR}/{OID_C}/cancel", body={}), 400)
check("G cancel someone else's -> 404", call("POST", f"{OR}/{OID_D}/cancel", body={}, session=sess("c")), 404)
check("G cancel unknown -> 404", call("POST", f"{OR}/99999999/cancel", body={}, token=tok), 404)
check("G cancel unknown field -> 400", call("POST", f"{OR}/{OID_C}/cancel", body={"status": "x"}, session=sess("c")), 400)
check("G cancel reason too long -> 400", call("POST", f"{OR}/{OID_C}/cancel", body={"reason": "r" * 501}, session=sess("c")), 400)
before = stock(S_HOMER_M)
c, v = call("POST", f"{OR}/{OID_C}/cancel", body={"reason": "Changed my mind"}, session=sess("c"))
check("G guest cancels a pending order", (c, v), [200, 201], pred=lambda v: v["status"] == "cancelled" and v["canCancel"] is False)
check("G history gets the cancel with the reason and who", (c, v), [200, 201], pred=lambda v: v["statusHistory"][-1]["fromStatus"] == "pending" and v["statusHistory"][-1]["status"] == "cancelled" and v["statusHistory"][-1]["note"] == "Changed my mind" and v["statusHistory"][-1]["by"]["type"] == "user" and len(v["statusHistory"]) == 2)
check("G stock came back", (200, stock(S_HOMER_M)), 200, pred=lambda v: v == before + 2)
check("G cancelling again -> 403", call("POST", f"{OR}/{OID_C}/cancel", body={}, session=sess("c")), 403)
check("G ...stock not given back twice", (200, stock(S_HOMER_M)), 200, pred=lambda v: v == before + 2)
check("G the cart stays inactive with its link", (200, sql(f"select \"isActive\"||'|'||\"orderId\" from cart where id={cart_c}")), 200, pred=lambda v: v == f"false|{OID_C}")

before = stock(S_SPRINT_M)
sql(f"update \"order\" set status='confirmed' where id={OID_D}")
check("G customer cannot cancel a confirmed order -> 403", call("POST", f"{OR}/{OID_D}/cancel", body={}, token=tok), 403)
check("G ...stock unchanged", (200, stock(S_SPRINT_M)), 200, pred=lambda v: v == before)
check("G ...and the list says it cannot be cancelled", L(token=tok), 200, pred=lambda v: next(r for r in v["results"] if r["id"] == OID_D)["canCancel"] is False)
c, v = call("POST", f"{OR}/{OID_D2}/cancel", body={}, token=tok)
check("G customer cancels with the default note", (c, v), [200, 201], pred=lambda v: v["statusHistory"][-1]["note"] == "Cancelled by the customer" and v["statusHistory"][-1]["by"]["name"] == "T Order 1")
check("G customer filter by cancelled", L("?status=cancelled", token=tok), 200, pred=lambda v: [r["id"] for r in v["results"]] == [OID_D2])
sql(f"update \"order\" set status='shipped' where id={OID_D}")
check("G shipped order cannot be cancelled -> 403", call("POST", f"{OR}/{OID_D}/cancel", body={}, token=tok), 403)

# ================================================================= H guest account merge claims orders
tok2, uid2, _ = register(2)
check("H merge keeps working", call("POST", CART + "/merge", token=tok2, body={"sessionId": sess("c")}), [200, 201])
check("H guest orders now belong to the account", L(token=tok2), 200, pred=lambda v: OID_C in [r["id"] for r in v["results"]])
check("H ...and left the session", L(s=sess("c")), 200, pred=lambda v: v["total"] == 0)
check("H order row moved", (200, sql(f"select \"userId\"||'|'||coalesce(\"guestSessionId\",'-') from \"order\" where id={OID_C}")), 200, pred=lambda v: v == f"{uid2}|-")

# ================================================================= I data integrity
check("I every order has one payment and a history", (200, sql("select count(*) from \"order\" o where o.\"recipientName\" like 'T Order %' and (select count(*) from payment p where p.\"orderId\"=o.id)<>1")), 200, pred=lambda v: v == "0")
check("I payable = subtotal + delivery - discount on every order", (200, sql("select count(*) from \"order\" where \"recipientName\" like 'T Order %' and \"payableAmount\" <> subtotal + \"deliveryCharge\" - \"discountAmount\"")), 200, pred=lambda v: v == "0")
check("I subtotal = sum of lines", (200, sql("select count(*) from \"order\" o where o.\"recipientName\" like 'T Order %' and o.subtotal <> (select sum(\"totalDiscountedPrice\") from order_item i where i.\"orderId\"=o.id)")), 200, pred=lambda v: v == "0")
check("I every ordered cart is inactive and linked both ways", (200, sql("select count(*) from \"order\" o join cart c on c.id=o.\"cartId\" where o.\"recipientName\" like 'T Order %' and (c.\"isActive\" or c.\"orderId\" is distinct from o.id)")), 200, pred=lambda v: v == "0")
check("I no negative stock anywhere", (200, sql("select count(*) from seller_product_sku where quantity < 0")), 200, pred=lambda v: v == "0")

# ================================================================= summary
cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
