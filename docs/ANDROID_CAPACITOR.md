# NextFi Android / Capacitor

NextFi uses one product UI and one deployed backend across web, PWA, and Android.

## Architecture

- Web: Next.js on Vercel
- PWA: the same Next.js UI with the existing manifest/service worker
- Android APK: Capacitor 8 shell loading the deployed Next.js UI
- Backend: deployed Next.js Route Handlers plus Supabase PostgreSQL
- Auth: Google Identity Services on web/PWA; native Google Sign-In inside the APK

The Android client does not contain database credentials and does not connect directly to PostgreSQL.

## Local Android setup

Requirements:

- Node.js 22+
- pnpm 10+
- Android Studio compatible with Capacitor 8
- JDK 21

Install dependencies, generate the Android project once, then open it:

```bash
pnpm install
pnpm android:init
pnpm android:open
```

To sync plugin/config changes:

```bash
pnpm android:sync
```

To build a sideloadable debug APK:

```bash
pnpm android:apk
```

The APK is created under `apps/mobile/android/app/build/outputs/apk/debug/`.

## Deployed URL

The mobile shell defaults to:

```text
https://web-nextfi.vercel.app
```

Override it at build time with `CAPACITOR_SERVER_URL`.

## Google Sign-In

Use the same Google Cloud project as the web client.

1. Keep `NEXT_PUBLIC_GOOGLE_CLIENT_ID` as the Web OAuth client ID.
2. Create an Android OAuth client for package `com.curibtech.nextfi`.
3. Register the SHA-1 fingerprint for each signing certificate used to install the app.
4. Rebuild/sync the Android project after auth plugin changes.

The native plugin returns a Google ID token; the Next.js UI sends that token to the existing `/api/auth/google` endpoint, so web, PWA and APK share the same server session model.

## Downloadable APK

Run the **Android APK** GitHub Actions workflow. It:

1. generates the Android project,
2. syncs Capacitor,
3. builds an installable APK,
4. uploads it as a workflow artifact, and
5. publishes/replaces the rolling `android-latest` GitHub Release asset.

For Play Store distribution, use a production signing keystore and produce a signed AAB/release APK rather than distributing the debug-signed build.
