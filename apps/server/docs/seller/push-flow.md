PUSH NOTIFICATIONS
==================

The seller app asks to be told when something needs the seller. The server keeps one row per phone
(`seller_device`) and sends through Firebase Cloud Messaging (FCM, HTTP v1).

Phone side (seller token, access `any`, base `/v1/api/seller`)
-------------------------------------------------------------
- `POST /devices` `{ token, platform: 'android' | 'ios' }` saves the phone. Sending the same token again
  refreshes it. A phone that was another seller's moves to the signed-in seller (one phone, one row).
- `POST /devices/unregister` `{ token }` removes this seller's row for that token. The app sends it just
  before signing out. A POST, not a DELETE, so it does not collide with the switched-off delete routes.

When a push is sent
-------------------
To the seller, from what a buyer does:
- places an order ("New order"), asks a question ("New question"), sends a paid request ("Payment request"),
  makes a price offer that is not turned down at once ("New price offer"), asks for a return ("Return requested").
Each message carries `data.route`, the app screen to open when it is tapped (`/orders/12`, `/more/offers/12`...).
A push is fire and forget: if it fails the action that caused it still succeeds. A token FCM says is gone is deleted.

Switching it on
---------------
Set `FIREBASE_SERVICE_ACCOUNT` to the path of the service account JSON (or the JSON itself). Without it
nothing is sent; the server only logs `(not sent, Firebase is not set up) <title>: <body>`.

Code: `src/push/` (`PushModule` is global; call `PushService.notifySeller(sellerId, { title, body, data })`).
