# Releasing the seller app

What is ready, and what only you can do (it needs your accounts).

## Ready

| Thing | Where |
|---|---|
| App name "Pigeon Nest Seller" | `android/app/src/main/AndroidManifest.xml`, `ios/Runner/Info.plist` |
| Icon and splash (a placeholder bird) | `assets/brand/`; replace the three files, then `dart run flutter_launcher_icons` and `dart run flutter_native_splash:create` |
| Release signing for Android | `android/app/build.gradle.kts` reads `android/key.properties` |
| Checks and builds on every change | `.github/workflows/seller-app.yml` |
| No internet bar, reads tried again | `lib/core/network/offline_banner.dart`, `lib/core/api/api_client.dart` |
| Push notifications, app side | `lib/core/notifications/push_service.dart` (dormant until the Firebase files are added) |
| Push notifications, server side | `apps/server/src/push/`, `apps/server/docs/seller/push-flow.md` |

## One-time set-up (you)

1. **Server address.** Release builds must use HTTPS. Build with `--dart-define=API_BASE_URL=https://your-server/v1/api` (the workflow reads the repository variable `SELLER_API_BASE_URL`).
2. **Android signing key.** A key was created on this machine: `~/pigeon-nest-seller-upload.jks`, with its passwords in `android/key.properties` (not in git). **Back both up now** (password manager plus a copy of the file). Use it as the Play *upload key*; turn on Play App Signing so Google holds the real signing key and a lost upload key can be reset. For the GitHub workflow, base64 the file into `ANDROID_KEYSTORE_BASE64` and add the other secrets.
3. **Firebase (push).** Create a Firebase project, add an Android app `com.pigeonnest.seller_app` and an iOS app with the bundle id in Xcode, then:
   - put `google-services.json` in `android/app/` and `GoogleService-Info.plist` in `ios/Runner/` (Xcode: add to the Runner target);
   - upload the Apple APNs key in Firebase > Project settings > Cloud Messaging;
   - on the server set `FIREBASE_SERVICE_ACCOUNT` to the path of a service account JSON (Project settings > Service accounts).
4. **Google Play.** Text for the listing is drafted in `store/listing.md`. Create the app, upload `build/app/outputs/bundle/release/app-release.aab` to an internal testing track first. Store listing needs: short and full description, screenshots (phone), the 512 px icon, privacy policy URL, and the data safety form (the app handles phone, email, ID pictures and order data; it sends push tokens).
5. **App Store.** Needs a Mac with full Xcode and CocoaPods, an Apple developer account, the bundle id, signing in Xcode, then `flutter build ipa` and upload with Transporter, to TestFlight first. Review needs a demo seller login.

## Each release

1. Raise `version:` in `pubspec.yaml` (`1.0.1+2`: the number after `+` must go up every upload).
2. `flutter analyze && flutter test`.
3. Run the workflow with "Build the signed Android bundle" ticked, or build locally with `flutter build appbundle --release --dart-define=API_BASE_URL=...`.
4. Test on a real phone: sign in, an order, a picture upload, a notification.
