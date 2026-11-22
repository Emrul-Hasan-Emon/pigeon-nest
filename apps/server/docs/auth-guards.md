# Auth guards

Each role has its own guard, its own signing key and its own audience. A token is trusted only when it verifies for the role the route asks for. The `type` claim never decides the role.

| Route prefix | Guards, in order |
|---|---|
| `/admin/**` | `AdminAuthGuard` |
| `/seller/**` | `SellerAuthGuard`, then `SellerAccessGuard` (status rules: `@RequireSellerAccess`) |
| `/user/**` | `UserAuthGuard`, then `UserAccessGuard` (status rules: `@RequireUserAccess`) |
| Cart, checkout, guest-friendly routes | `OptionalCustomerGuard` (a bearer token, when sent, must be a valid customer; otherwise a guest session) |

## What a token must pass (`TokenService`)

- Algorithm HS256 only (`none`, HS384 and HS512 are refused).
- Signature under the role's key. The key is `JWT_<ROLE>_SECRET` when set, else derived from `JWT_ACCESS_SECRET` with HMAC for that role. A token signed with the shared secret, or with another role's key, does not verify.
- Issuer `pigeon-nest`, audience equal to the role, an expiry, and a unique `jti`.
- `sub` a positive safe integer, `type` equal to the role, `pwd` present.

A genuine token of another role gets 403. Anything that does not verify gets 401.

## What each guard then checks, on every request

- The account exists (admin: and is active).
- `pwd` matches the account's current password hash. Changing the password ends every older token. `PATCH /seller/profile/password` and `PATCH /user/profile/password` return a fresh `accessToken` so the caller stays signed in.
- The access guards then apply status rules (suspended, rejected, inactive) from the account the auth guard loaded.

## Settings

- `JWT_ACCESS_SECRET` (required). At least 32 characters; shorter logs a warning, and refuses to start when `NODE_ENV=production`.
- `JWT_ADMIN_SECRET`, `JWT_SELLER_SECRET`, `JWT_USER_SECRET` (optional) set a role's key directly.
- `JWT_ACCESS_EXPIRES_IN` seconds.

Rotating a secret signs everyone of that role out.

Tests: `testing/guards_test.py` (forges tokens as an attacker would).
