#!/usr/bin/env python3
"""Black-box tests: customer address book and the admin managing it on a customer's behalf."""
import concurrent.futures as cf, json, os, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)


def call(method, path, token=None, body=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
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
    detail = "" if ok else f"expected {expected} got {got[0]} {note} body={str(got[1])[:400]}"
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + detail))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


def register(n):
    c, d = call("POST", "/user/auth/register", body={"name": f"T Addr {n}", "phone": f"+88017{RUN_NUM}{n:03d}", "password": "Passw0rd!x", "email": f"t-addr-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


def cleanup():
    sql(f"delete from address where \"userId\" in (select id from \"user\" where email like 't-addr-{RUN}-%')")
    sql(f"delete from \"user\" where email like 't-addr-{RUN}-%'")


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
ADMIN_NAME = sql(f"select name from admin_user where email='{ADMIN_EMAIL}'")
U1, ID1 = register(1)
U2, ID2 = register(2)
U3, ID3 = register(3)
sql(f"update \"user\" set status='suspended' where id={ID3}")
A = "/user/profile/addresses"
body = lambda **o: {**{"recipientName": "T Addr Home", "phone": "+8801712345678", "countryCode": "BD", "city": "Dhaka", "address": "House 1, Road 2, Dhanmondi"}, **o}


def default_count(uid):
    return int(sql(f"select count(*) from address where \"userId\"={uid} and \"isDefault\" and \"deletedAt\" is null"))


# ================================================================= A access
check("A no token -> 401", call("GET", A), 401)
check("A bad token -> 401", call("GET", A, "garbage"), 401)
check("A admin token on the customer route -> 403", call("GET", A, ADMIN), 403)
check("A suspended customer -> 403", call("GET", A, U3), 403)
check("A empty list at first", call("GET", A, U1), 200, pred=lambda v: v["results"] == [])

# ================================================================= B create validation
P = lambda b, t=U1: call("POST", A, t, b)
check("B empty body -> 400", P({}), 400)
check("B name missing -> 400", P({k: v for k, v in body().items() if k != "recipientName"}), 400)
check("B name too short -> 400", P(body(recipientName="A")), 400)
check("B name number -> 400", P(body(recipientName=5)), 400)
check("B phone missing -> 400", P({k: v for k, v in body().items() if k != "phone"}), 400)
check("B phone without + -> 400", P(body(phone="01712345678")), 400)
check("B phone invalid -> 400", P(body(phone="+1")), 400)
check("B country missing -> 400", P({k: v for k, v in body().items() if k != "countryCode"}), 400)
check("B country unknown -> 400", P(body(countryCode="ZZ")), 400)
check("B country 3 letters -> 400", P(body(countryCode="BGD")), 400)
check("B country number -> 400", P(body(countryCode=1)), 400)
check("B city missing -> 400", P({k: v for k, v in body().items() if k != "city"}), 400)
check("B city blank -> 400", P(body(city="   ")), 400)
check("B city too long -> 400", P(body(city="c" * 121)), 400)
check("B state too long -> 400", P(body(state="s" * 121)), 400)
check("B address too short -> 400", P(body(address="abc")), 400)
check("B address too long -> 400", P(body(address="a" * 501)), 400)
check("B zip too long -> 400", P(body(zipCode="1" * 21)), 400)
check("B type invalid -> 400", P(body(type="home")), 400)
check("B isDefault as text -> 400", P(body(isDefault="yes")), 400)
check("B isDefault null -> 400", P(body(isDefault=None)), 400)
check("B unknown field -> 400", P(body(userId=99)), 400)
check("B nothing saved by failures", (200, sql(f"select count(*) from address where \"userId\"={ID1}")), 200, pred=lambda v: v == "0")

# ================================================================= C create, defaults
c, a1 = P(body(state="  Dhaka Division ", zipCode="1207", countryCode="bd"))
check("C create", (c, a1), 201)
check("C the first address becomes the default", (c, a1), 201, pred=lambda v: v["isDefault"] is True)
check("C fields stored, country uppercased and named, text trimmed", (c, a1), 201, pred=lambda v: v["countryCode"] == "BD" and v["countryName"] == "Bangladesh" and v["state"] == "Dhaka Division" and v["zipCode"] == "1207" and v["type"] == "shipping" and v["city"] == "Dhaka" and v["userId"] == ID1)
c, a2 = P(body(recipientName="T Addr Office", countryCode="US", city="Austin", state="TX", address="500 Congress Ave, Suite 4", phone="+14155550123"))
check("C a second address is not the default", (c, a2), 201, pred=lambda v: v["isDefault"] is False and v["countryName"] == "United States")
c, a3 = P(body(recipientName="T Addr Third", isDefault=True, type="billing", state="", zipCode=""))
check("C asking for a default takes it over", (c, a3), 201, pred=lambda v: v["isDefault"] is True and v["type"] == "billing" and v["state"] is None and v["zipCode"] is None)
check("C ...and the old default is no longer one", call("GET", f"{A}/{a1['id']}", U1), 200, pred=lambda v: v["isDefault"] is False)
check("C only one default", (200, default_count(ID1)), 200, pred=lambda v: v == 1)
check("C list: default first, then newest", call("GET", A, U1), 200, pred=lambda v: [r["id"] for r in v["results"]] == [a3["id"], a2["id"], a1["id"]])
check("C creator recorded as the customer", (200, sql(f"select \"creatorType\"||'|'||\"creatorName\" from address where id={a1['id']}")), 200, pred=lambda v: v == "user|T Addr 1")

# parallel creates both asking to be the default: still one default
with cf.ThreadPoolExecutor(4) as ex:
    fs = [ex.submit(P, body(recipientName=f"T Addr Race {i}", isDefault=True), U2) for i in range(4)]
    codes = [f.result()[0] for f in fs]
check("C parallel default creates all succeed", (200, codes), 200, pred=lambda v: v == [201] * 4)
check("C ...and leave exactly one default", (200, default_count(ID2)), 200, pred=lambda v: v == 1)

# cap
for i in range(16):
    P(body(recipientName=f"T Addr Fill {i}"), U2)
check("C 20 addresses saved", (200, sql(f"select count(*) from address where \"userId\"={ID2} and \"deletedAt\" is null")), 200, pred=lambda v: v == "20")
check("C the 21st -> 409", P(body(), U2), 409, pred=lambda v: "at most 20" in v["message"])

# ================================================================= D read / update / delete
check("D get own", call("GET", f"{A}/{a2['id']}", U1), 200, pred=lambda v: v["id"] == a2["id"])
check("D get another customer's -> 404", call("GET", f"{A}/{a2['id']}", U2), 404)
check("D get unknown -> 404", call("GET", f"{A}/99999999", U1), 404)
check("D get bad id -> 400", call("GET", f"{A}/abc", U1), 400)
PA = lambda id, b, t=U1: call("PATCH", f"{A}/{id}", t, b)
check("D patch another customer's -> 404", PA(a2["id"], {"city": "X"}, U2), 404)
check("D patch unknown -> 404", PA(99999999, {"city": "X"}), 404)
check("D patch unknown field -> 400", PA(a2["id"], {"userId": 1}), 400)
check("D patch bad country -> 400", PA(a2["id"], {"countryCode": "ZZ"}), 400)
check("D patch bad phone -> 400", PA(a2["id"], {"phone": "123"}), 400)
check("D patch blank city -> 400", PA(a2["id"], {"city": " "}), 400)
check("D patch short address -> 400", PA(a2["id"], {"address": "ab"}), 400)
check("D patch isDefault as text -> 400", PA(a2["id"], {"isDefault": "true"}), 400)
check("D patch with nothing changes nothing", PA(a2["id"], {}), 200, pred=lambda v: v["city"] == "Austin")
check("D patch fields", PA(a2["id"], {"city": "Dallas", "address": "1 Main St, Dallas", "countryCode": "ca", "phone": "+14165550100"}), 200, pred=lambda v: v["city"] == "Dallas" and v["countryCode"] == "CA" and v["countryName"] == "Canada" and v["phone"] == "+14165550100" and v["state"] == "TX")
check("D a blank state clears it", PA(a2["id"], {"state": ""}), 200, pred=lambda v: v["state"] is None)
check("D null zip clears it", PA(a1["id"], {"zipCode": None}), 200, pred=lambda v: v["zipCode"] is None)
check("D updater recorded", (200, sql(f"select \"updaterType\"||'|'||\"updaterName\" from address where id={a2['id']}")), 200, pred=lambda v: v == "user|T Addr 1")
check("D make another the default", PA(a1["id"], {"isDefault": True}), 200, pred=lambda v: v["isDefault"] is True)
check("D ...old default dropped, still one", (200, default_count(ID1)), 200, pred=lambda v: v == 1)
check("D isDefault false does not switch the default off", PA(a1["id"], {"isDefault": False}), 200, pred=lambda v: v["isDefault"] is True)

check("D delete another customer's -> 404", call("DELETE", f"{A}/{a2['id']}", U2), 404)
check("D delete unknown -> 404", call("DELETE", f"{A}/99999999", U1), 404)
check("D delete a non-default address", call("DELETE", f"{A}/{a2['id']}", U1), 204)
check("D deleted address is gone", call("GET", f"{A}/{a2['id']}", U1), 404)
check("D ...kept as a soft delete", (200, sql(f"select \"deletedAt\" is not null from address where id={a2['id']}")), 200, pred=lambda v: v == "t")
check("D deleting twice -> 404", call("DELETE", f"{A}/{a2['id']}", U1), 404)
check("D delete the default: the newest left becomes the default", call("DELETE", f"{A}/{a1['id']}", U1), 204)
check("D ...a3 is the default now", call("GET", A, U1), 200, pred=lambda v: [(r["id"], r["isDefault"]) for r in v["results"]] == [(a3["id"], True)])
check("D delete the last", call("DELETE", f"{A}/{a3['id']}", U1), 204)
check("D none left, no default", (200, (default_count(ID1), call("GET", A, U1)[1]["results"])), 200, pred=lambda v: v == (0, []))
c, again = P(body(recipientName="T Addr Again"))
check("D the next one added is the default again", (c, again), 201, pred=lambda v: v["isDefault"] is True)

# ================================================================= E admin on behalf
AD = f"/admin/user/{ID1}/addresses"
check("E no token -> 401", call("GET", AD), 401)
check("E customer token -> 403", call("GET", AD, U1), 403)
check("E unknown user -> 404", call("GET", "/admin/user/99999999/addresses", ADMIN), 404)
check("E unknown user on create -> 404", call("POST", "/admin/user/99999999/addresses", ADMIN, body()), 404)
check("E bad user id -> 400", call("GET", "/admin/user/abc/addresses", ADMIN), 400)
check("E admin lists the customer's addresses", call("GET", AD, ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [again["id"]])
check("E validation applies", call("POST", AD, ADMIN, body(countryCode="ZZ")), 400)
check("E unknown field -> 400", call("POST", AD, ADMIN, body(userId=5)), 400)
c, ad1 = call("POST", AD, ADMIN, body(recipientName="T Addr By Admin", countryCode="GB", city="London", address="10 Downing Street", phone="+442079460000", isDefault=True))
check("E admin adds an address for the customer", (c, ad1), 201, pred=lambda v: v["userId"] == ID1 and v["isDefault"] is True and v["countryName"] == "United Kingdom")
check("E recorded as created by the admin", (200, sql(f"select \"creatorType\"||'|'||\"creatorName\" from address where id={ad1['id']}")), 200, pred=lambda v: v == f"admin|{ADMIN_NAME}")
check("E the customer sees it", call("GET", A, U1), 200, pred=lambda v: v["results"][0]["id"] == ad1["id"] and v["results"][0]["isDefault"])
check("E admin edits it", call("PATCH", f"{AD}/{ad1['id']}", ADMIN, {"city": "Westminster"}), 200, pred=lambda v: v["city"] == "Westminster")
check("E updater recorded as the admin", (200, sql(f"select \"updaterType\" from address where id={ad1['id']}")), 200, pred=lambda v: v == "admin")
check("E admin cannot reach another customer's address through this customer", call("GET", f"/admin/user/{ID2}/addresses/{ad1['id']}", ADMIN), 404)
check("E admin cannot edit it through another customer either", call("PATCH", f"/admin/user/{ID2}/addresses/{ad1['id']}", ADMIN, {"city": "X"}), 404)
check("E admin gets one", call("GET", f"{AD}/{ad1['id']}", ADMIN), 200, pred=lambda v: v["id"] == ad1["id"])
check("E admin deletes it", call("DELETE", f"{AD}/{ad1['id']}", ADMIN), 204)
check("E ...the earlier address is the default again", call("GET", A, U1), 200, pred=lambda v: v["results"][0]["id"] == again["id"] and v["results"][0]["isDefault"])
check("E admin can manage a suspended customer's addresses", call("POST", f"/admin/user/{ID3}/addresses", ADMIN, body()), 201)

# ================================================================= F integrity
check("F never more than one default per customer", (200, sql("select count(*) from (select \"userId\" from address where \"isDefault\" and \"deletedAt\" is null group by \"userId\" having count(*) > 1) x")), 200, pred=lambda v: v == "0")
check("F deleting the customer deletes the addresses", (200, (sql(f"delete from \"user\" where id={ID2}"), sql(f"select count(*) from address where \"userId\"={ID2}"))), 200, pred=lambda v: v[1] == "0")

cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
