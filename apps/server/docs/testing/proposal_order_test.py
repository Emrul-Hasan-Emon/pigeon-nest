#!/usr/bin/env python3
"""Black-box tests: price proposals in the cart, at checkout and on the order.

Uses its own sellers and products ("T PP ..." / tpp-<run>-N), so real catalog data is never touched.
"""
import concurrent.futures as cf, json, os, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
P = "/user/proposals"


def call(method, path, token=None, body=None, session=None):
    cmd = ["curl", "-s", "-X", method, ROOT + path.replace(" ", "%20"), "-w", "\n%{http_code}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
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
    detail = "" if ok else f"expected {expected} got {got[0]} {note} body={str(got[1])[:300]}"
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + detail))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip().split("\n")[0]


def sqlint(q):
    return int(sql(q) or 0)


def cleanup():
    sql("delete from order_status_history where \"orderId\" in (select id from \"order\" where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("delete from payment_status_history where \"orderId\" in (select id from \"order\" where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("delete from payment where \"orderId\" in (select id from \"order\" where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("delete from order_item where \"orderId\" in (select id from \"order\" where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("update cart set \"orderId\"=null where \"sellerId\" in (select id from seller where name like 'T PP %')")
    sql("delete from \"order\" where \"sellerId\" in (select id from seller where name like 'T PP %')")
    sql("delete from cart_item where \"cartId\" in (select id from cart where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("delete from cart where \"sellerId\" in (select id from seller where name like 'T PP %')")
    sql("delete from sku_price_proposal_history where \"proposalId\" in (select id from sku_price_proposal where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("delete from sku_price_proposal where \"sellerId\" in (select id from seller where name like 'T PP %')")
    sql("delete from seller_product_sku where \"sellerProductId\" in (select id from seller_product where slug like 'tpp-%')")
    sql("delete from seller_product where slug like 'tpp-%'")
    sql("delete from \"user\" where email like 't-pp-%'")
    sql("delete from seller where name like 'T PP %'")


def register(n):
    phone = f"+88017{RUN_NUM}{n:03d}"
    c, d = call("POST", "/user/auth/register", body={"name": f"T PP User {n}", "phone": phone, "password": "Passw0rd!x", "email": f"t-pp-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


def make_seller(tag, n):
    c, d = call("POST", "/seller/auth/register", body={"name": f"T PP Seller {tag}", "phone": f"+88017{RUN_NUM}9{n:02d}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = d["seller"]["id"]
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


CAT = sqlint("select \"categoryId\" from seller_product where id=94")
SEQ = [0]


def mk(seller_id, price=2000, qty=5, name=None, accept=True, floor=None):
    """A product with one SKU. Returns (product id, sku id)."""
    SEQ[0] += 1
    n = SEQ[0]
    pid = sqlint(
        f"insert into seller_product (\"sellerId\",\"categoryId\",name,slug) values ({seller_id},{CAT},'{name or f'T PP Pigeon {n}'}','tpp-{RUN}-{n}') returning id"
    )
    fl = "null" if floor is None else floor
    kid = sqlint(
        f"insert into seller_product_sku (\"sellerProductId\",price,quantity,\"isDefault\",\"isActive\",\"acceptProposals\",\"minProposalPrice\") values ({pid},{price},{qty},true,true,{str(accept).lower()},{fl}) returning id"
    )
    return pid, kid



cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
S1_TOKEN, S1 = make_seller("One", 1)
tok_a, uid_a = register(1)
tok_b, uid_b = register(2)
COD = sqlint("select id from payment_gateway where slug='cash-on-delivery'")
UA, SE, AD, CT, CK = "/user/proposals", "/seller/proposals", "/admin/proposals", "/user/carts", "/user/checkout"
status_of = lambda pid: sql(f"select status from sku_price_proposal where id={pid}")
offer = lambda tok, sku, price=1500, qty=1: call("POST", UA, tok, {"sellerProductSkuId": sku, "price": price, "quantity": qty})
def agreed(tok, sku, price=1500, qty=2):
    r = offer(tok, sku, price, qty)
    assert r[0] == 201, r
    pid = r[1]["id"]
    a = call("POST", f"{SE}/{pid}/accept", S1_TOKEN, {})
    assert a[0] == 201 and a[1]["status"] == "accepted", a
    return pid
addc = lambda tok, body: call("POST", f"{CT}/items", tok, body)
line_of = lambda cart, sku: next(l for l in cart["lines"] if l["sku"]["id"] == sku)
payload = lambda **o: {**{"recipientName": "T PP Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
                           "addressLine": "House 1", "deliveryType": "standard", "paymentGatewayId": COD}, **o}
PID, SKU = mk(S1, price=2000, qty=10)
PID2, SKU2 = mk(S1, price=500, qty=10, accept=False)
sql(f"update seller_product_sku set price=2000, \"discountedPrice\"=null where id={SKU}")

# ================================================================= A add to cart with a proposal
pend = offer(tok_a, SKU, 1500, 2)[1]["id"]
check("A pending proposal cannot be used -> 400", addc(tok_a, {"sellerProductId": PID, "proposalId": pend}), 400)
call("POST", f"{SE}/{pend}/accept", S1_TOKEN, {})
check("A another buyer's proposal -> 404", addc(tok_b, {"sellerProductId": PID, "proposalId": pend}), 404)
check("A unknown proposal -> 404", addc(tok_a, {"sellerProductId": PID, "proposalId": 99999999}), 404)
check("A proposal id 0 -> 400", addc(tok_a, {"sellerProductId": PID, "proposalId": 0}), 400)
check("A wrong product -> 400", addc(tok_a, {"sellerProductId": PID2, "proposalId": pend}), 400)
check("A wrong variant -> 400", addc(tok_a, {"sellerProductId": PID, "sellerProductSkuId": SKU2, "proposalId": pend}), 400)
check("A quantity other than the proposal's -> 400", addc(tok_a, {"sellerProductId": PID, "proposalId": pend, "quantity": 1}), 400, pred=lambda v: "fixed" in str(v))
sql(f"update seller_product_sku set quantity=1 where id={SKU}")
check("A stock below the proposal quantity -> 400", addc(tok_a, {"sellerProductId": PID, "proposalId": pend}), 400, pred=lambda v: "stock" in str(v).lower())
sql(f"update seller_product_sku set quantity=10 where id={SKU}")
check("A none of the refused adds made a cart", (200, sqlint(f"select count(*) from cart where \"userId\"={uid_a}")), 200, pred=lambda v: v == 0)

r = addc(tok_a, {"sellerProductId": PID, "proposalId": pend})
check("A add at the proposal price -> 201", r, 201)
cart = r[1]["cart"]
CART = cart["id"]
ln = line_of(cart, SKU)
check("A line is at 1500 x2, SKU price still 2000", (200, ln), 200,
      pred=lambda l: l["quantity"] == 2 and l["unitPayable"] == 1500 and l["linePayable"] == 3000 and l["unitPrice"] == 2000
      and l["skuUnitPayable"] == 2000 and l["proposal"] == {"id": pend, "unitPrice": 1500, "applied": True} and l["proposalNotice"] is None and l["priceChanged"] is False)
check("A cart totals use the proposal price", (200, cart), 200, pred=lambda c: c["totals"]["payableTotal"] == 3000 and c["totals"]["listTotal"] == 4000 and c["totals"]["savings"] == 1000 and c["canCheckout"] and c["notices"] == [])
check("A stored cart totals follow", (200, sql(f"select \"totalDiscountedPrice\" from cart where id={CART}")), 200, pred=lambda v: float(v) == 3000)
check("A adding the same proposal again is fine and changes nothing", addc(tok_a, {"sellerProductId": PID, "proposalId": pend}), 201,
      pred=lambda v: line_of(v["cart"], SKU)["quantity"] == 2 and v["cart"]["totals"]["payableTotal"] == 3000)

# ================================================================= B quantity is fixed
ITEM = ln["id"]
check("B change quantity of a proposal line -> 400", call("PATCH", f"{CT}/{CART}/items/{ITEM}", tok_a, {"quantity": 3}), 400, pred=lambda v: "fixed" in str(v))
check("B plain add of the same SKU -> 400", addc(tok_a, {"sellerProductId": PID, "sellerProductSkuId": SKU, "quantity": 1}), 400)
check("B line unchanged", (200, sqlint(f"select quantity from cart_item where id={ITEM}")), 200, pred=lambda v: v == 2)
o2 = addc(tok_a, {"sellerProductId": PID2, "quantity": 3})
check("B another SKU joins the cart at its own price", o2, 201, pred=lambda v: v["cart"]["totals"]["payableTotal"] == 3000 + 1500)
check("B the cart view from the list also carries the proposal", call("GET", CT, tok_a), 200,
      pred=lambda v: line_of(v["carts"][0], SKU)["proposal"]["id"] == pend)
check("B checkout options show it", call("GET", f"{CK}/{CART}?countryCode=BD", tok_a), 200,
      pred=lambda v: line_of(v["cart"], SKU)["unitPayable"] == 1500 and v["deliveryOptions"][0]["payable"] == 4500 + v["deliveryOptions"][0]["charge"])
check("B admin cart view shows the proposal line", call("GET", f"/admin/carts/{CART}", ADMIN), 200,
      pred=lambda v: line_of(v, SKU)["proposal"]["unitPrice"] == 1500 and line_of(v, SKU)["linePayable"] == 3000)

# ================================================================= C SKU gets cheaper than the proposal
sql(f"update seller_product_sku set \"discountedPrice\"=1400, \"discountedPriceStartDate\"=null, \"discountedPriceEndDate\"=null where id={SKU}")
v = call("GET", f"{CT}", tok_a)[1]["carts"][0]
ln = line_of(v, SKU)
check("C SKU at 1400 < proposal 1500: pay the lower, proposal not applied, warning", (200, ln), 200,
      pred=lambda l: l["unitPayable"] == 1400 and l["linePayable"] == 2800 and l["proposal"]["applied"] is False and "cheaper" in l["proposalNotice"] and l["proposal"]["unitPrice"] == 1500)
check("C the warning is in cart notices and checkout still allowed", (200, v), 200, pred=lambda c: len(c["notices"]) == 1 and c["canCheckout"])
sql(f"update seller_product_sku set \"discountedPrice\"=null where id={SKU}")

# ================================================================= D admin closes the proposal while it is in the cart
check("D admin cancels the accepted proposal", call("POST", f"{AD}/{pend}/cancel", ADMIN, {"note": "Dispute"}), 201, pred=lambda v: v["status"] == "cancelled")
v = call("GET", CT, tok_a)[1]["carts"][0]
ln = line_of(v, SKU)
check("D the line goes back to the SKU price with a message", (200, ln), 200,
      pred=lambda l: l["unitPayable"] == 2000 and l["linePayable"] == 4000 and l["proposal"] is None and "cancelled by an admin" in l["proposalNotice"] and l["priceChanged"] is False)
check("D message is among cart notices", (200, v), 200, pred=lambda c: len(c["notices"]) == 1 and c["totals"]["payableTotal"] == 4000 + 1500)
check("D stored cart totals follow the revert", (200, sql(f"select \"totalDiscountedPrice\" from cart where id={CART}")), 200, pred=lambda x: float(x) == 5500)
check("D the quantity can be changed again", call("PATCH", f"{CT}/{CART}/items/{ITEM}", tok_a, {"quantity": 3}), 200, pred=lambda v: line_of(v["cart"], SKU)["quantity"] == 3)
check("D ...which also clears the message", call("GET", CT, tok_a), 200, pred=lambda v: v["carts"][0]["notices"] == [])
check("D a cancelled proposal cannot be added -> 400", addc(tok_a, {"sellerProductId": PID, "proposalId": pend}), 400)

# ================================================================= E a new proposal replaces the plain line
p2 = agreed(tok_a, SKU, 1600, 2)
r = addc(tok_a, {"sellerProductId": PID, "proposalId": p2})
check("E proposal over an existing plain line: becomes the proposal line, quantity 2", r, 201,
      pred=lambda v: line_of(v["cart"], SKU)["quantity"] == 2 and line_of(v["cart"], SKU)["unitPayable"] == 1600 and line_of(v["cart"], SKU)["proposal"]["id"] == p2)
check("E still one line per SKU", (200, sqlint(f"select count(*) from cart_item where \"cartId\"={CART}")), 200, pred=lambda v: v == 2)
r = call("DELETE", f"{CT}/{CART}/items/{line_of(r[1]['cart'], SKU)['id']}", tok_a)
check("E removing the line leaves the proposal accepted", (200, status_of(p2)), 200, pred=lambda v: v == "accepted")
p2_cart = addc(tok_a, {"sellerProductId": PID, "proposalId": p2})
check("E ...and it can go back in", p2_cart, 201, pred=lambda v: line_of(v["cart"], SKU)["unitPayable"] == 1600)

# ================================================================= F place the order
sql("update seller set \"activeStatus\"='active' where id=%d" % S1)
pl = call("POST", f"{CK}/{CART}/place", tok_a, payload())
check("F place -> 201", pl, 201)
o = pl[1]
oid = o["id"]
it = next(i for i in o["items"] if i["sku"]["id"] == SKU)
it2 = next(i for i in o["items"] if i["sku"]["id"] == SKU2)
check("F proposal line: SKU price 2000 then, proposal 1600, charged 3200", (200, it), 200,
      pred=lambda i: i["unitPrice"] == 2000 and i["skuUnitPrice"] == 2000 and i["proposal"] == {"id": p2, "unitPrice": 1600, "lineTotal": 3200}
      and i["unitPayable"] == 1600 and i["lineTotal"] == 3200 and i["quantity"] == 2)
check("F plain line has no proposal", (200, it2), 200, pred=lambda i: i["proposal"] is None and i["unitPayable"] == 500 and i["lineTotal"] == 1500 and i["skuUnitPrice"] == 500)
t = o["totals"]
check("F subtotal = proposal total + other line; payable adds delivery", (200, t), 200,
      pred=lambda t: t["subtotal"] == 3200 + 1500 and t["listTotal"] == 4000 + 1500 and t["savings"] == 800 and t["payable"] == 4700 + t["deliveryCharge"])
row = sql(f"select subtotal||'|'||\"commissionType\"||'|'||\"commissionValue\"||'|'||\"systemCommission\"||'|'||\"sellerAmount\"||'|'||\"payableAmount\" from \"order\" where id={oid}").split("|")
sub_, ctype, cval, comm, sell, pay = row[0], row[1], float(row[2]), float(row[3]), float(row[4]), float(row[5])
expected = round(float(sub_) * cval / 100, 2) if ctype == "percentage" else cval
check("F commission is worked out on the proposal-based subtotal", (200, (float(sub_), comm, sell)), 200,
      pred=lambda v: v[0] == 4700 and abs(v[1] - expected) < 0.011 and abs(v[2] - (pay - v[1])) < 0.011)
check("F proposal is used and tied to the order", (200, sql(f"select status||'|'||\"orderId\"||'|'||(\"usedAt\" is not null) from sku_price_proposal where id={p2}")), 200, pred=lambda v: v == f"used|{oid}|true")
check("F history ends with 'used' by the buyer at 1600", call("GET", f"{UA}/{p2}", tok_a), 200,
      pred=lambda v: v["status"] == "used" and v["orderId"] == oid and v["actions"] == [] and v["history"][-1]["action"] == "used" and v["history"][-1]["actorType"] == "user" and v["history"][-1]["price"] == 1600)
check("F the cart is closed", (200, sql(f"select \"isActive\" from cart where id={CART}")), 200, pred=lambda v: v in ("f", "false"))
check("F order item stored all three prices", (200, sql(f"select \"unitPrice\"||'|'||\"unitDiscountedPrice\"||'|'||\"unitProposalPrice\"||'|'||\"totalProposalPrice\"||'|'||\"proposalId\" from order_item where \"orderId\"={oid} and \"sellerProductSkuId\"={SKU}")), 200, pred=lambda v: v == f"2000|2000|1600|3200|{p2}")

# ---- every role sees both prices
for who, path, tok in (("buyer", f"/user/orders/{oid}", tok_a), ("seller", f"/seller/orders/{oid}", S1_TOKEN), ("admin", f"/admin/orders/{oid}", ADMIN)):
    check(f"F {who} order detail shows SKU price and proposal price", call("GET", path, tok), 200,
          pred=lambda v: next(i for i in v["items"] if i["sku"]["id"] == SKU)["skuUnitPrice"] == 2000 and next(i for i in v["items"] if i["sku"]["id"] == SKU)["proposal"]["unitPrice"] == 1600
          and v["totals"]["subtotal"] == 4700)
check("F a used proposal cannot go back in a cart -> 400", addc(tok_a, {"sellerProductId": PID, "proposalId": p2}), 400)
check("F after use the buyer may propose again", offer(tok_a, SKU, 1700, 1), 201)

# ================================================================= G SKU cheaper at checkout: priced at the SKU, proposal untouched
p3 = agreed(tok_b, SKU, 1500, 1)
sql(f"update seller_product_sku set \"discountedPrice\"=1400 where id={SKU}")
cb = addc(tok_b, {"sellerProductId": PID, "proposalId": p3})
check("G add while SKU is cheaper still works", cb, 201, pred=lambda v: line_of(v["cart"], SKU)["unitPayable"] == 1400 and line_of(v["cart"], SKU)["proposal"]["applied"] is False)
plb = call("POST", f"{CK}/{cb[1]['cart']['id']}/place", tok_b, payload())
check("G order placed at the SKU price", plb, 201, pred=lambda o: o["totals"]["subtotal"] == 1400 and o["items"][0]["proposal"] is None and o["items"][0]["lineTotal"] == 1400)
check("G the proposal stays accepted, not used", (200, status_of(p3)), 200, pred=lambda v: v == "accepted")
sql(f"update seller_product_sku set \"discountedPrice\"=null where id={SKU}")

# ================================================================= H stock and races
check("H the buyer can still use that accepted proposal later", addc(tok_b, {"sellerProductId": PID, "proposalId": p3}), 201, pred=lambda v: line_of(v["cart"], SKU)["unitPayable"] == 1500)
CB = call("GET", CT, tok_b)[1]["carts"][0]["id"]
sql(f"update seller_product_sku set quantity=0 where id={SKU}")
check("H out of stock: checkout refused with the issue", call("POST", f"{CK}/{CB}/place", tok_b, payload()), 409)
check("H ...proposal still accepted", (200, status_of(p3)), 200, pred=lambda v: v == "accepted")
sql(f"update seller_product_sku set quantity=10 where id={SKU}")
before = sqlint("select count(*) from \"order\" where \"sellerId\"=%d" % S1)
def place():
    return call("POST", f"{CK}/{CB}/place", tok_b, payload())
def cancel():
    return call("POST", f"{AD}/{p3}/cancel", ADMIN, {})
with cf.ThreadPoolExecutor(2) as ex:
    f_place, f_cancel = ex.submit(place), ex.submit(cancel)
    pr, cr = f_place.result(), f_cancel.result()
st = status_of(p3)
orders_now = sqlint("select count(*) from \"order\" where \"sellerId\"=%d" % S1) - before
at_proposal = sqlint(f"select count(*) from order_item where \"proposalId\"={p3}")
check("H order vs admin cancel at once: either 'used' with the order, or cancelled with no order at that price", (200, (st, orders_now, at_proposal, pr[0])), 200,
      pred=lambda v: (v[0] == "used" and v[1] == 1 and v[2] == 1 and v[3] == 201) or (v[0] == "cancelled" and v[2] == 0 and v[3] in (201, 409)))
check("H ...and the admin cancel never fails with a server error", (200, cr[0]), 200, pred=lambda v: v in (201, 409))

# ================================================================= I guests and staff are unaffected
r = call("POST", f"{CT}/items", None, {"sellerProductId": PID, "proposalId": 1}, session="guestsess12345678")
check("I a guest cannot use a proposal -> 400", r, 400)

# ================================================================= J the total shown must still be the total
tok_c, uid_c = register(3)
PIDJ, SKUJ = mk(S1, price=2000, qty=10)
pj = agreed(tok_c, SKUJ, 1500, 2)
rj = addc(tok_c, {"sellerProductId": PIDJ, "proposalId": pj})
CJ = rj[1]["cart"]["id"]
placej = lambda **o: call("POST", f"{CK}/{CJ}/place", tok_c, payload(**o))
orders_j = lambda: sqlint(f"select count(*) from \"order\" where \"userId\"={uid_c}")
check("J wrong expectedItemsTotal -> 409 PRICE_CHANGED with the live total", placej(expectedItemsTotal=2500), 409,
      pred=lambda v: v.get("code") == "PRICE_CHANGED" and v["currentTotal"] == 3000 and "3000" in v["message"])
check("J ...no order made, proposal still accepted", (200, (orders_j(), status_of(pj))), 200, pred=lambda v: v == (0, "accepted"))
check("J negative expectedItemsTotal -> 400", placej(expectedItemsTotal=-1), 400)
check("J non-number expectedItemsTotal -> 400", placej(expectedItemsTotal="abc"), 400)
check("J three decimals -> 400", placej(expectedItemsTotal=3000.123), 400)
check("J admin cancels while the buyer looks at 3000", call("POST", f"{AD}/{pj}/cancel", ADMIN, {}), 201)
check("J stale total now refused: the line is back at 4000", placej(expectedItemsTotal=3000), 409,
      pred=lambda v: v["currentTotal"] == 4000 and len(v["notices"]) == 1)
check("J still no order", (200, orders_j()), 200, pred=lambda v: v == 0)
check("J the refreshed total (4000) places the order", placej(expectedItemsTotal=4000), 201,
      pred=lambda v: v["totals"]["subtotal"] == 4000)
pk = agreed(tok_c, SKUJ, 1500, 2)
addc(tok_c, {"sellerProductId": PIDJ, "proposalId": pk})
CJ = call("GET", CT, tok_c)[1]["carts"][0]["id"]
check("J exact total with proposal places at the offer price", placej(expectedItemsTotal=3000), 201,
      pred=lambda v: v["totals"]["subtotal"] == 3000 and v["items"][0]["proposal"]["unitPrice"] == 1500)

cleanup()
failed = [r for r in results if not r[0]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
