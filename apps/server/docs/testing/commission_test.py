#!/usr/bin/env python3
"""Black-box tests: seller commission (global + per-seller rule, setting history), commission on every order flow,
the commission balance and ledger (earn, reverse, cancel, reopen), commission payments, access and invariants."""
import base64, concurrent.futures as cf, json, os, subprocess, sys, tempfile, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads"))
TMP = tempfile.mkdtemp(prefix="com")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
TAG = "T Com"


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
    sql("update seller_product_sku set quantity=40, price=3000, \"discountedPrice\"=null where id=122")
    sql("delete from system_setting where key like 'commission.%'")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")


def cleanup():
    sellers = f"select id from seller where name like '{TAG} %'"
    ids = f"select id from \"order\" where \"recipientName\" like '{TAG} %' or \"sellerId\" in ({sellers})"
    paths = sql(f"select \"filePath\" from payment_attachments where \"orderId\" in ({ids}) union select \"filePath\" from system_commission_disburse_attachments").split()
    sql(f"delete from system_commission_change_history where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission_history where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission_disburse_attachments where \"disburseId\" in (select id from system_commission_disburse where \"sellerId\" in ({sellers}))")
    sql(f"delete from system_commission_disburse where \"sellerId\" in ({sellers})")
    sql(f"delete from system_commission where \"sellerId\" in ({sellers})")
    sql(f"delete from order_update where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql(f"delete from \"order\" where id in ({ids})")
    sql(f"delete from cart where \"sessionId\" like 'tcom{RUN}%'")
    sql(f"delete from \"user\" where email like 't-com-%'")
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
A, SL, CK, CART = "/admin/order", "/seller/order", "/user/order/checkout", "/user/carts"
CA, CS = "/admin/commission", "/seller/commission"


def make_seller(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"{TAG} Seller {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = int(sql(f"select id from seller where name='{TAG} Seller {tag}'"))
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


S1, SID1 = make_seller("111")
S2, SID2 = make_seller("222")
c, d = call("POST", "/user/auth/register", body={"name": f"{TAG} User", "phone": f"+88017{RUN_NUM}333", "password": "Passw0rd!x", "email": f"t-com-{RUN}@example.com"})
USER, UID = d["accessToken"], d["user"]["id"]
sql(f"update seller_product set \"sellerId\"={SID1} where id=94")
sql(f"update seller_product set \"sellerId\"={SID2} where id=95")
ctr = [0]


def sess():
    ctr[0] += 1
    return f"tcom{RUN}s{ctr[0]}"


def addr(**over):
    p = {"recipientName": f"{TAG} Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
         "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": COD}
    p.update(over)
    return p


def place(product=94, sku=119, qty=2):
    s = sess()
    c, d = call("POST", CART + "/items", body={"sellerProductId": product, "sellerProductSkuId": sku, "quantity": qty}, session=s)
    assert c in (200, 201), d
    c, o = call("POST", f"{CK}/{d['cart']['id']}/place", session=s, body=addr())
    assert c == 201, o
    return o


def staff_order(who, seller_id, product=94, sku=119, qty=2):
    base, tok = (A, ADMIN) if who == "admin" else (SL, S1 if seller_id == SID1 else S2)
    body = addr(items=[{"sellerProductId": product, "sellerProductSkuId": sku, "quantity": qty}])
    if who == "admin":
        body["sellerId"] = seller_id
    c, o = call("POST", base, tok, body)
    assert c == 201, o
    return o


def row(oid):
    return sql(f"select \"systemCommission\"||'|'||\"sellerAmount\"||'|'||\"payableAmount\"||'|'||coalesce(\"commissionType\",'')||'|'||coalesce(\"commissionValue\"::text,'') from \"order\" where id={oid}").split("|")


def pay(oid, amount=None, who="admin"):
    base, tok = (A, ADMIN) if who == "admin" else (SL, S1)
    fields = {"description": "Cash received at the door"}
    if amount is not None:
        fields["amount"] = amount
    return multi("POST", f"{base}/{oid}/payments", tok, fields, [("slip.png", PNG, "image/png")])


def payment_id(oid):
    return int(sql(f"select id from payment where \"orderId\"={oid} and status<>'due' and \"reversedAt\" is null order by id desc limit 1"))


def reverse(oid, pid, who="admin"):
    base, tok = (A, ADMIN) if who == "admin" else (SL, S1)
    return call("POST", f"{base}/{oid}/payments/{pid}/reverse", tok, {"reason": "Wrong entry"})


def bal(sid):
    r = sql(f"select \"totalCommission\"||'|'||\"dueCommission\"||'|'||\"paidCommission\" from system_commission where \"sellerId\"={sid}")
    return [float(x) for x in r.split("|")] if r else [0.0, 0.0, 0.0]


def live(oid):
    return int(sql(f"select count(*) from system_commission_history where \"orderId\"={oid} and type='order_commission' and \"deletedAt\" is null"))


def voided(oid):
    return int(sql(f"select count(*) from system_commission_history where \"orderId\"={oid} and type='order_commission' and \"deletedAt\" is not null"))


def put_rule(sid, t, v, tok=None):
    return call("PUT", f"/admin/commission/sellers/{sid}/setting", tok or ADMIN, {"commissionType": t, "commissionAmount": v})


def set_global(t, v):
    return call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": t, "commission.amount": v}})


# ============================================================ G  global setting
c, s = call("GET", "/admin/settings", ADMIN)
check("G settings list has the commission type", (c, s), 200, pred=lambda v: any(x["key"] == "commission.type" and x["value"] == "percentage" and x["options"] == ["percentage", "fixed"] for x in v))
check("G settings list has the commission amount", (c, s), 200, pred=lambda v: any(x["key"] == "commission.amount" and x["value"] == 0 and x["isDefault"] for x in v))
check("G no token -> 401", call("PATCH", "/admin/settings", None, {"settings": {"commission.amount": 5}}), 401)
check("G seller token -> 403", call("PATCH", "/admin/settings", S1, {"settings": {"commission.amount": 5}}), 403)
check("G type not allowed -> 400", set_global("flat", 5), 400)
check("G type not text -> 400", set_global(1, 5), 400)
check("G amount negative -> 400", set_global("percentage", -1), 400)
check("G amount 3 decimals -> 400", set_global("percentage", 5.123), 400)
check("G percentage over 100 -> 400", set_global("percentage", 100.5), 400)
check("G amount as text -> 400", set_global("percentage", "5"), 400)
check("G amount too large -> 400", set_global("fixed", 99999999999), 400)
check("G only amount over 100 while type is percentage -> 400", call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.amount": 150}}), 400)
check("G a fixed amount may be over 100", set_global("fixed", 150), 200, pred=lambda v: any(x["key"] == "commission.amount" and x["value"] == 150 for x in v))
check("G switching back to percentage with 150 stored is refused", call("PATCH", "/admin/settings", ADMIN, {"settings": {"commission.type": "percentage"}}), 400)
check("G global percentage 5", set_global("percentage", 5), 200, pred=lambda v: any(x["key"] == "commission.type" and x["value"] == "percentage" for x in v))
check("G 2 decimals are fine", set_global("percentage", 7.25), 200)
set_global("percentage", 5)

# ============================================================ R  seller rule: validation, history, access
V = f"/admin/commission/sellers/{SID1}/setting"
check("R view with no own rule shows the global one", call("GET", V, ADMIN), 200, pred=lambda v: v["setting"] is None and v["effective"]["source"] == "global" and v["effective"]["value"] == 5)
check("R no token -> 401", call("GET", V), 401)
check("R customer -> 403", call("GET", V, USER), 403)
check("R seller on the admin route -> 403", call("GET", V, S1), 403)
check("R unknown seller -> 404", call("GET", "/admin/commission/sellers/99999999/setting", ADMIN), 404)
check("R bad id -> 400", call("GET", "/admin/commission/sellers/abc/setting", ADMIN), 400)
check("R PUT unknown seller -> 404", put_rule(99999999, "percentage", 5), 404)
check("R PUT seller token -> 403", put_rule(SID1, "percentage", 5, S1), 403)
for bad in [("percentage", 101), ("percentage", -1), ("percentage", 5.555), ("fixed", -5), ("fixed", 99999999999), ("flat", 5), ("percentage", "x"), (None, 5), ("percentage", None)]:
    check(f"R PUT {bad} -> 400", put_rule(SID1, *bad), 400)
check("R PUT unknown field -> 400", call("PUT", V, ADMIN, {"commissionType": "fixed", "commissionAmount": 5, "x": 1}), 400)
check("R PUT empty -> 400", call("PUT", V, ADMIN, {}), 400)
check("R nothing stored by the failures", (200, sql(f"select count(*) from seller_setting where \"sellerId\"={SID1}")), 200, pred=lambda v: v == "0")
check("R PUT percentage 10 creates it", put_rule(SID1, "percentage", 10), 200, pred=lambda v: v["setting"]["commissionAmount"] == 10 and v["effective"]["source"] == "seller" and v["effective"]["type"] == "percentage")
check("R the same value again adds no history", put_rule(SID1, "percentage", 10), 200)
truth("R one history row so far", sql(f"select count(*) from seller_setting_history where \"sellerId\"={SID1}") == "1")
check("R PUT fixed 50 changes it", put_rule(SID1, "fixed", 50), 200, pred=lambda v: v["effective"]["type"] == "fixed" and v["effective"]["value"] == 50)
put_rule(SID1, "percentage", 10)
c, h = call("GET", f"/admin/commission/settings/history?sellerId={SID1}", ADMIN)
check("R history: created, updated, updated (newest first)", (c, h), 200, pred=lambda v: [r["action"] for r in v["results"]] == ["updated", "updated", "created"])
check("R history keeps before and after", (c, h), 200, pred=lambda v: v["results"][1]["fromValue"] == {"commissionType": "percentage", "commissionAmount": 10} and v["results"][1]["toValue"] == {"commissionType": "fixed", "commissionAmount": 50} and v["results"][0]["fromValue"]["commissionType"] == "fixed")
check("R history says who and when", (c, h), 200, pred=lambda v: v["results"][0]["changedByType"] == "admin" and v["results"][0]["changedByName"] and v["results"][0]["changedAt"] and v["results"][0]["sellerName"].startswith(TAG))
check("R history: created has no before", (c, h), 200, pred=lambda v: v["results"][2]["fromValue"] is None)
c, h1 = call("GET", f"/admin/commission/settings/history?sellerId={SID1}&limit=2", ADMIN)
check("R history cursor page 1", (c, h1), 200, pred=lambda v: len(v["results"]) == 2 and v["nextCursor"])
check("R history cursor page 2", call("GET", f"/admin/commission/settings/history?sellerId={SID1}&limit=2&cursor={h1['nextCursor']}", ADMIN), 200, pred=lambda v: len(v["results"]) == 1 and v["nextCursor"] is None)
check("R history filter by setting type", call("GET", f"/admin/commission/settings/history?sellerId={SID1}&settingType=commission", ADMIN), 200, pred=lambda v: len(v["results"]) == 3)
check("R history bad setting type -> 400", call("GET", "/admin/commission/settings/history?settingType=x", ADMIN), 400)
check("R history future date range is empty", call("GET", f"/admin/commission/settings/history?sellerId={SID1}&from=2999-01-01", ADMIN), 200, pred=lambda v: v["results"] == [])
check("R history bad cursor limit -> 400", call("GET", "/admin/commission/settings/history?limit=101", ADMIN), 400)
check("R history seller token -> 403", call("GET", "/admin/commission/settings/history", S1), 403)

# seller can read their own, never change
check("R seller sees own rule", call("GET", f"{CS}/setting", S1), 200, pred=lambda v: v["sellerId"] == SID1 and v["setting"]["commissionAmount"] == 10)
check("R seller 2 sees the global rule", call("GET", f"{CS}/setting", S2), 200, pred=lambda v: v["setting"] is None and v["effective"]["source"] == "global")
check("R seller cannot PUT their rule (no route)", call("PUT", f"{CS}/setting", S1, {"commissionType": "fixed", "commissionAmount": 0}), 404)
check("R seller cannot PATCH profile commission", multi("PATCH", "/seller/profile", S1, {"commissionType": "fixed", "commissionAmount": "0"}), 400)
check("R seller history shows only own", call("GET", f"{CS}/setting/history", S1), 200, pred=lambda v: len(v["results"]) == 3 and all(r["sellerId"] == SID1 for r in v["results"]))
check("R seller history ignores another sellerId", call("GET", f"{CS}/setting/history?sellerId={SID2}", S1), 200, pred=lambda v: all(r["sellerId"] == SID1 for r in v["results"]))
check("R seller 2 has no history", call("GET", f"{CS}/setting/history", S2), 200, pred=lambda v: v["results"] == [])
check("R customer on seller route -> 403", call("GET", f"{CS}/setting", USER), 403)
check("R no token -> 401", call("GET", f"{CS}/setting"), 401)

# create / update through the seller form
SELF = {"name": f"{TAG} Seller 333", "phone": f"+88017{RUN_NUM}444", "password": "Passw0rd!x"}
check("R create seller with only a type -> 400", multi("POST", "/admin/seller", ADMIN, {**SELF, "commissionType": "fixed"}), 400)
check("R create seller with only an amount -> 400", multi("POST", "/admin/seller", ADMIN, {**SELF, "commissionAmount": "5"}), 400)
check("R create seller with 3 decimals -> 400", multi("POST", "/admin/seller", ADMIN, {**SELF, "commissionType": "fixed", "commissionAmount": "5.123"}), 400)
check("R create seller with percentage 120 -> 400", multi("POST", "/admin/seller", ADMIN, {**SELF, "commissionType": "percentage", "commissionAmount": "120"}), 400)
truth("R none of those created a seller", sql(f"select count(*) from seller where name='{TAG} Seller 333'") == "0")
c, ns = multi("POST", "/admin/seller", ADMIN, {**SELF, "commissionType": "percentage", "commissionAmount": "12.5"})
check("R create seller with a commission", (c, ns), 201, pred=lambda v: "commissionRate" not in v)
SID3 = int(sql(f"select id from seller where name='{TAG} Seller 333'"))
check("R the new seller has that rule", call("GET", f"/admin/commission/sellers/{SID3}/setting", ADMIN), 200, pred=lambda v: v["effective"] == {"type": "percentage", "value": 12.5, "source": "seller"})
truth("R and a 'created' history row", sql(f"select action from seller_setting_history where \"sellerId\"={SID3}") == "created")
check("R seller details show the effective rule", call("GET", f"/admin/seller/{SID3}", ADMIN), 200, pred=lambda v: v["commission"]["value"] == 12.5 and "commissionRate" not in v)
check("R seller list shows each rule", call("GET", f"/admin/seller?search=T%20Com", ADMIN), 200, pred=lambda v: {r["id"]: r["commission"]["source"] for r in v["results"]}.get(SID3) == "seller" and {r["id"]: r["commission"]["source"] for r in v["results"]}.get(SID2) == "global")
check("R update seller commission", multi("PATCH", f"/admin/seller/{SID3}", ADMIN, {"commissionType": "fixed", "commissionAmount": "20"}), 200)
check("R update changes the rule and logs it", call("GET", f"/admin/commission/settings/history?sellerId={SID3}", ADMIN), 200, pred=lambda v: [r["action"] for r in v["results"]] == ["updated", "created"] and v["results"][0]["toValue"]["commissionAmount"] == 20)
check("R update with one field -> 400", multi("PATCH", f"/admin/seller/{SID3}", ADMIN, {"commissionAmount": "30"}), 400)
check("R update without commission leaves it", multi("PATCH", f"/admin/seller/{SID3}", ADMIN, {"name": f"{TAG} Seller 333b"}), 200)
check("R still the same rule, no extra history", call("GET", f"/admin/commission/settings/history?sellerId={SID3}", ADMIN), 200, pred=lambda v: len(v["results"]) == 2)
check("R old commissionRate field is refused", multi("PATCH", f"/admin/seller/{SID3}", ADMIN, {"commissionRate": "5"}), 400)

# ============================================================ O  commission on every order flow
call("PATCH", "/admin/settings", ADMIN, {"settings": {"shipping.defaultCharge": 100}})
o = place(94, 119, 2)          # seller 1: percentage 10; subtotal 6400, payable 6500
check("O customer order carries commission on the subtotal (10% of 6400)", (200, row(o["id"])), 200, pred=lambda v: v == ["640", "5860", "6500", "percentage", "10"])
o2 = place(95, 122, 1)         # seller 2: global 5%; subtotal 3000 -> 150
check("O no own rule: the global rule applies (5% of 3000)", (200, row(o2["id"])), 200, pred=lambda v: v == ["150", "3150", "3100", "percentage", "5"] or v[0] == "150")
oa = staff_order("admin", SID1)
check("O admin-created order uses the same rule", (200, row(oa["id"])), 200, pred=lambda v: v[:2] == ["640", "5860"])
os_ = staff_order("seller", SID1)
check("O seller-created order uses the same rule", (200, row(os_["id"])), 200, pred=lambda v: v[:2] == ["640", "5860"])
oa2 = staff_order("admin", SID2, 95, 122, 1)
check("O admin order for a seller with no rule uses global", (200, row(oa2["id"])), 200, pred=lambda v: v[0] == "150")
put_rule(SID1, "fixed", 50)
of = place(94, 119, 1)
check("O fixed amount is per order line (one line here)", (200, row(of["id"])), 200, pred=lambda v: v[0] == "50" and v[3] == "fixed")
check("O a later rule change does not touch an old order", (200, row(o["id"])), 200, pred=lambda v: v[:2] == ["640", "5860"])
put_rule(SID1, "fixed", 999999)
oc = place(94, 119, 1)
check("O commission never goes above what the line is payable at (delivery stays with the seller)", (200, row(oc["id"])), 200, pred=lambda v: float(v[0]) == float(v[2]) - 100 and float(v[1]) == 100)
put_rule(SID1, "percentage", 0)
oz = place(94, 119, 1)
check("O zero percent -> zero commission", (200, row(oz["id"])), 200, pred=lambda v: v[0] == "0" and v[1] == v[2])
put_rule(SID1, "percentage", 33.33)
ot = place(94, 119, 1)     # 3200 * 33.33% = 1066.56
check("O two-decimal rounding", (200, row(ot["id"])), 200, pred=lambda v: v[0] == "1066.56" and v[1] == str(round(3300 - 1066.56, 2)))
put_rule(SID1, "percentage", 10)
check("O customer never sees commission", call("GET", f"/user/order/{o['id']}", USER), [200, 404])
cu = call("GET", f"/user/order/{o['id']}", None, session=None)
check("O admin sees it on the order", call("GET", f"{A}/{o['id']}", ADMIN), 200, pred=lambda v: v["commission"]["systemCommission"] == 640 and v["commission"]["sellerAmount"] == 5860 and v["commission"]["type"] == "percentage")
check("O seller sees it on the order", call("GET", f"{SL}/{o['id']}", S1), 200, pred=lambda v: v["commission"]["systemCommission"] == 640)
sg = sess()
cart_id = call("POST", CART + "/items", body={"sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 1}, session=sg)[1]["cart"]["id"]
og = call("POST", f"{CK}/{cart_id}/place", session=sg, body=addr())[1]
check("O guest order response has no commission", (200, og), 200, pred=lambda v: "commission" not in v and "systemCommission" not in json.dumps(v))
truth("O nothing is earned before payment", bal(SID1) == [0.0, 0.0, 0.0] and live(o["id"]) == 0, bal(SID1))

# ============================================================ L  ledger: earn, partial, reverse, cancel, reopen
c, r = pay(o["id"], 1000)
check("L a part payment is accepted", (c, r), 201)
truth("L part payment earns nothing", bal(SID1) == [0.0, 0.0, 0.0] and live(o["id"]) == 0, bal(SID1))
c, r = pay(o["id"])
check("L the rest completes it", (c, r), 201)
truth("L full payment earns the commission once", bal(SID1) == [640.0, 640.0, 0.0] and live(o["id"]) == 1, bal(SID1))
c, hist = call("GET", f"{CA}/history?orderId={o['id']}", ADMIN)
check("L ledger row: type, amount, status, balance after", (c, hist), 200, pred=lambda v: len(v["results"]) == 1 and v["results"][0]["type"] == "order_commission" and v["results"][0]["totalAmount"] == 640 and v["results"][0]["paymentStatus"] == "paid" and v["results"][0]["dueAfter"] == 640 and v["results"][0]["orderNumber"] == o["orderNumber"] and v["results"][0]["orderSubtotal"] == 6400)
check("L paying again -> 409 and nothing doubled", pay(o["id"]), 409)
truth("L still one live row", live(o["id"]) == 1 and bal(SID1)[0] == 640.0)
pid = payment_id(o["id"])
check("L reverse the last payment", reverse(o["id"], pid), 201)
truth("L reversal pulls the order out of paid, commission goes", bal(SID1) == [0.0, 0.0, 0.0] and live(o["id"]) == 0 and voided(o["id"]) == 1, bal(SID1))
check("L voided row is kept and shows why", call("GET", f"{CA}/history?orderId={o['id']}&voided=true", ADMIN), 200, pred=lambda v: len(v["results"]) == 1 and v["results"][0]["voidedAt"] and "Wrong entry" in v["results"][0]["voidReason"])
check("L live filter hides it", call("GET", f"{CA}/history?orderId={o['id']}&voided=false", ADMIN), 200, pred=lambda v: v["results"] == [])
check("L without a filter both show", call("GET", f"{CA}/history?orderId={o['id']}", ADMIN), 200, pred=lambda v: len(v["results"]) == 1)
c, r = pay(o["id"])
truth("L pay the balance again: earned again as a new row", bal(SID1) == [640.0, 640.0, 0.0] and live(o["id"]) == 1 and voided(o["id"]) == 1, (bal(SID1), c, r))
check("L cancel a paid order", call("PATCH", f"{A}/{o['id']}/status", ADMIN, {"status": "cancelled"}), 200)
truth("L cancelling takes the commission back", bal(SID1) == [0.0, 0.0, 0.0] and live(o["id"]) == 0 and voided(o["id"]) == 2, bal(SID1))
check("L reopen the cancelled paid order", call("PATCH", f"{A}/{o['id']}/status", ADMIN, {"status": "pending"}), 200)
truth("L reopening earns it again", bal(SID1) == [640.0, 640.0, 0.0] and live(o["id"]) == 1, bal(SID1))
check("L cancelling an unpaid order changes nothing", call("PATCH", f"{A}/{oa['id']}/status", ADMIN, {"status": "cancelled"}), 200)
truth("L balance unchanged", bal(SID1) == [640.0, 640.0, 0.0], bal(SID1))
c, r = pay(os_["id"], None, "seller")
check("L a seller can record the payment too", (c, r), 201)
truth("L and the commission is earned (seller flow)", bal(SID1) == [1280.0, 1280.0, 0.0] and live(os_["id"]) == 1, bal(SID1))
c, r = pay(o2["id"])
truth("L other seller is separate", bal(SID2)[0] == 150.0 and bal(SID1)[0] == 1280.0, (bal(SID1), bal(SID2)))
pay(of["id"])  # commission 50 (fixed) -> only if recorded; of was placed with fixed 50
truth("L fixed amount order earns 50", bal(SID1) == [1330.0, 1330.0, 0.0], bal(SID1))

# ============================================================ D  disbursement
D1 = f"{CA}/balances/{SID1}/disbursements"
def disb(amount, tok=None, sid=SID1, files=None, notes=None, **extra):
    f = {}
    if amount is not None:
        f["amount"] = amount
    if notes is not None:
        f["notes"] = notes
    f.update(extra)
    return multi("POST", f"{CA}/balances/{sid}/disbursements", tok or ADMIN, f, files)

check("D no token -> 401", disb(10, "x"), 401) if False else None
check("D no token -> 401", multi("POST", D1, None, {"amount": "10"}), 401)
check("D customer -> 403", disb(10, USER), 403)
check("D seller -> 403", disb(10, S1), 403)
check("D unknown seller -> 404", disb(10, sid=99999999), 404)
check("D bad seller id -> 400", multi("POST", f"{CA}/balances/abc/disbursements", ADMIN, {"amount": "10"}), 400)
check("D no amount -> 400", disb(None), 400)
for bad in ["0", "-5", "abc", "10.555", "99999999999", "NaN", "Infinity", ""]:
    check(f"D amount {bad!r} -> 400", disb(bad), 400)
check("D more than due -> 409", disb("1330.01"), 409)
check("D unknown field -> 400", disb(10, status="paid"), 400)
check("D notes too long -> 400", disb(10, notes="n" * 1001), 400)
check("D bad attachment -> 400", disb(10, files=[("run.exe", b"MZ\x90\x00", "application/octet-stream")]), 400)
check("D 11 files -> 400", disb(10, files=[("a.png", PNG, "image/png")] * 11), 400)
check("D seller with no balance -> 409", disb(10, sid=SID3), 409)
truth("D failures changed nothing", bal(SID1) == [1330.0, 1330.0, 0.0] and sql(f"select count(*) from system_commission_disburse where \"sellerId\"={SID1}") == "0", bal(SID1))
c, r = disb("330", notes="First bank transfer")
check("D record a payment, no attachment", (c, r), 201, pred=lambda v: v["sellerId"] == SID1 and v["disburseId"] > 0)
truth("D due down, paid up, total unchanged", bal(SID1) == [1330.0, 1000.0, 330.0], bal(SID1))
DID1 = r["disburseId"]
c, dd = call("GET", f"{CA}/disbursements/{DID1}", ADMIN)
check("D details: amount and balance snapshots", (c, dd), 200, pred=lambda v: v["amount"] == 330 and v["totalAmount"] == 1330 and v["dueAmount"] == 1000 and v["paidAmount"] == 330 and v["notes"] == "First bank transfer" and v["attachments"] == [] and v["sellerName"].startswith(TAG))
c, r = disb("500.50", files=[("slip.png", PNG, "image/png"), ("note.txt", b"bank ref 1\n", "text/plain")])
check("D a payment with two attachments", (c, r), 201)
DID2 = r["disburseId"]
truth("D balance after the second", bal(SID1) == [1330.0, 499.5, 830.5], bal(SID1))
check("D details list the files", call("GET", f"{CA}/disbursements/{DID2}", ADMIN), 200, pred=lambda v: [a["kind"] for a in v["attachments"]] == ["image", "file"] and v["attachments"][0]["url"].startswith("http") and v["dueAmount"] == 499.5)
check("D each payment wrote a ledger row", call("GET", f"{CA}/history?sellerId={SID1}&type=commission_payment", ADMIN), 200, pred=lambda v: len(v["results"]) == 2 and v["results"][0]["totalAmount"] == 500.5 and v["results"][0]["disburseId"] == DID2 and v["results"][0]["orderId"] is None and v["results"][0]["paidAfter"] == 830.5)
check("D over the new due -> 409", disb("499.51"), 409)
check("D unknown disbursement -> 404", call("GET", f"{CA}/disbursements/99999999", ADMIN), 404)
check("D bad disbursement id -> 400", call("GET", f"{CA}/disbursements/abc", ADMIN), 400)

# reversal after money was handed over: due drops below zero (credit), total = due + paid still holds
oo = place(94, 119, 1)
put_rule(SID1, "percentage", 10)
oo = place(94, 119, 1)   # 10% of 3200 = 320
pay(oo["id"])
truth("D new order commission raised due", bal(SID1) == [1650.0, 819.5, 830.5], bal(SID1))
pidoo = payment_id(oo["id"])
reverse(oo["id"], pidoo)
truth("D reversal restores", bal(SID1) == [1330.0, 499.5, 830.5], bal(SID1))
# pay out all that is due
check("D pay the exact remaining due", disb("499.5"), 201)
truth("D due is zero, paid is the whole", bal(SID1) == [1330.0, 0.0, 1330.0], bal(SID1))
check("D nothing due -> 409", disb("0.01"), 409)
pay(oo["id"])  # earn 320 again: due 320
truth("D earning after a clear balance", bal(SID1) == [1650.0, 320.0, 1330.0], bal(SID1))
reverse(oo["id"], payment_id(oo["id"]))
truth("D reversal returns to cleared", bal(SID1) == [1330.0, 0.0, 1330.0], bal(SID1))
# an order earned before, whose commission was already paid out, then cancelled: due goes below zero
check("D cancel a paid order after the seller already paid", call("PATCH", f"{A}/{os_['id']}/status", ADMIN, {"status": "cancelled"}), 200)
truth("D due below zero means a credit; total = due + paid", bal(SID1) == [690.0, -640.0, 1330.0] or abs(bal(SID1)[0] - (bal(SID1)[1] + bal(SID1)[2])) < 0.001, bal(SID1))
check("D no due while in credit -> 409", disb("1"), 409)
call("PATCH", f"{A}/{os_['id']}/status", ADMIN, {"status": "pending"})
truth("D reopening restores", bal(SID1) == [1330.0, 0.0, 1330.0], bal(SID1))

# ============================================================ Q  lists, filters, seller scope
c, b = call("GET", f"{CA}/balances", ADMIN)
check("Q admin balances list", (c, b), 200, pred=lambda v: {r["sellerId"] for r in v["results"]} >= {SID1, SID2} and all("sellerName" in r for r in v["results"]))
check("Q filter by seller", call("GET", f"{CA}/balances?sellerId={SID2}", ADMIN), 200, pred=lambda v: [r["sellerId"] for r in v["results"]] == [SID2] and v["results"][0]["dueCommission"] == 150)
check("Q filter status=due", call("GET", f"{CA}/balances?status=due&search=T%20Com", ADMIN), 200, pred=lambda v: [r["sellerId"] for r in v["results"]] == [SID2])
check("Q filter status=cleared", call("GET", f"{CA}/balances?status=cleared&search=T%20Com", ADMIN), 200, pred=lambda v: [r["sellerId"] for r in v["results"]] == [SID1])
check("Q bad status -> 400", call("GET", f"{CA}/balances?status=x", ADMIN), 400)
check("Q search by name", call("GET", f"{CA}/balances?search=Seller%20222", ADMIN), 200, pred=lambda v: [r["sellerId"] for r in v["results"]] == [SID2])
check("Q percent in search is not a wildcard", call("GET", f"{CA}/balances?search=%25", ADMIN), 200, pred=lambda v: v["results"] == [])
c, p1 = call("GET", f"{CA}/balances?limit=1", ADMIN)
check("Q balances cursor page 1", (c, p1), 200, pred=lambda v: len(v["results"]) == 1 and v["nextCursor"])
check("Q balances cursor page 2", call("GET", f"{CA}/balances?limit=1&cursor={p1['nextCursor']}", ADMIN), 200, pred=lambda v: len(v["results"]) == 1 and v["results"][0]["id"] < p1["results"][0]["id"])
check("Q limit 101 -> 400", call("GET", f"{CA}/balances?limit=101", ADMIN), 400)
check("Q admin one seller balance with the rule", call("GET", f"{CA}/balances/{SID1}", ADMIN), 200, pred=lambda v: v["totalCommission"] == 1330 and v["paidCommission"] == 1330 and v["commission"]["effective"]["value"] == 10)
check("Q seller with no row shows zeros", call("GET", f"{CA}/balances/{SID3}", ADMIN), 200, pred=lambda v: v["totalCommission"] == 0 and v["dueCommission"] == 0)
check("Q unknown seller balance -> 404", call("GET", f"{CA}/balances/99999999", ADMIN), 404)
check("Q history filter by seller", call("GET", f"{CA}/history?sellerId={SID2}", ADMIN), 200, pred=lambda v: len(v["results"]) == 1 and v["results"][0]["orderId"] == o2["id"])
check("Q history filter by type", call("GET", f"{CA}/history?sellerId={SID1}&type=order_commission&voided=false", ADMIN), 200, pred=lambda v: all(r["type"] == "order_commission" and r["voidedAt"] is None for r in v["results"]))
check("Q history bad type -> 400", call("GET", f"{CA}/history?type=x", ADMIN), 400)
check("Q history filter by payment status", call("GET", f"{CA}/history?sellerId={SID1}&paymentStatus=paid", ADMIN), 200, pred=lambda v: len(v["results"]) > 0)
check("Q history unknown payment status -> 400", call("GET", f"{CA}/history?paymentStatus=nope", ADMIN), 400)
check("Q history date range", call("GET", f"{CA}/history?sellerId={SID1}&from=2999-01-01", ADMIN), 200, pred=lambda v: v["results"] == [])
check("Q history bad date -> 400", call("GET", f"{CA}/history?from=yesterday", ADMIN), 400)
c, hp = call("GET", f"{CA}/history?sellerId={SID1}&limit=2", ADMIN)
check("Q history cursor", call("GET", f"{CA}/history?sellerId={SID1}&limit=2&cursor={hp['nextCursor']}", ADMIN), 200, pred=lambda v: all(r["id"] < hp["results"][-1]["id"] for r in v["results"]))
check("Q disbursement list", call("GET", f"{CA}/disbursements?sellerId={SID1}", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]][:2] == [r["id"] for r in sorted(v["results"], key=lambda x: -x["id"])][:2] and len(v["results"]) == 3 and "attachmentCount" in v["results"][0])
check("Q disbursement attachment count", call("GET", f"{CA}/disbursements?sellerId={SID1}", ADMIN), 200, pred=lambda v: {r["id"]: r["attachmentCount"] for r in v["results"]}[DID2] == 2)
check("Q disbursement filter by amount", call("GET", f"{CA}/disbursements?sellerId={SID1}&minAmount=400", ADMIN), 200, pred=lambda v: len(v["results"]) == 2)
check("Q disbursement filter by amount range", call("GET", f"{CA}/disbursements?sellerId={SID1}&minAmount=400&maxAmount=500", ADMIN), 200, pred=lambda v: [r["amount"] for r in v["results"]] == [499.5] or [r["amount"] for r in v["results"]] == [500.5, 499.5][:len(v["results"])])
check("Q disbursement filter by dates", call("GET", f"{CA}/disbursements?sellerId={SID1}&from=2999-01-01", ADMIN), 200, pred=lambda v: v["results"] == [])
check("Q disbursement cursor", call("GET", f"{CA}/disbursements?sellerId={SID1}&limit=1", ADMIN), 200, pred=lambda v: len(v["results"]) == 1 and v["nextCursor"])
check("Q disbursement bad amount filter -> 400", call("GET", f"{CA}/disbursements?minAmount=abc", ADMIN), 400)
for path in ["balances", "history", "disbursements"]:
    check(f"Q no token on admin {path} -> 401", call("GET", f"{CA}/{path}"), 401)
    check(f"Q seller on admin {path} -> 403", call("GET", f"{CA}/{path}", S1), 403)
    check(f"Q customer on admin {path} -> 403", call("GET", f"{CA}/{path}", USER), 403)
    check(f"Q no token on seller {path} -> 401", call("GET", f"{CS}/{path if path != 'balances' else 'balance'}"), 401)
    check(f"Q admin on seller {path} -> 403", call("GET", f"{CS}/{path if path != 'balances' else 'balance'}", ADMIN), 403)

check("Q seller balance", call("GET", f"{CS}/balance", S1), 200, pred=lambda v: v["sellerId"] == SID1 and v["totalCommission"] == 1330 and v["dueCommission"] == 0 and v["paidCommission"] == 1330)
check("Q seller 2 balance", call("GET", f"{CS}/balance", S2), 200, pred=lambda v: v["sellerId"] == SID2 and v["dueCommission"] == 150 and v["paidCommission"] == 0)
check("Q seller ledger is theirs only", call("GET", f"{CS}/history", S1), 200, pred=lambda v: v["results"] and all(r["sellerId"] == SID1 for r in v["results"]))
check("Q seller cannot widen the ledger with sellerId", call("GET", f"{CS}/history?sellerId={SID2}", S1), 200, pred=lambda v: all(r["sellerId"] == SID1 for r in v["results"]))
check("Q seller 2 ledger is theirs only", call("GET", f"{CS}/history", S2), 200, pred=lambda v: all(r["sellerId"] == SID2 for r in v["results"]) and len(v["results"]) == 1)
check("Q seller ledger links to the order", call("GET", f"{CS}/history?type=order_commission&voided=false", S1), 200, pred=lambda v: all(r["orderId"] and r["orderNumber"] for r in v["results"]))
check("Q seller sees their payments", call("GET", f"{CS}/disbursements", S1), 200, pred=lambda v: len(v["results"]) == 3 and all(r["sellerId"] == SID1 for r in v["results"]))
check("Q seller 2 has none", call("GET", f"{CS}/disbursements", S2), 200, pred=lambda v: v["results"] == [])
check("Q seller sees one payment with files", call("GET", f"{CS}/disbursements/{DID2}", S1), 200, pred=lambda v: v["amount"] == 500.5 and len(v["attachments"]) == 2 and v["totalAmount"] == 1330 and v["dueAmount"] == 499.5 and v["paidAmount"] == 830.5)
check("Q seller notes visible", call("GET", f"{CS}/disbursements/{DID1}", S1), 200, pred=lambda v: v["notes"] == "First bank transfer")
check("Q another seller's payment -> 404", call("GET", f"{CS}/disbursements/{DID1}", S2), 404)
check("Q seller cannot record a payment", multi("POST", f"{CS}/balances/{SID1}/disbursements", S1, {"amount": "1"}), 404)
check("Q seller disbursement unknown id -> 404", call("GET", f"{CS}/disbursements/99999999", S1), 404)
sql(f"update seller set \"activeStatus\"='suspended' where id={SID2}")
check("Q a suspended seller can still read what they owe", call("GET", f"{CS}/balance", S2), 200, pred=lambda v: v["dueCommission"] == 150)
sql(f"update seller set \"activeStatus\"='active' where id={SID2}")

# ============================================================ C  concurrency
with cf.ThreadPoolExecutor(8) as ex:
    rs = list(ex.map(lambda _: disb("25", sid=SID2), range(8)))
codes = sorted(r[0] for r in rs)
truth("C 8 parallel payments of 25 against 150 due: exactly 6 succeed", codes.count(201) == 6 and codes.count(409) == 2, codes)
truth("C balance is exactly settled", bal(SID2) == [150.0, 0.0, 150.0], bal(SID2))
truth("C six payment rows", sql(f"select count(*) from system_commission_disburse where \"sellerId\"={SID2}") == "6")
op = [place(95, 122, 1) for _ in range(6)]
with cf.ThreadPoolExecutor(6) as ex:
    list(ex.map(lambda x: pay(x["id"]), op))
truth("C 6 orders paid in parallel earn 6 x 150 = 900 on top of 150, exactly once each", abs(bal(SID2)[0] - 1050.0) < 0.001 and all(live(x["id"]) == 1 for x in op), (bal(SID2), [live(x["id"]) for x in op]))
pid_x = payment_id(op[0]["id"])
with cf.ThreadPoolExecutor(5) as ex:
    rr = list(ex.map(lambda _: reverse(op[0]["id"], pid_x), range(5)))
truth("C 5 parallel reversals of one payment: one wins", [r[0] for r in rr].count(201) == 1, [r[0] for r in rr])
truth("C and the commission left once", abs(bal(SID2)[0] - 900.0) < 0.001 and live(op[0]["id"]) == 0 and voided(op[0]["id"]) == 1, bal(SID2))

# ============================================================ I  invariants over everything the test touched
for sid, name in [(SID1, "seller 1"), (SID2, "seller 2")]:
    t, du, pa = bal(sid)
    truth(f"I {name}: total = due + paid ({t} = {du} + {pa})", abs(t - (du + pa)) < 0.005)
    earned = float(sql(f"select coalesce(sum(\"totalAmount\"),0) from system_commission_history where \"sellerId\"={sid} and type='order_commission' and \"deletedAt\" is null"))
    paid = float(sql(f"select coalesce(sum(amount),0) from system_commission_disburse where \"sellerId\"={sid}"))
    truth(f"I {name}: total equals live order rows ({t} = {earned})", abs(t - earned) < 0.005)
    truth(f"I {name}: paid equals the payments ({pa} = {paid})", abs(pa - paid) < 0.005)
    owed = float(sql(f"select coalesce(sum(\"systemCommission\"),0) from \"order\" where \"sellerId\"={sid} and \"paymentStatus\"='paid' and status<>'cancelled'"))
    truth(f"I {name}: total equals commission on paid, not-cancelled orders ({t} = {owed})", abs(t - owed) < 0.005)
truth("I order: sellerAmount + systemCommission = payableAmount everywhere", sql(f"select count(*) from \"order\" where \"sellerId\" in ({SID1},{SID2}) and abs(\"sellerAmount\" + \"systemCommission\" - \"payableAmount\") > 0.005") == "0")
truth("I order: commission never negative, sellerAmount never negative", sql(f"select count(*) from \"order\" where \"sellerId\" in ({SID1},{SID2}) and (\"systemCommission\" < 0 or \"sellerAmount\" < 0)") == "0")
truth("I ledger: never two live rows for one order", sql("select count(*) from (select \"orderId\" from system_commission_history where type='order_commission' and \"deletedAt\" is null group by \"orderId\" having count(*) > 1) x") == "0")
truth("I ledger: voided rows all say why", sql(f"select count(*) from system_commission_history where \"sellerId\" in ({SID1},{SID2}) and \"deletedAt\" is not null and \"voidReason\" is null") == "0")
truth("I every disbursement balance snapshot adds up", sql("select count(*) from system_commission_disburse where abs(\"totalAmount\" - \"dueAmount\" - \"paidAmount\") > 0.005 and \"sellerId\" = " + str(SID1)) == "0")

# ============================================================ summary
cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, dd)
sys.exit(1 if failed else 0)
