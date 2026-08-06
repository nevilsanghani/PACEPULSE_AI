# PacePulse AI — Project Status & Change Log

> Reference doc. Kept up to date after each major work session so status can be
> checked without re-reading the whole codebase or chat history.
> Last updated: 2026-08-06.

## What this app is

React 18 + Vite app, wrapped by a native Kotlin/Android Studio WebView shell
(`pacepulse-android/`) for real device sensors (step counter, barometer,
native share intents). **Product direction: Android app now, Mac app later —
not a public website.** Netlify is kept only as a backend API host (serverless
functions), not a hosted site.

Backend: Firebase (Authentication + Firestore). No custom Node/Express server.

---

## Status BEFORE this session

- **Security: broken.** `src/firebase.js` was a hand-rolled Firestore REST
  client with no authentication at all. Confirmed live with a plain anonymous
  `curl` that the entire database — including account passwords — could be
  read and written by anyone, no login required. Passwords were stored in
  plaintext.
- OTP codes (signup verification, password reset) were generated and checked
  entirely in client-side JavaScript — trivially bypassable, and one bug even
  displayed the code directly in the UI ("Resend OTP" button).
- Step counting had no motion-state filtering: riding in a car/bus/train
  registered as steps from vibration.
- No elevation/floors-climbed tracking.
- WhatsApp/Instagram "share to story" gave a "page not found" error.
- Signup/reset emails weren't sent through a proper branded flow.
- No way for a user to delete their own account.
- The project was set up as a Netlify-hosted public website (from before the
  Android-only decision was made).

## Status AFTER this session

### 1. Full security migration (the critical fix)
User's requirement, verbatim: *"full proof security for user data... even
admin person should not be able to read password... I don't want interim
solution but I want end to end data security fix."*

- **Real Firebase Authentication** replaces the hand-rolled credential system.
  Passwords are hashed by Google's infrastructure; nobody — not the app, not
  an admin, not anyone holding the Firebase Admin key — can ever read a
  password back. Admin access can only *overwrite* a password, never see one.
- **Firestore Security Rules** (`firestore.rules`, repo root) now require a
  real signed-in Firebase identity for every read/write. Anonymous access is
  completely closed. `signup_otps`/`reset_otps` collections are walled off
  from every client (`allow read, write: if false`) — only server code with
  the Admin credential can touch them.
- **OTP verification moved server-side.** New Netlify Functions
  (`netlify/functions/send-signup-otp.js`, `verify-signup-and-create-account.js`,
  `send-reset-otp.js`, `confirm-password-reset.js`) generate and check codes
  using the Firebase Admin SDK. A signup account **does not exist** until the
  server itself confirms the code was correct — the client can no longer
  skip or fake this check.
- **Brute-force protection**: OTP verification attempts are capped
  (`MAX_OTP_ATTEMPTS = 5` in `netlify/functions/_shared/firebaseAdmin.js`).
- **Strong password validation**, enforced both client-side
  (`src/utils/passwordPolicy.js`) and server-side
  (`netlify/functions/_shared/passwordPolicy.js`): min 8 chars, upper+lower+digit.
- **Legacy account migration**: the one account created before this migration
  (password-hash based) is automatically upgraded to a real Firebase Auth
  account the first time it successfully logs in, then its old data is moved
  over and the old Firestore doc is removed.

### 2. Delete Account feature
New `src/components/DeleteAccountModal.jsx` — user must type `DELETE` to
confirm. Removes the Firestore profile/subcollections and the real Firebase
Auth credential.

### 3. False step counting in vehicles — fixed
Android now uses the Activity Recognition Transition API
(`NativeStepManager.kt`, `MotionStateReceiver.kt`) to gate step counting to
WALKING/RUNNING states only; `IN_VEHICLE` vibration no longer counts as steps.

### 4. Elevation Gain feature — added
New `ElevationManager.kt` reads the barometric pressure sensor, gated by the
same motion-state check (elevators/vehicles are rejected). Surfaced in the UI
via `src/components/ElevationWidget.jsx`, using `metersToFloors()` in
`src/utils/fitnessEngine.js`.

### 5. WhatsApp/Instagram sharing — fixed
Native Android share intents
(`com.whatsapp.action.SHARE_TO_STATUS`, `com.instagram.share.ADD_TO_STORY`)
with a proper `FileProvider`, replacing the broken web-link based sharing that
produced "page not found."

### 6. Branded signup/reset emails — fixed
Emails are sent via EmailJS from the server-side Netlify functions, branded
as "PacePulse AI", with no confirmation-subscription friction.

### 7. Netlify: converted from public website to backend-only API
Per user's explicit product pivot (Android + future Mac, not a website):
- `netlify.toml` — no-op build, publishes a placeholder-only `netlify/public/`,
  keeps `[functions]` directory.
- `src/components/AuthModal.jsx` calls the Netlify Functions via an absolute
  URL (`https://endearing-horse-9fc93a.netlify.app`) with CORS enabled, since
  the Android WebView is a different origin than the API host.
- Repo is now linked to Netlify via GitHub (continuous deployment), replacing
  the earlier manual "Netlify Drop" uploads.

### 8. Build/tooling fixes
- `pacepulse-android/gradle.properties` tuned for this machine's low RAM
  (3.9GB): `-Xmx768m -XX:MaxMetaspaceSize=256m`, daemon/parallel/kotlin-incremental
  disabled. Required for `assembleDebug` to succeed here.
- Debug APK builds successfully:
  `pacepulse-android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Known residual limitations (by design / not yet addressed)

- Any signed-in user can read other users' profile/step data (needed for the
  existing friend-search/leaderboard features) — only the account owner can
  *write* their own data. This is intentional, unchanged from before.
- The Firebase Admin service-account private key was pasted into chat once
  during setup. Not currently a live risk (never committed to the repo), but
  rotating it in the Firebase Console is a good hygiene step whenever convenient.

## Key files touched this session

| Area | Files |
|---|---|
| Firebase client | `src/firebase.js` |
| Auth UI | `src/components/AuthModal.jsx`, `src/components/DeleteAccountModal.jsx` |
| App boot | `src/App.jsx` |
| Password policy | `src/utils/passwordPolicy.js` |
| Elevation | `src/components/ElevationWidget.jsx`, `src/utils/fitnessEngine.js` |
| Netlify functions | `netlify/functions/*.js`, `netlify/functions/_shared/*.js` |
| Netlify config | `netlify.toml`, `netlify/public/index.html` |
| Firestore rules | `firestore.rules` |
| Android native | `pacepulse-android/app/src/main/java/com/pacepulse/ai/NativeStepManager.kt`, `MotionStateReceiver.kt`, `ElevationManager.kt`, `MainActivity.kt`, `StepTrackingService.kt` |
| Android build config | `pacepulse-android/gradle.properties` |

## Suggested test order for the current APK

1. Fresh signup — verify wrong OTP code is rejected, weak password is rejected.
2. Sign out / sign back in.
3. Forgot password flow end-to-end.
4. On a physical device: ride in a car and confirm steps don't increase;
   confirm elevation is rejected in an elevator/vehicle but counted on stairs.
5. WhatsApp/Instagram "share to story."
6. Delete account, confirm it's really gone from Firebase Console.
