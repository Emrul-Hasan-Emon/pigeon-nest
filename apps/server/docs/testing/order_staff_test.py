#!/usr/bin/env python3
"""Black-box tests: admin and seller order lists, details, status changes and order entry."""
import concurrent.futures as cf, json, os, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
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
    ids = "select id from \"order\" where \"recipientName\" like 'T Staff %'"
    sql(f"delete from order_update where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql("delete from \"order\" where \"recipientName\" like 'T Staff %'")
    sql(f"delete from cart where \"sessionId\" like 'tstaff{RUN}%'")
    sql(f"delete from \"user\" where email like 't-staff-{RUN}-%'")
    # Give the borrowed products back BEFORE deleting the test sellers: deleting a
    # seller cascades to its products.
    restore()
    sql("delete from seller where name like 'T Staff %'")
    sql("delete from payment_gateway where slug like 't-staff-%'")


cleanup()
restore()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
ADMIN_NAME = sql(f"select name from admin_user where email='{ADMIN_EMAIL}'")


def make_seller(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"T Staff Seller {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = int(sql(f"select id from seller where name='T Staff Seller {tag}'"))
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


S1, SID1 = make_seller("111")
S2, SID2 = make_seller("222")
sql(f"update seller_product set \"sellerId\"={SID1} where id=94")
sql(f"update seller_product set \"sellerId\"={SID2} where id=95")


def make_user(n, phone_tail):
    c, d = call("POST", "/user/auth/register", body={"name": f"T Staff User {n}", "phone": f"+88017{RUN_NUM}{phone_tail}", "password": "Passw0rd!x", "email": f"t-staff-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


UT1, UID1 = make_user(1, "401")
UT2, UID2 = make_user(2, "402")
sql(f"update \"user\" set status='suspended' where id={UID2}")
COD = int(sql("select id from payment_gateway where slug='cash-on-delivery'"))
MFS = int(sql(f"insert into payment_gateway (name, slug, type, \"accountNumber\", \"isActive\") values ('T Staff MFS','t-staff-mfs-{RUN}','mfs','017',true) returning id").splitlines()[0])
OFF = int(sql(f"insert into payment_gateway (name, slug, type, \"isActive\") values ('T Staff Off','t-staff-off-{RUN}','cod',false) returning id").splitlines()[0])
sql("update system_setting set value='40' where key='shipping.defaultCharge'")


def stock(sku):
    return int(sql(f"select quantity from seller_product_sku where id={sku}"))


def addr(**over):
    p = {"recipientName": "T Staff Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
         "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": COD}
    p.update(over)
    return {k: v for k, v in p.items() if v is not None}


def order_body(sku=119, product=94, qty=1, **over):
    return addr(items=[{"sellerProductId": product, "sellerProductSkuId": sku, "quantity": qty}], **over)


A, SL = "/admin/orders", "/seller/orders"


def admin_order(**over):
    c, o = call("POST", A, ADMIN, order_body(sellerId=SID1, **over))
    assert c == 201, o
    return o["id"]


# ================================================================= A access
check("A admin list no token -> 401", call("GET", A), 401)
check("A admin list customer token -> 403", call("GET", A, UT1), 403)
check("A admin list seller token -> 403", call("GET", A, S1), 403)
check("A seller list admin token -> 403", call("GET", SL, ADMIN), 403)
check("A seller list customer token -> 403", call("GET", SL, UT1), 403)
check("A admin create seller token -> 403", call("POST", A, S1, order_body(sellerId=SID1)), 403)
check("A seller create admin token -> 403", call("POST", SL, ADMIN, order_body()), 403)
check("A status change customer token -> 403", call("PATCH", f"{A}/1/status", UT1, {"status": "confirmed"}), 403)
check("A seller catalog admin token -> 403", call("GET", SL + "/catalog", ADMIN), 403)

# ================================================================= B customer search
check("B search by email", call("GET", f"{A}/customers?q=t-staff-{RUN}-1@example.com", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [UID1] and v["results"][0]["canOrder"] is True and v["results"][0]["name"] == "T Staff User 1")
check("B email is case-insensitive", call("GET", f"{A}/customers?q=T-STAFF-{RUN}-1@EXAMPLE.COM", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [UID1])
check("B part of an email does not match", call("GET", f"{A}/customers?q=t-staff-{RUN}-1@example", ADMIN), 200, pred=lambda v: v["results"] == [])
check("B search by mobile with +", call("GET", f"{A}/customers?q=%2B88017{RUN_NUM}401", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [UID1])
check("B search by local mobile format", call("GET", f"{A}/customers?q=017{RUN_NUM}401", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [UID1])
check("B search by mobile with spaces", call("GET", f"{A}/customers?q=%2B88%20017%20{RUN_NUM}%20401", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [UID1])
check("B suspended customer is found but cannot order", call("GET", f"{A}/customers?q=t-staff-{RUN}-2@example.com", ADMIN), 200, pred=lambda v: v["results"][0]["canOrder"] is False)
check("B no match -> empty list", call("GET", f"{A}/customers?q=nobody@nowhere.test", ADMIN), 200, pred=lambda v: v["results"] == [])
check("B too short -> 400", call("GET", f"{A}/customers?q=ab", ADMIN), 400)
check("B few digits -> 400", call("GET", f"{A}/customers?q=12345a", ADMIN), 400)
check("B missing q -> 400", call("GET", f"{A}/customers", ADMIN), 400)
check("B a seller can search too", call("GET", f"{SL}/customers?q=t-staff-{RUN}-1@example.com", S1), 200, pred=lambda v: [r["id"] for r in v["results"]] == [UID1])
check("B search does not expose the password", call("GET", f"{A}/customers?q=t-staff-{RUN}-1@example.com", ADMIN), 200, pred=lambda v: "passwordHash" not in json.dumps(v))

# ================================================================= B2 a customer's saved addresses while entering an order
SA = lambda uid: f"{SL}/customers/{uid}/addresses"
addr_body = lambda **o: {**{"recipientName": "T Staff Home", "phone": "+8801712345678", "countryCode": "BD", "city": "Dhaka", "address": "House 1, Road 2, Dhanmondi"}, **o}
check("B2 no token -> 401", call("GET", SA(UID1)), 401)
check("B2 admin token on the seller route -> 403", call("GET", SA(UID1), ADMIN), 403)
check("B2 customer token -> 403", call("GET", SA(UID1), UT1), 403)
check("B2 a customer with none: empty list", call("GET", SA(UID1), S1), 200, pred=lambda v: v["results"] == [])
check("B2 unknown customer -> 404", call("GET", SA(99999999), S1), 404)
check("B2 bad id -> 400", call("GET", f"{SL}/customers/abc/addresses", S1), 400)
check("B2 save: validation applies", call("POST", SA(UID1), S1, addr_body(countryCode="ZZ")), 400)
check("B2 save: unknown field -> 400", call("POST", SA(UID1), S1, addr_body(userId=3)), 400)
check("B2 save: unknown customer -> 404", call("POST", SA(99999999), S1, addr_body()), 404)
check("B2 save: suspended customer -> 400", call("POST", SA(UID2), S1, addr_body()), 400, pred=lambda v: "suspended" in v["message"])
c, sa1 = call("POST", SA(UID1), S1, addr_body())
check("B2 a seller saves an address to the customer's book", (c, sa1), 201, pred=lambda v: v["userId"] == UID1 and v["isDefault"] is True and v["countryName"] == "Bangladesh")
check("B2 recorded as created by the seller", (200, sql(f"select \"creatorType\"||'|'||\"creatorName\" from address where id={sa1['id']}")), 200, pred=lambda v: v == "seller|T Staff Seller 111")
c, sa2 = call("POST", SA(UID1), S1, addr_body(recipientName="T Staff Office", countryCode="US", city="Austin", address="500 Congress Ave, Suite 4", phone="+14155550123"))
check("B2 the second is not the default", (c, sa2), 201, pred=lambda v: v["isDefault"] is False)
check("B2 the seller reads the list, default first", call("GET", SA(UID1), S1), 200, pred=lambda v: [r["id"] for r in v["results"]] == [sa1["id"], sa2["id"]])
check("B2 the customer sees them in their own address book", call("GET", "/user/addresses", UT1), 200, pred=lambda v: {r["id"] for r in v["results"]} == {sa1["id"], sa2["id"]})
check("B2 the other seller can use the same customer lookup", call("GET", SA(UID1), S2), 200, pred=lambda v: len(v["results"]) == 2)
check("B2 admin lists them through the admin route too", call("GET", f"/admin/users/{UID1}/addresses", ADMIN), 200, pred=lambda v: len(v["results"]) == 2)
sql(f"delete from address where \"userId\"={UID1}")

# ================================================================= C catalog and options
check("C admin catalog needs a seller -> 400", call("GET", A + "/catalog", ADMIN), 400)
check("C unknown seller -> 400", call("GET", A + "/catalog?sellerId=99999999", ADMIN), 400)
c, v = call("GET", f"{A}/catalog?sellerId={SID1}", ADMIN)
check("C catalog lists the seller's products with variants", (c, v), 200, pred=lambda v: [p["id"] for p in v["results"]] == [94] and [k["id"] for k in v["results"][0]["skus"]] == [119, 120, 121])
check("C variants carry live price, payable and stock", (c, v), 200, pred=lambda v: v["results"][0]["skus"][0]["price"] == 3500 and v["results"][0]["skus"][0]["payable"] == 3200 and v["results"][0]["skus"][0]["quantity"] == 6 and v["results"][0]["skus"][0]["label"])
check("C catalog search", call("GET", f"{A}/catalog?sellerId={SID1}&search=zzzzzz", ADMIN), 200, pred=lambda v: v["results"] == [])
check("C catalog sellerId bad -> 400", call("GET", f"{A}/catalog?sellerId=abc", ADMIN), 400)
check("C seller catalog is their own", call("GET", SL + "/catalog", S1), 200, pred=lambda v: [p["id"] for p in v["results"]] == [94])
check("C seller cannot read another seller's catalog", call("GET", f"{SL}/catalog?sellerId={SID2}", S1), 200, pred=lambda v: [p["id"] for p in v["results"]] == [94])
sql("update seller_product_sku set \"isActive\"=false where id=121")
check("C an inactive variant is hidden", call("GET", f"{A}/catalog?sellerId={SID1}", ADMIN), 200, pred=lambda v: [k["id"] for k in v["results"][0]["skus"]] == [119, 120])
sql("update seller_product_sku set \"isActive\"=true where id=121")
sql("update seller_product set \"activeStatus\"='inactive' where id=94")
check("C an inactive product is hidden", call("GET", f"{A}/catalog?sellerId={SID1}", ADMIN), 200, pred=lambda v: v["results"] == [])
sql("update seller_product set \"activeStatus\"='active' where id=94")
sql(f"update seller set \"activeStatus\"='inactive' where id={SID2}")
check("C an inactive seller -> 400", call("GET", f"{A}/catalog?sellerId={SID2}", ADMIN), 400)
sql(f"update seller set \"activeStatus\"='active' where id={SID2}")
check("C options with country", call("GET", f"{A}/options?countryCode=bd&subtotal=1000", ADMIN), 200, pred=lambda v: [o["deliveryType"] for o in v["deliveryOptions"]] == ["standard", "express", "pickup"] and v["deliveryOptions"][0]["charge"] == 40 and v["deliveryOptions"][0]["payable"] == 1040 and OFF not in [g["id"] for g in v["paymentGateways"]] and MFS in [g["id"] for g in v["paymentGateways"]])
check("C options without country", call("GET", f"{SL}/options", S1), 200, pred=lambda v: v["deliveryOptions"] == [] and v["paymentGateways"])
check("C options bad country -> 400", call("GET", f"{A}/options?countryCode=BGD", ADMIN), 400)

# ================================================================= D create validation
before = (stock(119), stock(120))
P = lambda body, token=ADMIN, path=A: call("POST", path, token, body)
check("D empty body -> 400", P({}), 400)
check("D no items -> 400", P(addr(sellerId=SID1)), 400)
check("D items empty -> 400", P(addr(sellerId=SID1, items=[])), 400)
check("D items not an array -> 400", P(addr(sellerId=SID1, items="x")), 400)
check("D admin without sellerId -> 400", P(order_body()), 400)
check("D unknown seller -> 400", P(order_body(sellerId=99999999)), 400)
check("D sellerId string -> 400", P(order_body(sellerId="1")), 400)
check("D quantity 0 -> 400", P(order_body(sellerId=SID1, qty=0)), 400)
check("D quantity 100 -> 400", P(order_body(sellerId=SID1, qty=100)), 400)
check("D quantity 1.5 -> 400", P(order_body(sellerId=SID1, qty=1.5)), 400)
check("D quantity above stock -> 400", P(order_body(sellerId=SID1, qty=7)), 400, pred=lambda v: "Only 6" in v["message"])
check("D price in an item is not accepted -> 400", P(addr(sellerId=SID1, items=[{"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 1, "price": 1}])), 400)
check("D sku missing -> 400", P(addr(sellerId=SID1, items=[{"sellerProductId": 94, "quantity": 1}])), 400)
check("D duplicate variant -> 400", P(addr(sellerId=SID1, items=[{"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 1}] * 2)), 400)
check("D 51 items -> 400", P(addr(sellerId=SID1, items=[{"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 1}] * 51)), 400)
check("D variant of another product -> 400", P(addr(sellerId=SID1, items=[{"sellerProductId": 94, "sellerProductSkuId": 122, "quantity": 1}])), 400)
check("D product of another seller -> 400", P(order_body(sellerId=SID1, product=95, sku=122)), 400)
check("D unknown variant -> 400", P(order_body(sellerId=SID1, sku=99999999)), 400)
sql("update seller_product_sku set \"isActive\"=false where id=119")
check("D inactive variant -> 400", P(order_body(sellerId=SID1)), 400)
sql("update seller_product_sku set \"isActive\"=true where id=119")
sql("update seller_product set \"activeStatus\"='inactive' where id=94")
check("D inactive product -> 400", P(order_body(sellerId=SID1)), 400)
sql("update seller_product set \"activeStatus\"='active' where id=94")
check("D unknown customer -> 400", P(order_body(sellerId=SID1, userId=99999999)), 400)
check("D suspended customer -> 400", P(order_body(sellerId=SID1, userId=UID2)), 400, pred=lambda v: "suspended" in v["message"])
check("D userId string -> 400", P(order_body(sellerId=SID1, userId="1")), 400)
check("D bad phone -> 400", P(order_body(sellerId=SID1, recipientPhone="0171")), 400)
check("D bad country -> 400", P(order_body(sellerId=SID1, countryCode="ZZ")), 400)
check("D missing city -> 400", P(order_body(sellerId=SID1, city=None)), 400)
check("D address too short -> 400", P(order_body(sellerId=SID1, addressLine="x")), 400)
check("D bad delivery type -> 400", P(order_body(sellerId=SID1, deliveryType="drone")), 400)
check("D inactive gateway -> 400", P(order_body(sellerId=SID1, paymentGatewayId=OFF)), 400)
check("D unknown gateway -> 400", P(order_body(sellerId=SID1, paymentGatewayId=99999999)), 400)
check("D proof field the gateway does not take -> 400", P(order_body(sellerId=SID1, paymentProof={"x": "y"})), 400)
check("D unknown field -> 400", P(order_body(sellerId=SID1, total=1)), 400)
check("D seller naming another seller -> 403", P(order_body(sellerId=SID2), S1, SL), 403)
check("D seller order with another seller's product -> 400", P(order_body(product=95, sku=122), S1, SL), 400)
check("D failed attempts took no stock and made no order", (200, f"{before == (stock(119), stock(120))}|" + sql("select count(*) from \"order\" where \"recipientName\" like 'T Staff %'")), 200, pred=lambda v: v == "True|0")

# ================================================================= E create success
b119 = stock(119)
c, o = call("POST", A, ADMIN, order_body(sellerId=SID1, qty=2, userId=UID1, note="Phone order", state="Dhaka"))
check("E admin creates an order for a customer", (c, o), 201)
O1 = o["id"]
check("E starts pending with payment due", (c, o), 201, pred=lambda v: v["status"] == "pending" and v["paymentStatus"] == "due")
check("E priced live: 2 x 3200 + 40 delivery", (c, o), 201, pred=lambda v: v["totals"]["subtotal"] == 6400 and v["totals"]["deliveryCharge"] == 40 and v["totals"]["payable"] == 6440 and v["items"][0]["unitPrice"] == 3500)
check("E belongs to the customer account", (c, o), 201, pred=lambda v: v["customer"]["userId"] == UID1 and v["account"]["id"] == UID1 and v["account"]["email"] == f"t-staff-{RUN}-1@example.com")
check("E email defaults from the account", (c, o), 201, pred=lambda v: v["address"]["email"] == f"t-staff-{RUN}-1@example.com")
check("E no cart behind it", (c, o), 201, pred=lambda v: v["cartId"] is None)
check("E history says the admin placed it", (c, o), 201, pred=lambda v: v["statusHistory"][0]["by"] == {"name": ADMIN_NAME, "type": "admin"} and v["statusHistory"][0]["note"] == f"Order placed by admin {ADMIN_NAME}")
check("E payment row and history exist", (c, o), 201, pred=lambda v: len(v["payments"]) == 1 and v["payments"][0]["status"] == "due" and v["paymentHistory"][0]["note"].startswith("Order placed by admin"))
check("E stock taken", (200, stock(119)), 200, pred=lambda v: v == b119 - 2)
check("E the customer sees it", call("GET", f"/user/orders/{O1}", UT1), 200, pred=lambda v: v["orderNumber"] == o["orderNumber"] and v["statusHistory"][0]["by"]["type"] == "admin")
check("E and in their list", call("GET", "/user/orders", UT1), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O1])
check("E the customer can cancel it while pending", call("GET", f"/user/orders/{O1}", UT1), 200, pred=lambda v: v["canCancel"] is True)

c, o = call("POST", SL, S1, order_body(sku=120, qty=1, userId=UID1, paymentGatewayId=MFS, deliveryType="express"))
check("E seller creates an order for their own shop", (c, o), 201, pred=lambda v: v["seller"]["id"] == SID1 and v["statusHistory"][0]["by"] == {"name": "T Staff Seller 111", "type": "seller"})
O2 = o["id"]
check("E seller order: mfs gateway without proof is allowed for staff", (c, o), 201, pred=lambda v: v["payments"][0]["gateway"]["slug"] == f"t-staff-mfs-{RUN}" and v["delivery"]["type"] == "express")

c, o = call("POST", SL, S1, order_body(qty=1, recipientName="T Staff Walkin", contactEmail="walkin@example.com"))
check("E walk-in customer: no account", (c, o), 201, pred=lambda v: v["customer"]["isGuest"] is True and v["account"] is None and v["address"]["email"] == "walkin@example.com"
      and "Walkin" in v["address"]["recipientName"])
O3 = o["id"]
check("E walk-in can track by number and phone", call("GET", f"/user/orders/track?orderNumber={o['orderNumber']}&phone=%2B8801712345678"), 200, pred=lambda v: v["id"] == O3)

c, o = call("POST", A, ADMIN, order_body(sellerId=SID2, product=95, sku=122, qty=3, userId=UID1))
O4 = o["id"]
check("E admin creates for another seller (seller 2)", (c, o), 201, pred=lambda v: v["seller"]["id"] == SID2)

# ================================================================= F lists
c, v = call("GET", f"{A}?limit=100", ADMIN)
mine = {r["id"]: r for r in v["results"] if r["id"] in (O1, O2, O3, O4)}
check("F admin list holds all four orders, newest first", (c, v), 200, pred=lambda v: set(mine) == {O1, O2, O3, O4} and [r["id"] for r in v["results"]] == sorted([r["id"] for r in v["results"]], reverse=True))
check("F row shape", (c, v), 200, pred=lambda v: all(k in mine[O1] for k in ["id", "orderNumber", "status", "paymentStatus", "seller", "customer", "itemCount", "payable", "gateway", "deliveryType", "countryCode", "allowedStatuses", "createdAt"]))
check("F filter status", call("GET", f"{A}?status=pending&limit=100", ADMIN), 200, pred=lambda v: all(r["status"] == "pending" for r in v["results"]) and {O1, O2, O3, O4} <= {r["id"] for r in v["results"]})
check("F filter status confirmed finds none of ours", call("GET", f"{A}?status=confirmed&limit=100", ADMIN), 200, pred=lambda v: not ({O1, O2, O3, O4} & {r["id"] for r in v["results"]}))
check("F bad status -> 400", call("GET", f"{A}?status=processing", ADMIN), 400)
check("F filter paymentStatus", call("GET", f"{A}?paymentStatus=due&limit=100", ADMIN), 200, pred=lambda v: all(r["paymentStatus"] == "due" for r in v["results"]))
check("F bad paymentStatus -> 400", call("GET", f"{A}?paymentStatus=pending", ADMIN), 400)
check("F filter sellerId", call("GET", f"{A}?sellerId={SID2}&limit=100", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O4])
check("F filter sellerSearch", call("GET", f"{A}?sellerSearch=T%20Staff%20Seller%20222&limit=100", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O4])
check("F filter userId", call("GET", f"{A}?userId={UID1}&limit=100", ADMIN), 200, pred=lambda v: {r["id"] for r in v["results"]} == {O1, O2, O4})
check("F filter owner=guest", call("GET", f"{A}?owner=guest&limit=100", ADMIN), 200, pred=lambda v: O3 in {r["id"] for r in v["results"]} and all(r["customer"]["isGuest"] for r in v["results"]))
check("F filter owner=customer", call("GET", f"{A}?owner=customer&limit=100", ADMIN), 200, pred=lambda v: O3 not in {r["id"] for r in v["results"]} and all(not r["customer"]["isGuest"] for r in v["results"]))
check("F bad owner -> 400", call("GET", f"{A}?owner=robot", ADMIN), 400)
check("F customerSearch by recipient name", call("GET", f"{A}?customerSearch=T%20Staff%20Walkin", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O3])
check("F customerSearch by account email", call("GET", f"{A}?customerSearch=t-staff-{RUN}-1@", ADMIN), 200, pred=lambda v: {r["id"] for r in v["results"]} == {O1, O2, O4})
check("F customerSearch by account phone", call("GET", f"{A}?customerSearch=401&limit=100", ADMIN), 200, pred=lambda v: {O1, O2, O4} <= {r["id"] for r in v["results"]})
check("F customerSearch by walk-in email", call("GET", f"{A}?customerSearch=walkin@example.com", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O3])
onum = mine[O1]["orderNumber"]
check("F filter orderNumber", call("GET", f"{A}?orderNumber={onum[-6:].lower()}", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O1])
check("F filter gatewayId", call("GET", f"{A}?gatewayId={MFS}", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O2])
check("F filter deliveryType", call("GET", f"{A}?deliveryType=express&limit=100", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O2])
check("F bad deliveryType -> 400", call("GET", f"{A}?deliveryType=drone", ADMIN), 400)
check("F filter countryCode", call("GET", f"{A}?countryCode=bd&limit=100", ADMIN), 200, pred=lambda v: {O1, O2, O3, O4} <= {r["id"] for r in v["results"]})
check("F filter countryCode none", call("GET", f"{A}?countryCode=US&limit=100", ADMIN), 200, pred=lambda v: not ({O1, O2, O3, O4} & {r["id"] for r in v["results"]}))
check("F filter total range", call("GET", f"{A}?minTotal=6440&maxTotal=6440&limit=100", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O1])
check("F min above max -> 400", call("GET", f"{A}?minTotal=9&maxTotal=1", ADMIN), 400)
check("F created range", call("GET", f"{A}?createdFrom=2000-01-01&createdTo=2999-01-01&limit=100", ADMIN), 200, pred=lambda v: {O1, O2, O3, O4} <= {r["id"] for r in v["results"]})
check("F created range in the past", call("GET", f"{A}?createdFrom=2000-01-01&createdTo=2000-01-02&limit=100", ADMIN), 200, pred=lambda v: v["results"] == [])
check("F range wrong way -> 400", call("GET", f"{A}?createdFrom=2026-12-01&createdTo=2026-11-01", ADMIN), 400)
check("F bad date -> 400", call("GET", f"{A}?createdFrom=soon", ADMIN), 400)
seen, cursor = [], 0
for _ in range(80):
    c, v = call("GET", f"{A}?limit=3&cursor={cursor}", ADMIN)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("F cursor paging visits each order once", (200, seen), 200, pred=lambda v: len(v) == len(set(v)) == int(sql("select count(*) from \"order\" where \"deletedAt\" is null")))
c, v = call("GET", SL + "?limit=100", S1)
check("F seller sees only their own orders", (c, v), 200, pred=lambda v: {r["id"] for r in v["results"]} == {O1, O2, O3})
check("F seller cannot widen the list with sellerId", call("GET", f"{SL}?sellerId={SID2}&limit=100", S1), 200, pred=lambda v: O4 not in {r["id"] for r in v["results"]})
check("F seller filters work", call("GET", f"{SL}?owner=guest&limit=100", S1), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O3])
check("F the other seller sees theirs", call("GET", SL, S2), 200, pred=lambda v: [r["id"] for r in v["results"]] == [O4])

check("F admin detail", call("GET", f"{A}/{O1}", ADMIN), 200, pred=lambda v: v["id"] == O1 and len(v["items"]) == 1 and v["account"]["id"] == UID1 and v["allowedStatuses"] == ["confirmed", "cancelled", "packed", "shipped", "delivered"])
check("F seller detail lists only the seller's moves", call("GET", f"{SL}/{O1}", S1), 200, pred=lambda v: v["allowedStatuses"] == ["confirmed", "cancelled"])
check("F another seller's order -> 404", call("GET", f"{SL}/{O4}", S1), 404)
check("F unknown order -> 404", call("GET", f"{A}/99999999", ADMIN), 404)
check("F bad id -> 400", call("GET", f"{A}/abc", ADMIN), 400)

# ================================================================= G status changes
ST = lambda oid, status, token=ADMIN, base=A, note=None: call("PATCH", f"{base}/{oid}/status", token, {"status": status, **({"note": note} if note else {})})
check("G bad status -> 400", ST(O1, "processing"), 400)
check("G missing status -> 400", call("PATCH", f"{A}/{O1}/status", ADMIN, {}), 400)
check("G unknown field -> 400", call("PATCH", f"{A}/{O1}/status", ADMIN, {"status": "confirmed", "x": 1}), 400)
check("G note too long -> 400", ST(O1, "confirmed", note="n" * 501), 400)
check("G unknown order -> 404", ST(99999999, "confirmed"), 404)
check("G same status -> 403", ST(O1, "pending"), 403)
check("G seller cannot touch another seller's order -> 404", ST(O4, "confirmed", S1, SL), 404)
check("G seller cannot jump pending -> packed -> 403", ST(O2, "packed", S1, SL), 403)
check("G seller cannot jump pending -> delivered -> 403", ST(O2, "delivered", S1, SL), 403)

c, v = ST(O1, "confirmed", note="Checked by phone")
check("G admin confirms with a note", (c, v), 200, pred=lambda v: v["status"] == "confirmed" and v["statusHistory"][-1]["note"] == "Checked by phone" and v["statusHistory"][-1]["by"]["type"] == "admin" and v["statusHistory"][-1]["fromStatus"] == "pending")
check("G the customer can no longer cancel", call("POST", f"/user/orders/{O1}/cancel", UT1, {}), 403)
check("G seller cannot cancel a confirmed order -> 403", ST(O1, "cancelled", S1, SL), 403, pred=lambda v: "admin" in v["message"])
check("G seller cannot go back to pending -> 403", ST(O1, "pending", S1, SL), 403)
check("G seller cannot skip to shipped -> 403", ST(O1, "shipped", S1, SL), 403)
check("G seller packs", ST(O1, "packed", S1, SL), 200, pred=lambda v: v["status"] == "packed" and v["statusHistory"][-1]["by"] == {"name": "T Staff Seller 111", "type": "seller"} and v["allowedStatuses"] == ["shipped"])
check("G seller ships", ST(O1, "shipped", S1, SL), 200, pred=lambda v: v["status"] == "shipped")
check("G seller delivers", ST(O1, "delivered", S1, SL), 200, pred=lambda v: v["status"] == "delivered" and v["allowedStatuses"] == [])
check("G seller cannot cancel a delivered order -> 403", ST(O1, "cancelled", S1, SL), 403)
check("G the customer sees the whole path with who and when", call("GET", f"/user/orders/{O1}", UT1), 200, pred=lambda v: [h["status"] for h in v["statusHistory"]] == ["pending", "confirmed", "packed", "shipped", "delivered"] and all(h["createdAt"] and h["by"]["name"] for h in v["statusHistory"]) and v["statusHistory"][1]["by"]["type"] == "admin" and v["statusHistory"][2]["by"]["type"] == "seller")

b = stock(119)
check("G admin cancels a delivered order", ST(O1, "cancelled"), 200, pred=lambda v: v["status"] == "cancelled" and v["allowedStatuses"] == ["pending", "confirmed", "packed", "shipped", "delivered"])
check("G ...and the stock comes back", (200, stock(119)), 200, pred=lambda v: v == b + 2)
check("G a seller cannot reopen a cancelled order -> 403", ST(O1, "pending", S1, SL), 403, pred=lambda v: "reopen" in v["message"])
sql("update seller_product_sku set quantity=1 where id=119")
check("G reopening needs stock -> 409", ST(O1, "pending"), 409, pred=lambda v: "Not enough stock" in v["message"])
check("G ...and changes nothing", (200, sql(f"select status from \"order\" where id={O1}") + "|" + str(stock(119))), 200, pred=lambda v: v == "cancelled|1")
sql("update seller_product_sku set quantity=5 where id=119")
check("G admin reopens a cancelled order when stock allows", ST(O1, "confirmed"), 200, pred=lambda v: v["status"] == "confirmed")
check("G ...and takes the stock again", (200, stock(119)), 200, pred=lambda v: v == 3)
check("G admin moves backwards freely", ST(O1, "pending"), 200, pred=lambda v: v["status"] == "pending")
check("G history keeps every step", call("GET", f"{A}/{O1}", ADMIN), 200, pred=lambda v: [h["status"] for h in v["statusHistory"]] == ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "confirmed", "pending"])

check("G seller cancels a pending order", ST(O3, "cancelled", S1, SL), 200, pred=lambda v: v["status"] == "cancelled")
check("G ...stock back (walk-in order)", (200, stock(119)), 200, pred=lambda v: v == 4)
check("G seller confirms a pending order", ST(O2, "confirmed", S1, SL), 200, pred=lambda v: v["status"] == "confirmed")

# two people change one order at the same moment: one history entry per real change, stock right
b = stock(122)
with cf.ThreadPoolExecutor(2) as ex:
    f1 = ex.submit(ST, O4, "cancelled")
    f2 = ex.submit(ST, O4, "cancelled")
    codes = sorted([f1.result()[0], f2.result()[0]])
check("G double cancel: one wins, one is refused", (200, codes), 200, pred=lambda v: v == [200, 403])
check("G ...stock restored exactly once", (200, stock(122)), 200, pred=lambda v: v == b + 3)
check("G ...one cancel in history", (200, sql(f"select count(*) from order_status_history where \"orderId\"={O4} and status='cancelled'")), 200, pred=lambda v: v == "1")

# ================================================================= H integrity
check("H no negative stock", (200, sql("select count(*) from seller_product_sku where quantity < 0")), 200, pred=lambda v: v == "0")
check("H stock matches open orders for the product", (200, sql("select count(*) from order_item i join \"order\" o on o.id=i.\"orderId\" where o.\"recipientName\" like 'T Staff %' and o.status<>'cancelled'") ), 200, pred=lambda v: int(v) == 2)
check("H every order has exactly one first history row", (200, sql("select count(*) from \"order\" o where o.\"recipientName\" like 'T Staff %' and (select count(*) from order_status_history h where h.\"orderId\"=o.id and h.\"fromStatus\" is null) <> 1")), 200, pred=lambda v: v == "0")
check("H history rows chain: each fromStatus is the previous status", (200, sql("""select count(*) from (select h."orderId", h.id, h."fromStatus", lag(h.status) over (partition by h."orderId" order by h.id) as prev from order_status_history h join "order" o on o.id=h."orderId" where o."recipientName" like 'T Staff %') x where x.prev is not null and x."fromStatus" is distinct from x.prev""")), 200, pred=lambda v: v == "0")

# ================================================================= summary
cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
