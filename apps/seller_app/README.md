# Pigeon Nest Seller App

Flutter app for sellers (Android and iOS). It talks to the same server as the seller website, under `/v1/api/seller`.

## Run

```bash
cd apps/seller_app
flutter pub get
flutter run                                   # picks the emulator or phone that is open
flutter run --dart-define=API_BASE_URL=https://your-server/v1/api   # a different server
```

Default server address (start the server first, `pnpm start:dev` in `apps/server`, port 3100):

| Device | Address |
|---|---|
| Android emulator | `http://10.0.2.2:3100/v1/api` |
| iOS simulator | `http://localhost:3100/v1/api` |

A real phone cannot reach `localhost`. Pass `--dart-define=API_BASE_URL=http://<your-computer-ip>:3100/v1/api`.
Release builds must use HTTPS.

## Needs on your machine

- Android builds: JDK 21 (JDK 27 breaks the Android build). `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`.
- iOS builds: full Xcode (not only the command line tools) and CocoaPods (`brew install cocoapods`).
- Check everything with `flutter doctor`.

## Layout

```
lib/
  main.dart, app.dart
  core/
    config/   server address
    api/      one Dio client, adds the token, turns errors into plain messages
    auth/     sign in, sign out, restore the session on start
    router/   go_router, sends signed-out sellers to /login
    storage/  token in Keychain / Keystore
    theme/    big, plain, easy to tap
  features/   one folder per seller section, each with data/ state/ ui/ widgets/
              (auth, home now; orders, products, returns ... as built)
  shared/     widgets used by more than one feature
```

Read `ROADMAP.md` (what to build, in order) and `FEATURES.md` (which feature lives where). The rules are in the root `rules.md`, rules 5 to 8.

Add a section by creating `lib/features/<name>/` and putting its screens, API calls and state there.
