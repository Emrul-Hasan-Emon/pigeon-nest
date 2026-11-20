#!/usr/bin/env python3
"""Black-box tests: admin payment gateways, global settings, countries, shipping zones and quotes."""
import json, os, struct, subprocess, sys, tempfile, zlib

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
TMP = tempfile.mkdtemp(prefix="commerce-test-")
results = []


def call(method, path, token=None, body=None, form=None):
    cmd = ["curl", "-s", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    for k, v in form or []:
        cmd += ["-F", f"{k}={v}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
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


def png(name):
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    raw = b"\x00" + b"\xff\x00\x00"
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    p = os.path.join(TMP, name)
    open(p, "wb").write(data)
    return p


def blob(name, size):
    p = os.path.join(TMP, name)
    open(p, "wb").write(b"\x89PNG\r\n\x1a\n" + b"0" * size)
    return p


c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
A = d["accessToken"]
ICON = png("icon.png")


def cleanup():
    sql("delete from \"order\" where \"orderNumber\" like 'T-%'")
    sql("delete from payment_gateway where name like 'T %' or slug like 't-%' or name ilike 'cash on delivery%' and slug <> 'cash-on-delivery'")
    sql("delete from shipping_zone")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")
    sql("update system_setting set value='7' where key='shipping.defaultEstimatedDays'")
    sql("update system_setting set value='true' where key='shipping.defaultSupportsLiveAnimal'")


cleanup()
G = "/admin/payment-gateways"

# ================================================================= A gateways: auth + seed
check("A no token -> 401", call("GET", G), 401)
check("A gateway type rules", call("GET", G + "/types", A), 200, pred=lambda v: [t["type"] for t in v] == ["cod", "mfs", "bank", "card", "manual"] and next(t for t in v if t["type"] == "bank")["requiredFields"] == ["accountName", "accountNumber", "bankName"] and next(t for t in v if t["type"] == "manual")["needsDescription"] is True and next(t for t in v if t["type"] == "cod")["proofFields"] == [])
check("A COD gateway is seeded", call("GET", G + "?type=cod", A), 200, pred=lambda v: any(r["slug"] == "cash-on-delivery" and r["isActive"] and r["proofFields"] == [] for r in v["results"]))

# ================================================================= B gateway validation
def gw(name="T Gateway", type="mfs", extra=None, icon=None):
    f = [("name", name), ("type", type)] + (extra or [])
    if icon:
        f.append(("icon", "@" + icon))
    return f


check("B missing name -> 400", call("POST", G, A, form=[("type", "cod")]), 400)
check("B blank name -> 400", call("POST", G, A, form=gw("   ", "cod")), 400)
check("B bad type -> 400", call("POST", G, A, form=gw("T X", "paypal")), 400)
check("B missing type -> 400", call("POST", G, A, form=[("name", "T X")]), 400)
check("B name too long -> 400", call("POST", G, A, form=gw("T " + "a" * 260, "cod")), 400)
check("B unknown field -> 400", call("POST", G, A, form=gw("T X", "cod", [("foo", "1")])), 400)
check("B isActive 'yes' -> 400", call("POST", G, A, form=gw("T X", "cod", [("isActive", "yes")])), 400)
check("B mfs needs accountNumber -> 400", call("POST", G, A, form=gw("T Mfs", "mfs")), 400)
check("B mfs rejects bankName -> 400", call("POST", G, A, form=gw("T Mfs", "mfs", [("accountNumber", "017"), ("bankName", "X")])), 400)
check("B bank needs bankName -> 400", call("POST", G, A, form=gw("T Bank", "bank", [("accountName", "A"), ("accountNumber", "1")])), 400)
check("B bank needs accountName -> 400", call("POST", G, A, form=gw("T Bank", "bank", [("accountNumber", "1"), ("bankName", "B")])), 400)
check("B cod rejects account details -> 400", call("POST", G, A, form=gw("T Cod", "cod", [("accountNumber", "1")])), 400)
check("B card rejects account details -> 400", call("POST", G, A, form=gw("T Card", "card", [("accountName", "x")])), 400)
check("B manual needs instructions -> 400", call("POST", G, A, form=gw("T Manual", "manual")), 400)
check("B description too long -> 400", call("POST", G, A, form=gw("T Manual", "manual", [("description", "d" * 2001)])), 400)
check("B non-image icon -> 400", call("POST", G, A, form=gw("T Ic", "cod", icon=blob("x.txt", 10))), 400)
check("B icon over 2MB -> 413", call("POST", G, A, form=gw("T Big", "cod", icon=blob("big.png", 2 * 1024 * 1024 + 1000))), 413)
check("B nothing created by the failures", (200, sql("select count(*) from payment_gateway where name like 'T %'")), 200, pred=lambda v: v == "0")

# ================================================================= C gateway CRUD
c, mfs = call("POST", G, A, form=gw("T bKash", "mfs", [("accountNumber", "01700000000"), ("accountName", "Pigeon Nest"), ("description", "Send money, then enter the transaction ID.")], ICON))
check("C create mfs with icon -> 201", (c, mfs), 201, pred=lambda v: v["slug"] == "t-bkash" and v["isActive"] is True and v["iconUrl"] and [p["key"] for p in v["proofFields"]] == ["transactionId"])
c, bank = call("POST", G, A, form=gw("T City Bank", "bank", [("accountName", "Pigeon Nest Ltd"), ("accountNumber", "123"), ("bankName", "City"), ("branchName", "Gulshan"), ("isActive", "false")]))
check("C create bank inactive -> 201", (c, bank), 201, pred=lambda v: v["isActive"] is False and [p["key"] for p in v["proofFields"]] == ["senderName", "transactionReference"])
c, cod2 = call("POST", G, A, form=gw("T Pay later", "cod"))
check("C create cod -> 201, no proof fields", (c, cod2), 201, pred=lambda v: v["proofFields"] == [])
c, man = call("POST", G, A, form=gw("T Wire", "manual", [("description", "Contact us to arrange payment.")]))
check("C create manual -> 201", (c, man), 201, pred=lambda v: v["type"] == "manual")
check("C create card -> 201", call("POST", G, A, form=gw("T Card pay", "card")), 201)
check("C duplicate name -> 409", call("POST", G, A, form=gw("T bKash", "cod")), 409)
check("C duplicate name is case-insensitive -> 409", call("POST", G, A, form=gw("t BKASH", "cod")), 409)
check("C same slug, different name gets a unique slug", call("POST", G, A, form=gw("T-bKash!", "cod")), 201, pred=lambda v: v["slug"] == "t-bkash-2")
check("C the icon file exists", (200, os.path.exists(os.path.join(UPLOADS, mfs["iconUrl"].split("/uploads/")[1]))), 200, pred=lambda v: v is True)
check("C details", call("GET", f"{G}/{mfs['id']}", A), 200, pred=lambda v: v["accountNumber"] == "01700000000")
check("C details leaks no internals", call("GET", f"{G}/{mfs['id']}", A), 200, pred=lambda v: "provider" not in v and "isManual" not in v and "iconPath" not in v)
check("C details missing -> 404", call("GET", G + "/99999999", A), 404)
check("C details bad id -> 400", call("GET", G + "/abc", A), 400)

c, listing = call("GET", G + "?search=T&limit=100", A)
check("C list newest first", (c, listing), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted((r["id"] for r in v["results"]), reverse=True))
check("C filter type", call("GET", G + "?type=bank&search=T", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [bank["id"]])
check("C filter isActive=false", call("GET", G + "?isActive=false&search=T", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [bank["id"]])
check("C filter search", call("GET", G + "?search=city", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [bank["id"]])
check("C search % literal", call("GET", G + "?search=%25", A), 200, pred=lambda v: v["results"] == [])
check("C bad type filter -> 400", call("GET", G + "?type=zzz", A), 400)
seen, cursor = [], 0
for _ in range(20):
    c, v = call("GET", f"{G}?limit=2&cursor={cursor}", A)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("C cursor paging visits every gateway once", (200, seen), 200, pred=lambda v: len(v) == len(set(v)) == int(sql("select count(*) from payment_gateway")))

check("C patch name keeps the slug", call("PATCH", f"{G}/{mfs['id']}", A, form=[("name", "T bKash Personal")]), 200, pred=lambda v: v["name"] == "T bKash Personal" and v["slug"] == "t-bkash")
check("C patch to an existing name -> 409", call("PATCH", f"{G}/{mfs['id']}", A, form=[("name", "t city bank")]), 409)
check("C patch own name in new case ok", call("PATCH", f"{G}/{mfs['id']}", A, form=[("name", "t bkash personal")]), 200)
check("C patch isActive false", call("PATCH", f"{G}/{mfs['id']}", A, form=[("isActive", "false")]), 200, pred=lambda v: v["isActive"] is False)
check("C patch isActive junk -> 400", call("PATCH", f"{G}/{mfs['id']}", A, form=[("isActive", "maybe")]), 400)
check("C patch type to bank without its fields -> 400", call("PATCH", f"{G}/{mfs['id']}", A, form=[("type", "bank")]), 400)
check("C patch type to bank with its fields", call("PATCH", f"{G}/{mfs['id']}", A, form=[("type", "bank"), ("accountName", "N"), ("bankName", "B")]), 200, pred=lambda v: v["type"] == "bank")
check("C patch back to mfs must clear bank details -> 400", call("PATCH", f"{G}/{mfs['id']}", A, form=[("type", "mfs")]), 400)
check("C patch back to mfs clearing them", call("PATCH", f"{G}/{mfs['id']}", A, form=[("type", "mfs"), ("bankName", ""), ("branchName", "")]), 200, pred=lambda v: v["bankName"] is None)
check("C patch required field cannot be cleared -> 400", call("PATCH", f"{G}/{mfs['id']}", A, form=[("accountNumber", "")]), 400)
check("C patch blank description clears it", call("PATCH", f"{G}/{mfs['id']}", A, form=[("description", "")]), 200, pred=lambda v: v["description"] is None)
check("C patch manual: description cannot be cleared -> 400", call("PATCH", f"{G}/{man['id']}", A, form=[("description", "")]), 400)
check("C patch unknown field -> 400", call("PATCH", f"{G}/{mfs['id']}", A, form=[("slug", "hack")]), 400)
check("C patch missing -> 404", call("PATCH", G + "/99999999", A, form=[("name", "x")]), 404)
old_icon = mfs["iconUrl"].split("/uploads/")[1]
check("C replace icon", call("PATCH", f"{G}/{mfs['id']}", A, form=[("icon", "@" + png("icon2.png"))]), 200, pred=lambda v: v["iconUrl"] and v["iconUrl"] != mfs["iconUrl"])
check("C replaced icon file removed from disk", (200, os.path.exists(os.path.join(UPLOADS, old_icon))), 200, pred=lambda v: v is False)
check("C icon + removeIcon -> 400", call("PATCH", f"{G}/{mfs['id']}", A, form=[("icon", "@" + ICON), ("removeIcon", "true")]), 400)
check("C removeIcon", call("PATCH", f"{G}/{mfs['id']}", A, form=[("removeIcon", "true")]), 200, pred=lambda v: v["iconUrl"] is None)

# ================================================================= D gateway delete
user = sql('select id from "user" order by id limit 1')
sql(f"""insert into "order" ("orderNumber","userId","sellerId",total,subtotal,"payableAmount","paymentGatewayId","paymentGatewaySlug","recipientName","recipientPhone","deliveryAddress","paymentGatewayName","countryCode","countryName","city")
        values ('T-ORDER-1',{user},5,10,10,10,{man['id']},'t-wire','x','1','x','g','BD','Bangladesh','Dhaka')""")
check("D gateway used by an order -> 409", call("DELETE", f"{G}/{man['id']}", A), 409)
check("D ...and is still there", call("GET", f"{G}/{man['id']}", A), 200)
sql("delete from \"order\" where \"orderNumber\" like 'T-%'")
check("D unused gateway deletes -> 204", call("DELETE", f"{G}/{bank['id']}", A), 204)
check("D delete again -> 404", call("DELETE", f"{G}/{bank['id']}", A), 404)
check("D deleted gateway not listed", call("GET", G + "?search=city", A), 200, pred=lambda v: v["results"] == [])
c, withicon = call("POST", G, A, form=gw("T Icon del", "cod", icon=ICON))
fp = withicon["iconUrl"].split("/uploads/")[1]
call("DELETE", f"{G}/{withicon['id']}", A)
check("D deleted gateway's icon file is gone", (200, os.path.exists(os.path.join(UPLOADS, fp))), 200, pred=lambda v: v is False)

# ================================================================= E settings
S = "/admin/settings"
check("E settings need a token", call("GET", S), 401)
c, st = call("GET", S, A)
check("E settings list the three shipping keys with defaults", (c, st), 200, pred=lambda v: {s["key"] for s in v} == {"shipping.defaultCharge", "shipping.defaultEstimatedDays", "shipping.defaultSupportsLiveAnimal"} and all(s["label"] and s["type"] for s in v))
check("E typed values", (c, st), 200, pred=lambda v: next(s for s in v if s["key"] == "shipping.defaultEstimatedDays")["value"] == 7 and next(s for s in v if s["key"] == "shipping.defaultSupportsLiveAnimal")["value"] is True)
check("E update", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 12.5, "shipping.defaultEstimatedDays": 5, "shipping.defaultSupportsLiveAnimal": False}}), 200, pred=lambda v: next(s for s in v if s["key"] == "shipping.defaultCharge")["value"] == 12.5 and next(s for s in v if s["key"] == "shipping.defaultSupportsLiveAnimal")["value"] is False)
check("E update persists", call("GET", S, A), 200, pred=lambda v: next(s for s in v if s["key"] == "shipping.defaultEstimatedDays")["value"] == 5)
check("E tracker stamped with the admin", (200, sql("select \"updaterType\" || '|' || coalesce(\"updaterName\",'') from system_setting where key='shipping.defaultCharge'")), 200, pred=lambda v: v.startswith("admin|") and len(v) > 6)
check("E partial update keeps the others", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 0}}), 200, pred=lambda v: next(s for s in v if s["key"] == "shipping.defaultEstimatedDays")["value"] == 5)
check("E unknown key -> 400", call("PATCH", S, A, body={"settings": {"shipping.nope": 1}}), 400)
check("E empty settings -> 400", call("PATCH", S, A, body={"settings": {}}), 400)
check("E missing settings -> 400", call("PATCH", S, A, body={}), 400)
check("E settings not an object -> 400", call("PATCH", S, A, body={"settings": [1]}), 400)
check("E extra top-level key -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 1}, "x": 1}), 400)
check("E charge as a string -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": "5"}}), 400)
check("E charge 3 decimals -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 1.234}}), 400)
check("E charge negative -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": -1}}), 400)
check("E charge too large -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 1e12}}), 400)
check("E charge null -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": None}}), 400)
check("E days fraction -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultEstimatedDays": 2.5}}), 400)
check("E days 366 -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultEstimatedDays": 366}}), 400)
check("E boolean as a string -> 400", call("PATCH", S, A, body={"settings": {"shipping.defaultSupportsLiveAnimal": "true"}}), 400)
check("E one bad key rejects the whole update", call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 77, "shipping.defaultEstimatedDays": "x"}}), 400, pred=lambda v: True)
check("E ...and applied nothing", call("GET", S, A), 200, pred=lambda v: next(s for s in v if s["key"] == "shipping.defaultCharge")["value"] == 0)

# ================================================================= F countries
c, countries = call("GET", "/admin/countries", A)
check("F countries need a token", call("GET", "/admin/countries"), 401)
check("F 249 unique countries with names", (c, countries), 200, pred=lambda v: len(v) == 249 and len({x["code"] for x in v}) == 249 and all(x["name"] and x["name"] != x["code"] for x in v) and {"code": "BD", "name": "Bangladesh"} in v)
check("F sorted by name (locale order)", (c, countries), 200, pred=lambda v: v[0]["code"] == "AF" and v[-1]["code"] == "ZW")

# ================================================================= G shipping zones
Z = "/admin/shipping-zones"


def zone(name="T Zone", dtype="standard", codes=("BD",), charge=100, days=5, extra=None):
    body = {"name": name, "deliveryType": dtype, "countryCodes": list(codes), "charge": charge, "estimatedDays": days}
    body.update(extra or {})
    return body


check("G zones need a token", call("GET", Z), 401)
check("G missing name -> 400", call("POST", Z, A, body={**zone(), "name": ""}), 400)
check("G bad deliveryType -> 400", call("POST", Z, A, body=zone(dtype="teleport")), 400)
check("G no countries -> 400", call("POST", Z, A, body=zone(codes=())), 400)
check("G unknown country code -> 400", call("POST", Z, A, body=zone(codes=("BD", "ZZ"))), 400)
check("G malformed country code -> 400", call("POST", Z, A, body=zone(codes=("BGD",))), 400)
check("G duplicate country codes -> 400", call("POST", Z, A, body=zone(codes=("BD", "bd"))), 400)
check("G charge negative -> 400", call("POST", Z, A, body=zone(charge=-1)), 400)
check("G charge 3 decimals -> 400", call("POST", Z, A, body=zone(charge=1.234)), 400)
check("G charge string -> 400", call("POST", Z, A, body=zone(charge="5")), 400)
check("G days 366 -> 400", call("POST", Z, A, body=zone(days=366)), 400)
check("G days fraction -> 400", call("POST", Z, A, body=zone(days=1.5)), 400)
check("G isActive null -> 400", call("POST", Z, A, body=zone(extra={"isActive": None})), 400)
check("G unknown field -> 400", call("POST", Z, A, body=zone(extra={"code": "x"})), 400)

c, z1 = call("POST", Z, A, body=zone("T South Asia", "standard", ("bd", "IN", "pk"), 150.5, 6))
check("G create normalises codes to upper case", (c, z1), 201, pred=lambda v: v["countryCodes"] == ["BD", "IN", "PK"] and v["charge"] == 150.5 and v["supportsLiveAnimal"] is True and v["isActive"] is True)
check("G detail carries country names", call("GET", f"{Z}/{z1['id']}", A), 200, pred=lambda v: v["countries"][0] == {"code": "BD", "name": "Bangladesh"})
check("G overlap, same type -> 409", call("POST", Z, A, body=zone("T Clash", "standard", ("IN", "LK"))), 409, pred=lambda v: "T South Asia" in json.dumps(v))
c, z2 = call("POST", Z, A, body=zone("T South Asia express", "express", ("BD", "IN"), 400, 2))
check("G same countries under another delivery type are fine", (c, z2), 201)
c, z3 = call("POST", Z, A, body=zone("T Europe", "standard", ("DE", "FR", "GB"), 900, 9, {"supportsLiveAnimal": False}))
check("G create zone without live birds", (c, z3), 201, pred=lambda v: v["supportsLiveAnimal"] is False)
c, z4 = call("POST", Z, A, body=zone("T Old BD", "standard", ("BD",), 1, 1, {"isActive": False}))
check("G an inactive zone may overlap", (c, z4), 201, pred=lambda v: v["isActive"] is False)
check("G activating into an overlap -> 409", call("PATCH", f"{Z}/{z4['id']}", A, body={"isActive": True}), 409)
check("G moving a zone into an overlap -> 409", call("PATCH", f"{Z}/{z3['id']}", A, body={"countryCodes": ["DE", "IN"]}), 409)
check("G changing delivery type into an overlap -> 409", call("PATCH", f"{Z}/{z3['id']}", A, body={"deliveryType": "express", "countryCodes": ["BD"]}), 409)
check("G patch own fields (no false overlap with itself)", call("PATCH", f"{Z}/{z1['id']}", A, body={"charge": 160, "countryCodes": ["BD", "IN", "PK", "LK"]}), 200, pred=lambda v: v["charge"] == 160 and len(v["countryCodes"]) == 4)
check("G patch empty countries -> 400", call("PATCH", f"{Z}/{z1['id']}", A, body={"countryCodes": []}), 400)
check("G patch null charge -> 400", call("PATCH", f"{Z}/{z1['id']}", A, body={"charge": None}), 400)
check("G patch unknown field -> 400", call("PATCH", f"{Z}/{z1['id']}", A, body={"slug": "x"}), 400)
check("G patch missing -> 404", call("PATCH", f"{Z}/99999999", A, body={"charge": 1}), 404)
check("G detail missing -> 404", call("GET", f"{Z}/99999999", A), 404)
check("G detail bad id -> 400", call("GET", f"{Z}/abc", A), 400)

check("G list filter deliveryType", call("GET", Z + "?deliveryType=express", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [z2["id"]])
check("G list filter isActive=false", call("GET", Z + "?isActive=false", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [z4["id"]])
check("G list filter country", call("GET", Z + "?country=de", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [z3["id"]])
check("G list country filter finds every zone with it", call("GET", Z + "?country=BD", A), 200, pred=lambda v: {r["id"] for r in v["results"]} == {z1["id"], z2["id"], z4["id"]})
check("G list search", call("GET", Z + "?search=europe", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [z3["id"]])
check("G list bad country -> 400", call("GET", Z + "?country=xyz", A), 400)
seen, cursor = [], 0
for _ in range(10):
    c, v = call("GET", f"{Z}?limit=1&cursor={cursor}", A)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("G cursor paging visits every zone once, newest first", (200, seen), 200, pred=lambda v: v == sorted([z1["id"], z2["id"], z3["id"], z4["id"]], reverse=True))

# ================================================================= H quote
Q = Z + "/quote"
check("H quote needs a token", call("GET", Q + "?country=BD&deliveryType=standard"), 401)
check("H quote from a zone", call("GET", Q + "?country=BD&deliveryType=standard", A), 200, pred=lambda v: v["source"] == "zone" and v["zone"]["id"] == z1["id"] and v["charge"] == 160 and v["estimatedDays"] == 6 and v["supportsLiveAnimal"] is True)
check("H quote picks the zone for that delivery type", call("GET", Q + "?country=BD&deliveryType=express", A), 200, pred=lambda v: v["zone"]["id"] == z2["id"] and v["charge"] == 400)
check("H quote: lower-case country accepted", call("GET", Q + "?country=de&deliveryType=standard", A), 200, pred=lambda v: v["zone"]["id"] == z3["id"] and v["supportsLiveAnimal"] is False)
check("H quote ignores inactive zones", (200, sql(f"select count(*) from shipping_zone where id={z4['id']} and \"isActive\"")), 200, pred=lambda v: v == "0")
call("PATCH", S, A, body={"settings": {"shipping.defaultCharge": 99, "shipping.defaultEstimatedDays": 14, "shipping.defaultSupportsLiveAnimal": False}})
check("H no zone covers it -> global default", call("GET", Q + "?country=US&deliveryType=standard", A), 200, pred=lambda v: v["source"] == "default" and v["zone"] is None and v["charge"] == 99 and v["estimatedDays"] == 14 and v["supportsLiveAnimal"] is False)
check("H zone for another delivery type does not apply -> default", call("GET", Q + "?country=DE&deliveryType=express", A), 200, pred=lambda v: v["source"] == "default")
check("H pickup with no zone -> default", call("GET", Q + "?country=BD&deliveryType=pickup", A), 200, pred=lambda v: v["source"] == "default")
call("PATCH", f"{Z}/{z1['id']}", A, body={"isActive": False})
check("H deactivating a zone makes it fall back to the default", call("GET", Q + "?country=BD&deliveryType=standard", A), 200, pred=lambda v: v["source"] == "default" and v["charge"] == 99)
check("H quote: missing country -> 400", call("GET", Q + "?deliveryType=standard", A), 400)
check("H quote: unknown shape country -> 400", call("GET", Q + "?country=BGD&deliveryType=standard", A), 400)
check("H quote: bad delivery type -> 400", call("GET", Q + "?country=BD&deliveryType=zzz", A), 400)
check("H quote: missing delivery type -> 400", call("GET", Q + "?country=BD", A), 400)
check("H quote: unknown param -> 400", call("GET", Q + "?country=BD&deliveryType=standard&x=1", A), 400)
check("H quote with a code that is not a country still resolves to the default", call("GET", Q + "?country=ZZ&deliveryType=standard", A), 200, pred=lambda v: v["source"] == "default")

# ================================================================= I zone delete
check("I delete zone -> 204", call("DELETE", f"{Z}/{z3['id']}", A), 204)
check("I delete again -> 404", call("DELETE", f"{Z}/{z3['id']}", A), 404)
check("I its countries are free again", call("POST", Z, A, body=zone("T Europe 2", "standard", ("DE",))), 201)

# ================================================================= summary
cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
import shutil
shutil.rmtree(TMP, ignore_errors=True)
sys.exit(1 if failed else 0)
