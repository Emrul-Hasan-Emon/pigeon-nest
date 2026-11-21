#!/usr/bin/env python3
"""Black-box tests: customer / guest carts (one per seller, live data), merge, and the admin cart lists."""
import concurrent.futures as cf, json, os, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
results = []
RUN = uuid.uuid4().hex[:6]


def call(method, path, token=None, body=None, session=None, raw_headers=None):
    cmd = ["curl", "-s", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    for h in raw_headers or []:
        cmd += ["-H", h]
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
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


def new_session():
    return call("POST", "/user/carts/session")[1]["sessionId"]


def register(n):
    phone = f"+88017{RUN_NUM}{n:03d}"
    c, d = call("POST", "/user/auth/register", body={"name": f"T Cart {n}", "phone": phone, "password": "Passw0rd!x", "email": f"t-cart-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"], phone


RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
C = "/user/carts"
P_HOMER, S_HOMER_M, S_HOMER_F, S_HOMER_P = 94, 119, 120, 121  # seller 5, default SKU is the male one
P_SPRINT, S_SPRINT_M = 95, 122  # seller 6
P_FANTAIL = 96  # seller 7


def restore():
    sql("update seller_product set \"activeStatus\"='active', status='approved' where id in (94,95,96)")
    sql("update seller set status='approved', \"activeStatus\"='active' where id in (5,6,7)")
    sql("update seller_product_sku set \"isActive\"=true, \"discountedPriceStartDate\"=null where \"sellerProductId\" in (94,95,96)")
    sql("update seller_product_sku set quantity=6, price=3500, \"discountedPrice\"=3200 where id=119")
    sql("update seller_product_sku set quantity=4 where id=120")
    sql("update seller_product_sku set quantity=3 where id=121")
    sql("update seller_product_sku set quantity=8 where id=122")


def cleanup():
    sql("delete from system_commission_history where \"sellerId\" in (select id from seller where name like 'T Cart %')")
    sql("delete from system_commission_disburse_attachments where \"disburseId\" in (select id from system_commission_disburse where \"sellerId\" in (select id from seller where name like 'T Cart %'))")
    sql("delete from system_commission_disburse where \"sellerId\" in (select id from seller where name like 'T Cart %')")
    sql("delete from system_commission where \"sellerId\" in (select id from seller where name like 'T Cart %')")
    sql("delete from system_commission_history where \"orderId\" in (select id from \"order\" where \"orderNumber\" like 'T-CART-%')")
    sql("delete from \"order\" where \"orderNumber\" like 'T-CART-%'")
    sql(f"delete from cart where \"sessionId\" like 'tcart{RUN}%' or \"userId\" in (select id from \"user\" where email like 't-cart-{RUN}-%')")
    sql(f"delete from \"user\" where email like 't-cart-{RUN}-%'")
    sql("delete from seller where name like 'T Cart %'")
    restore()


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]


def sess(tag):
    return f"tcart{RUN}{tag}"


def lines(res):
    return res[1]["cart"]["lines"] if res[1] and res[1].get("cart") else []


# ================================================================= A identity
check("A new guest session id", call("POST", C + "/session"), [200, 201], pred=lambda v: len(v["sessionId"]) == 32)
check("A guest without a session sees an empty list", call("GET", C), 200, pred=lambda v: v["carts"] == [] and v["summary"] == {"cartCount": 0, "itemCount": 0})
check("A summary without a session", call("GET", C + "/summary"), 200, pred=lambda v: v == {"cartCount": 0, "itemCount": 0})
check("A session too short -> 400", call("GET", C, session="abc"), 400)
check("A session with bad characters -> 400", call("GET", C, session="bad session!!!"), 400)
check("A session too long -> 400", call("GET", C, session="a" * 101), 400)
check("A add without a session -> 400", call("POST", C + "/items", body={"sellerProductId": P_HOMER}), 400)
check("A bad token -> 401", call("GET", C, token="garbage"), 401)
check("A admin token on customer cart -> 403", call("GET", C, token=ADMIN), 403)
SELLER_TOKEN = call("POST", "/seller/auth/register", body={"name": "T Cart Seller", "phone": f"+88017{RUN_NUM}999", "password": "Passw0rd!x"})[1]["accessToken"]
check("A seller token on customer cart -> 403", call("GET", C, token=SELLER_TOKEN), 403)
tok_s, uid_s, _ = register(1)
sql(f"update \"user\" set status='suspended' where id={uid_s}")
check("A suspended customer -> 403", call("GET", C, token=tok_s), 403, pred=lambda v: v.get("code") == "USER_SUSPENDED")

# ================================================================= B add validation
G = sess("b")
add = lambda body, s=G, token=None: call("POST", C + "/items", token=token, body=body, session=s)
check("B missing product -> 400", add({}), 400)
check("B product 0 -> 400", add({"sellerProductId": 0}), 400)
check("B product string -> 400", add({"sellerProductId": "94"}), 400)
check("B product too large -> 400", add({"sellerProductId": 99999999999}), 400)
check("B quantity 0 -> 400", add({"sellerProductId": P_HOMER, "quantity": 0}), 400)
check("B quantity 100 -> 400", add({"sellerProductId": P_HOMER, "quantity": 100}), 400)
check("B quantity 1.5 -> 400", add({"sellerProductId": P_HOMER, "quantity": 1.5}), 400)
check("B quantity string -> 400", add({"sellerProductId": P_HOMER, "quantity": "2"}), 400)
check("B sku null -> 400", add({"sellerProductId": P_HOMER, "sellerProductSkuId": None}), 400)
check("B unknown field -> 400", add({"sellerProductId": P_HOMER, "price": 1}), 400)
check("B unknown product -> 404", add({"sellerProductId": 99999999}), 404)
check("B another product's sku -> 400", add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_SPRINT_M}), 400)
check("B unknown sku -> 400", add({"sellerProductId": P_HOMER, "sellerProductSkuId": 99999999}), 400)
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P_HOMER}")
check("B inactive product -> 404", add({"sellerProductId": P_HOMER}), 404)
restore()
sql(f"update seller_product set status='pending' where id={P_HOMER}")
check("B unapproved product -> 404", add({"sellerProductId": P_HOMER}), 404)
restore()
sql("update seller set \"activeStatus\"='suspended' where id=5")
check("B suspended seller's product -> 404", add({"sellerProductId": P_HOMER}), 404)
restore()
sql(f"update seller_product_sku set \"isActive\"=false where id={S_HOMER_F}")
check("B inactive sku -> 400", add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_F}), 400)
restore()
sql(f"update seller_product_sku set quantity=0 where id={S_HOMER_F}")
check("B out-of-stock sku -> 400", add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_F}), 400)
restore()
check("B nothing was created by the failures", (200, sql(f"select count(*) from cart where \"sessionId\"='{G}'")), 200, pred=lambda v: v == "0")

# ================================================================= C add behaviour + totals
G = sess("c")
r = add({"sellerProductId": P_HOMER, "quantity": 2}, G)
check("C add with no sku uses the default sku", r, [200, 201], pred=lambda v: v["cart"]["lines"][0]["sku"]["id"] == S_HOMER_M and v["cart"]["lines"][0]["quantity"] == 2 and v["notice"] is None)
check("C cart is built from live prices", r, [200, 201], pred=lambda v: v["cart"]["lines"][0]["unitPrice"] == 3500 and v["cart"]["lines"][0]["unitPayable"] == 3200 and v["cart"]["lines"][0]["linePayable"] == 6400)
check("C totals (list, payable, savings)", r, [200, 201], pred=lambda v: v["cart"]["totals"] == {"itemCount": 2, "listTotal": 7000, "payableTotal": 6400, "savings": 600} and v["cart"]["canCheckout"] is True)
check("C line shows the variant label", r, [200, 201], pred=lambda v: "Gender: Male" in v["cart"]["lines"][0]["sku"]["label"])
check("C cart names the seller", r, [200, 201], pred=lambda v: v["cart"]["seller"]["id"] == 5)
CART_H = r[1]["cart"]["id"]
r = add({"sellerProductId": P_HOMER, "quantity": 1}, G)
check("C adding the same sku again sums the quantity", r, [200, 201], pred=lambda v: len(v["cart"]["lines"]) == 1 and v["cart"]["lines"][0]["quantity"] == 3 and v["cart"]["id"] == CART_H)
r = add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_F}, G)
check("C another sku of the same product is a second line in the same cart", r, [200, 201], pred=lambda v: len(v["cart"]["lines"]) == 2 and v["cart"]["id"] == CART_H)
r = add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_F, "quantity": 10}, G)
check("C quantity is capped at stock, with a notice", r, [200, 201], pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_F)["quantity"] == 4 and "4" in (v["notice"] or ""))
sql(f"update seller_product_sku set quantity=500 where id={S_HOMER_M}")
r = add({"sellerProductId": P_HOMER, "quantity": 99}, G)
check("C quantity is capped at 99 per line, with a notice", r, [200, 201], pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_M)["quantity"] == 99 and "99" in (v["notice"] or ""))
restore()
r = add({"sellerProductId": P_SPRINT}, G)
check("C a product of another seller opens a second cart", r, [200, 201], pred=lambda v: v["cart"]["id"] != CART_H and v["cart"]["seller"]["id"] == 6)
check("C one cart per seller in the database", (200, sql(f"select count(*) from cart where \"sessionId\"='{G}' and \"isActive\"")), 200, pred=lambda v: v == "2")
c, lst = call("GET", C, session=G)
check("C list shows every active cart, newest activity first", (c, lst), 200, pred=lambda v: [x["seller"]["id"] for x in v["carts"]] == [6, 5] and v["summary"]["cartCount"] == 2)
check("C summary counts carts and items", call("GET", C + "/summary", session=G), 200, pred=lambda v: v["cartCount"] == 2 and v["itemCount"] > 0)
check("C cart for one seller", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: v["cart"]["id"] == CART_H and v["seller"]["name"] == "Rahim Pigeon Loft")
check("C seller with no cart -> cart null but seller shown", call("GET", f"{C}/seller/7", session=G), 200, pred=lambda v: v["cart"] is None and v["seller"]["id"] == 7)
check("C unknown seller -> 404", call("GET", f"{C}/seller/99999999", session=G), 404)
check("C seller id abc -> 400", call("GET", f"{C}/seller/abc", session=G), 400)
check("C stored totals follow the lines", (200, sql(f"select \"totalPrice\"::text || '|' || \"totalDiscountedPrice\"::text from cart where id={CART_H}")), 200, pred=lambda v: v.split("|")[0] != "0.00" and float(v.split("|")[1]) > 0)
check("C another session sees none of these carts", call("GET", C, session=sess("zz")), 200, pred=lambda v: v["carts"] == [])

# ================================================================= D live data
G = sess("d")
r = add({"sellerProductId": P_HOMER, "quantity": 2}, G)
CART_D = r[1]["cart"]["id"]
add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_F, "quantity": 2}, G)
sql(f"update seller_product_sku set price=4000, \"discountedPrice\"=3800 where id={S_HOMER_M}")
check("D a price change shows on the next read", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_M)["unitPayable"] == 3800 and next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_M)["priceChanged"] is True)
check("D ...and totals add up the live line totals", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: v["cart"]["totals"]["payableTotal"] == round(sum(l["linePayable"] for l in v["cart"]["lines"]), 2) and v["cart"]["canCheckout"] is True)
sql("update seller_product_sku set price=3500, \"discountedPrice\"=3200 where id=119")
sql(f"update seller_product_sku set quantity=1 where id={S_HOMER_M}")
check("D stock below the quantity -> insufficient_stock", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_M)["status"] == "insufficient_stock" and v["cart"]["canCheckout"] is False and any("Only 1" in i for i in v["cart"]["issues"]))
check("D a blocked line is left out of the totals", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: v["cart"]["totals"]["itemCount"] == 2)
sql(f"update seller_product_sku set quantity=0 where id={S_HOMER_M}")
check("D no stock -> out_of_stock", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_M)["status"] == "out_of_stock")
restore()
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P_HOMER}")
check("D an inactive product -> unavailable", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: all(l["status"] == "unavailable" for l in v["cart"]["lines"]) and v["cart"]["totals"]["itemCount"] == 0 and v["cart"]["canCheckout"] is False)
restore()
sql("update seller set \"activeStatus\"='suspended' where id=5")
check("D a suspended seller -> unavailable", call("GET", f"{C}/seller/5", session=G), 404)
check("D ...and the cart list marks its lines unavailable", call("GET", C, session=G), 200, pred=lambda v: all(l["status"] == "unavailable" for l in v["carts"][0]["lines"]))
restore()
sql(f"update seller_product_sku set \"isActive\"=false where id={S_HOMER_F}")
check("D an inactive sku -> unavailable", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_F)["status"] == "unavailable")
restore()
sql(f"update seller_product_sku set \"discountedPriceStartDate\"=now()+interval '1 day' where id={S_HOMER_M}")
check("D a discount that has not started is not applied", call("GET", f"{C}/seller/5", session=G), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["sku"]["id"] == S_HOMER_M)["unitPayable"] == 3500)
restore()
check("D reading never changes the stored cart", (200, sql(f"select count(*) from cart_item where \"cartId\"={CART_D}")), 200, pred=lambda v: v == "2")

# ================================================================= E update / remove / clear + isolation
G = sess("e")
r = add({"sellerProductId": P_HOMER, "quantity": 2}, G)
CART_E, ITEM_E = r[1]["cart"]["id"], r[1]["cart"]["lines"][0]["id"]
add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_P}, G)
upd = lambda cart, item, body, s=G, token=None: call("PATCH", f"{C}/{cart}/items/{item}", token=token, body=body, session=s)
check("E update quantity", upd(CART_E, ITEM_E, {"quantity": 4}), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["id"] == ITEM_E)["quantity"] == 4)
check("E update is capped at stock with a notice", upd(CART_E, ITEM_E, {"quantity": 50}), 200, pred=lambda v: next(l for l in v["cart"]["lines"] if l["id"] == ITEM_E)["quantity"] == 6 and v["notice"])
check("E quantity 0 -> 400", upd(CART_E, ITEM_E, {"quantity": 0}), 400)
check("E quantity 100 -> 400", upd(CART_E, ITEM_E, {"quantity": 100}), 400)
check("E quantity 1.5 -> 400", upd(CART_E, ITEM_E, {"quantity": 1.5}), 400)
check("E quantity missing -> 400", upd(CART_E, ITEM_E, {}), 400)
check("E unknown field -> 400", upd(CART_E, ITEM_E, {"quantity": 1, "unitPrice": 1}), 400)
check("E wrong cart id -> 404", upd(99999999, ITEM_E, {"quantity": 1}), 404)
check("E wrong item id -> 404", upd(CART_E, 99999999, {"quantity": 1}), 404)
check("E ids must be numbers -> 400", call("PATCH", f"{C}/abc/items/{ITEM_E}", body={"quantity": 1}, session=G), 400)
check("E another guest cannot change my cart -> 404", upd(CART_E, ITEM_E, {"quantity": 1}, sess("other")), 404)
check("E another guest cannot remove my item -> 404", call("DELETE", f"{C}/{CART_E}/items/{ITEM_E}", session=sess("other")), 404)
check("E another guest cannot clear my cart -> 404", call("DELETE", f"{C}/{CART_E}", session=sess("other")), 404)
check("E update without a session -> 400", call("PATCH", f"{C}/{CART_E}/items/{ITEM_E}", body={"quantity": 1}), 400)
sql(f"update seller_product_sku set quantity=0 where id={S_HOMER_M}")
check("E update an out-of-stock item -> 400", upd(CART_E, ITEM_E, {"quantity": 1}), 400)
restore()
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P_HOMER}")
check("E update an unavailable item -> 400", upd(CART_E, ITEM_E, {"quantity": 1}), 400)
restore()
check("E remove one item keeps the cart", call("DELETE", f"{C}/{CART_E}/items/{ITEM_E}", session=G), 200, pred=lambda v: v["cart"] is not None and len(v["cart"]["lines"]) == 1)
last = call("GET", f"{C}/seller/5", session=G)[1]["cart"]["lines"][0]["id"]
check("E removing the last item deletes the cart", call("DELETE", f"{C}/{CART_E}/items/{last}", session=G), 200, pred=lambda v: v["cart"] is None)
check("E ...from the database too", (200, sql(f"select count(*) from cart where id={CART_E}")), 200, pred=lambda v: v == "0")
r = add({"sellerProductId": P_HOMER}, G)
CART_E2 = r[1]["cart"]["id"]
check("E a new cart starts after the old one is gone", (200, CART_E2), 200, pred=lambda v: v != CART_E)
check("E clear cart -> 204", call("DELETE", f"{C}/{CART_E2}", session=G), 204)
check("E clear again -> 404", call("DELETE", f"{C}/{CART_E2}", session=G), 404)

# ================================================================= F customers + merge
tok_a, uid_a, phone_a = register(2)
tok_b, uid_b, _ = register(3)
r = call("POST", C + "/items", token=tok_a, body={"sellerProductId": P_HOMER, "quantity": 2})
check("F a signed-in customer's cart belongs to the user", r, [200, 201], pred=lambda v: v["cart"]["seller"]["id"] == 5)
check("F ...stored with userId and no session", (200, sql(f"select \"userId\"::text || '|' || coalesce(\"sessionId\",'-') from cart where \"userId\"={uid_a}")), 200, pred=lambda v: v == f"{uid_a}|-")
CART_A = r[1]["cart"]["id"]
check("F a token wins over a session header", call("GET", C, token=tok_a, session=sess("f-ignored")), 200, pred=lambda v: v["summary"]["cartCount"] == 1)
check("F another customer cannot see it", call("GET", C, token=tok_b), 200, pred=lambda v: v["carts"] == [])
check("F another customer cannot change it -> 404", call("PATCH", f"{C}/{CART_A}/items/{r[1]['cart']['lines'][0]['id']}", token=tok_b, body={"quantity": 1}), 404)
check("F another customer cannot clear it -> 404", call("DELETE", f"{C}/{CART_A}", token=tok_b), 404)

G = sess("m")
add({"sellerProductId": P_HOMER, "quantity": 3}, G)                       # same sku as the customer's line -> sums
add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_F}, G)     # new line
add({"sellerProductId": P_SPRINT, "quantity": 1}, G)                      # a seller the customer has no cart with
add({"sellerProductId": P_FANTAIL, "quantity": 1}, G)                     # will become unavailable
sql("update seller set \"activeStatus\"='suspended' where id=7")
check("F merge needs a token -> 401", call("POST", C + "/merge", body={"sessionId": G}), 401)
check("F merge needs a valid session -> 400", call("POST", C + "/merge", token=tok_a, body={"sessionId": "x"}), 400)
check("F merge needs a session -> 400", call("POST", C + "/merge", token=tok_a, body={}), 400)
check("F a seller cannot merge -> 403", call("POST", C + "/merge", token=SELLER_TOKEN, body={"sessionId": G}), 403)
check("F merge unknown field -> 400", call("POST", C + "/merge", token=tok_a, body={"sessionId": G, "x": 1}), 400)
m = call("POST", C + "/merge", token=tok_a, body={"sessionId": G})
check("F merge sums quantities for the same seller and sku", m, [200, 201], pred=lambda v: next(c for c in v["carts"] if c["seller"]["id"] == 5)["lines"][0]["quantity"] == 5)
check("F merge brings across other lines and carts", m, [200, 201], pred=lambda v: {c["seller"]["id"] for c in v["carts"]} == {5, 6})
check("F merge drops unavailable items (no empty cart left behind)", m, [200, 201], pred=lambda v: all(c["seller"]["id"] != 7 for c in v["carts"]))
check("F ...nothing for that seller was created in the database", (200, sql(f"select count(*) from cart where \"userId\"={uid_a} and \"sellerId\"=7")), 200, pred=lambda v: v == "0")
check("F the guest session is empty afterwards", call("GET", C, session=G), 200, pred=lambda v: v["carts"] == [])
check("F merging again changes nothing", call("POST", C + "/merge", token=tok_a, body={"sessionId": G}), [200, 201], pred=lambda v: next(c for c in v["carts"] if c["seller"]["id"] == 5)["lines"][0]["quantity"] == 5)
restore()
G2 = sess("m2")
add({"sellerProductId": P_HOMER, "quantity": 5}, G2)
sql(f"update seller_product_sku set quantity=6 where id={S_HOMER_M}")
check("F merged quantity is capped at stock", call("POST", C + "/merge", token=tok_a, body={"sessionId": G2}), [200, 201], pred=lambda v: next(c for c in v["carts"] if c["seller"]["id"] == 5)["lines"][0]["quantity"] == 6)
check("F merging an unknown session is a no-op", call("POST", C + "/merge", token=tok_a, body={"sessionId": sess("never")}), [200, 201], pred=lambda v: v["summary"]["cartCount"] == 2)
check("F one active cart per seller for the customer", (200, sql(f"select count(*) from cart where \"userId\"={uid_a} and \"isActive\"")), 200, pred=lambda v: v == "2")
tok_c, uid_c, _ = register(4)
G3 = sess("m3")
add({"sellerProductId": P_HOMER}, G3)
check("F merge into a customer with no carts moves the cart over", call("POST", C + "/merge", token=tok_c, body={"sessionId": G3}), [200, 201], pred=lambda v: v["summary"]["cartCount"] == 1)

# ================================================================= G concurrency
G = sess("p")
with cf.ThreadPoolExecutor(max_workers=10) as ex:
    outs = list(ex.map(lambda _: add({"sellerProductId": P_HOMER, "sellerProductSkuId": S_HOMER_P}, G), range(10)))
check("G parallel adds all succeed", (200, [o[0] for o in outs]), 200, pred=lambda v: all(code in (200, 201) for code in v))
check("G ...into exactly one cart", (200, sql(f"select count(*) from cart where \"sessionId\"='{G}'")), 200, pred=lambda v: v == "1")
check("G ...one line, quantity capped at stock (3)", (200, sql(f"select count(*) || '|' || coalesce(max(i.quantity),0) from cart_item i join cart c on c.id=i.\"cartId\" where c.\"sessionId\"='{G}'")), 200, pred=lambda v: v == "1|3")
G = sess("q")
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    list(ex.map(lambda pid: add({"sellerProductId": pid}, G), [P_HOMER, P_SPRINT, P_HOMER, P_SPRINT, P_HOMER, P_SPRINT]))
check("G parallel adds across sellers give one cart each", (200, sql(f"select count(*) from cart where \"sessionId\"='{G}'")), 200, pred=lambda v: v == "2")

# ================================================================= H admin
A = "/admin/carts"
check("H admin carts need a token", call("GET", A), 401)
check("H a seller cannot see carts -> 403", call("GET", A, token=SELLER_TOKEN), 403)
check("H a customer cannot see admin carts -> 403", call("GET", A, token=tok_a), 403)
check("H a seller cannot open a cart -> 403", call("GET", f"{A}/{CART_A}", token=SELLER_TOKEN), 403)

# turn two carts into "ordered" ones
user_d = sql('select id from "user" order by id limit 1')
sess_ord = sess("ord")
ro = add({"sellerProductId": P_SPRINT, "quantity": 2}, sess_ord)
cart_ord = ro[1]["cart"]["id"]
sql(f"""insert into "order" ("orderNumber","userId","sellerId",total,subtotal,"payableAmount","paymentGatewayId","paymentGatewaySlug","recipientName","recipientPhone","deliveryAddress","cartId","paymentGatewayName","countryCode","countryName","city")
        values ('T-CART-{RUN}',{user_d},6,100,100,100,(select id from payment_gateway limit 1),'cash-on-delivery','x','1','x',{cart_ord},'g','BD','Bangladesh','Dhaka')""")
order_id = sql(f"select id from \"order\" where \"orderNumber\"='T-CART-{RUN}'")
sql(f"update cart set \"isActive\"=false, \"orderId\"={order_id} where id={cart_ord}")
cart_empty = int(sql(f"insert into cart (\"sellerId\", \"sessionId\", \"isActive\") values (7, '{sess('emp')}', true) returning id").split("\n")[0])

c, act = call("GET", A + "?limit=100", ADMIN)
check("H default list is active carts", (c, act), 200, pred=lambda v: all(r["isActive"] for r in v["results"]) and cart_ord not in [r["id"] for r in v["results"]] and CART_A in [r["id"] for r in v["results"]])
check("H list row shape", (c, act), 200, pred=lambda v: {"id", "owner", "seller", "lineCount", "itemCount", "listTotal", "payableTotal", "order", "createdAt", "updatedAt"} <= set(v["results"][0]))
check("H newest first", (c, act), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted((r["id"] for r in v["results"]), reverse=True))
check("H customer owner has name, email, phone", (c, act), 200, pred=lambda v: next(r for r in v["results"] if r["id"] == CART_A)["owner"]["user"]["phone"] == phone_a)
check("H guest session is masked in the list", (c, act), 200, pred=lambda v: all(r["owner"]["sessionId"] is None or r["owner"]["sessionId"].endswith("…") for r in v["results"]))
check("H no password hash anywhere", (c, act), 200, pred=lambda v: "passwordHash" not in json.dumps(v))
check("H inactive list", call("GET", A + "?state=inactive", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [cart_ord] and v["results"][0]["order"]["orderNumber"] == f"T-CART-{RUN}")
check("H state invalid -> 400", call("GET", A + "?state=maybe", ADMIN), 400)
check("H filter sellerId", call("GET", A + "?sellerId=6&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["seller"]["id"] == 6 for r in v["results"]))
check("H filter sellerSearch", call("GET", A + "?sellerSearch=karim&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["seller"]["name"] == "Karim Breeders" for r in v["results"]))
check("H filter customerSearch by name", call("GET", A + "?customerSearch=T%20Cart%202&limit=100", ADMIN), 200, pred=lambda v: CART_A in [r["id"] for r in v["results"]] and all(r["owner"]["user"]["name"] == "T Cart 2" for r in v["results"]))
check("H filter customerSearch by phone", call("GET", A + f"?customerSearch={phone_a.replace('+', '%2B')}", ADMIN), 200, pred=lambda v: [r["owner"]["user"]["id"] for r in v["results"]] == [uid_a] * len(v["results"]) and len(v["results"]) == 2)
check("H filter customerSearch by email", call("GET", A + f"?customerSearch=t-cart-{RUN}-2", ADMIN), 200, pred=lambda v: len(v["results"]) == 2)
check("H customerSearch % is literal", call("GET", A + "?customerSearch=%25", ADMIN), 200, pred=lambda v: v["results"] == [])
check("H filter userId", call("GET", A + f"?userId={uid_a}", ADMIN), 200, pred=lambda v: len(v["results"]) == 2 and all(r["owner"]["type"] == "customer" for r in v["results"]))
check("H filter owner=customer", call("GET", A + "?owner=customer&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["owner"]["type"] == "customer" for r in v["results"]))
check("H filter owner=guest", call("GET", A + "?owner=guest&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["owner"]["type"] == "guest" for r in v["results"]))
check("H owner invalid -> 400", call("GET", A + "?owner=robot", ADMIN), 400)
check("H filter orderNumber (inactive)", call("GET", A + f"?state=inactive&orderNumber=t-cart-{RUN}", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [cart_ord])
check("H orderNumber filter finds nothing among active carts", call("GET", A + f"?orderNumber=T-CART-{RUN}", ADMIN), 200, pred=lambda v: v["results"] == [])
check("H hasItems=false finds the empty cart", call("GET", A + "?hasItems=false&limit=100", ADMIN), 200, pred=lambda v: cart_empty in [r["id"] for r in v["results"]] and all(r["lineCount"] == 0 for r in v["results"]))
check("H hasItems=true excludes it", call("GET", A + "?hasItems=true&limit=100", ADMIN), 200, pred=lambda v: cart_empty not in [r["id"] for r in v["results"]] and all(r["lineCount"] > 0 for r in v["results"]))
check("H hasItems junk -> 400", call("GET", A + "?hasItems=maybe", ADMIN), 400)
check("H filter minTotal", call("GET", A + "?minTotal=5000&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["payableTotal"] >= 5000 for r in v["results"]))
check("H filter maxTotal", call("GET", A + "?maxTotal=3000&limit=100", ADMIN), 200, pred=lambda v: all(r["payableTotal"] <= 3000 for r in v["results"]))
check("H total range", call("GET", A + "?minTotal=3000&maxTotal=3000&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["payableTotal"] == 3000 for r in v["results"]))
check("H minTotal > maxTotal -> 400", call("GET", A + "?minTotal=9&maxTotal=1", ADMIN), 400)
check("H negative minTotal -> 400", call("GET", A + "?minTotal=-1", ADMIN), 400)
today = sql("select to_char(now(), 'YYYY-MM-DD')")
check("H createdFrom today includes new carts", call("GET", A + f"?createdFrom={today}&limit=100", ADMIN), 200, pred=lambda v: CART_A in [r["id"] for r in v["results"]])
check("H createdTo today (whole day) includes them", call("GET", A + f"?createdTo={today}&limit=100", ADMIN), 200, pred=lambda v: CART_A in [r["id"] for r in v["results"]])
check("H createdTo in the past excludes them", call("GET", A + "?createdTo=2000-01-01&limit=100", ADMIN), 200, pred=lambda v: v["results"] == [])
check("H createdFrom in the future excludes them", call("GET", A + "?createdFrom=2099-01-01", ADMIN), 200, pred=lambda v: v["results"] == [])
check("H updatedFrom/updatedTo", call("GET", A + f"?updatedFrom={today}&updatedTo={today}&limit=100", ADMIN), 200, pred=lambda v: CART_A in [r["id"] for r in v["results"]])
check("H from after to -> 400", call("GET", A + "?createdFrom=2030-01-02&createdTo=2030-01-01", ADMIN), 400)
check("H bad date -> 400", call("GET", A + "?createdFrom=yesterday", ADMIN), 400)
check("H unknown param -> 400", call("GET", A + "?foo=1", ADMIN), 400)
check("H limit over 100 -> 400", call("GET", A + "?limit=101", ADMIN), 400)
seen, cursor = [], 0
for _ in range(60):
    c, v = call("GET", f"{A}?limit=3&cursor={cursor}", ADMIN)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("H cursor paging visits every active cart once", (200, seen), 200, pred=lambda v: len(v) == len(set(v)) == int(sql("select count(*) from cart where \"isActive\" and \"deletedAt\" is null")))

c, det = call("GET", f"{A}/{CART_A}", ADMIN)
check("H detail of an active cart is live", (c, det), 200, pred=lambda v: v["mode"] == "live" and v["canCheckout"] is True and v["lines"][0]["status"] == "ok" and v["owner"]["user"]["id"] == uid_a)
check("H detail shows totals and seller", (c, det), 200, pred=lambda v: v["totals"]["itemCount"] > 0 and v["seller"]["id"] == 5 and v["order"] is None)
c, gd = call("GET", f"{A}/{cart_ord}", ADMIN)
check("H detail of an ordered cart is a snapshot linked to its order", (c, gd), 200, pred=lambda v: v["mode"] == "snapshot" and v["isActive"] is False and v["order"]["orderNumber"] == f"T-CART-{RUN}" and v["canCheckout"] is None)
check("H guest detail shows the full session id", (c, gd), 200, pred=lambda v: v["owner"]["type"] == "guest" and v["owner"]["sessionId"] == sess_ord)
check("H snapshot keeps the prices the lines had", (c, gd), 200, pred=lambda v: v["lines"][0]["unitPayable"] == 3000 and v["totals"]["payableTotal"] == 6000)
sql(f"update seller_product_sku set price=9999, \"discountedPrice\"=9999 where id={S_SPRINT_M}")
check("H ...even after the live price changes", call("GET", f"{A}/{cart_ord}", ADMIN), 200, pred=lambda v: v["lines"][0]["unitPayable"] == 3000)
sql(f"update seller_product_sku set price=3000, \"discountedPrice\"=null where id={S_SPRINT_M}")
check("H detail missing -> 404", call("GET", A + "/99999999", ADMIN), 404)
check("H detail bad id -> 400", call("GET", A + "/abc", ADMIN), 400)

# ================================================================= summary
cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
