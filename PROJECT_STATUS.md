# PacePulse AI — Project Status & Change Log

> Reference doc. Kept up to date after each major work session so status can be
> checked without re-reading the whole codebase or chat history.
> Last updated: 2026-08-07.

## What this app is

React 18 + Vite app, wrapped by a native Kotlin/Android Studio WebView shell
(`pacepulse-android/`) for real device sensors (step counter, barometer,
native share intents). **Product direction: Android app now, Mac app later —
not a public website.**

Backend, current architecture:
- **Firebase** — Authentication (real accounts, Google-managed password
  hashing) + Firestore (app data), locked down by `firestore.rules`.
- **Cloudflare Worker** (`pacepulse-worker/`) — the *only* custom backend.
  Sends/verifies 4-digit signup and password-reset codes, and performs the
  actual password update via a Firebase Admin-authenticated call. Free tier,
  no credit card. Replaced Netlify entirely (see "Major pivot" below).
- **EmailJS** — sends the actual OTP emails, called only from the Worker
  (never from the app), authenticated with a private key so the account isn't
  exposed even though the public key lives in this public GitHub repo.

No Netlify, no Node/Express server, no `firebase-admin` npm package anywhere
(Cloudflare Workers can't run it — see the Worker's `firebaseAdmin.js`, which
hand-rolls the Google OAuth2/JWT signing instead).

---

## History in brief

**Session 1** — found and fixed a live security hole: the original hand-rolled
Firestore client had zero authentication; anyone could read/write the whole
database anonymously, including plaintext passwords. Migrated to real Firebase
Auth + locked Firestore rules + server-side OTP verification (originally via
Netlify Functions). Also fixed: false step-counting in vehicles, added
elevation-gain tracking, fixed broken WhatsApp/Instagram sharing, added
account deletion, converted Netlify from a public website to a backend-only
API host to match the Android-only product direction.

**Session 2 (major pivot)** — Netlify ran out of free-tier credits and
stopped deploying. Diagnosed and fixed two real bugs along the way (a missing
Google Cloud IAM role blocking Firestore writes; an EmailJS security setting
blocking server-side calls) — but rather than keep depending on Netlify's
credit-limited hosting, first tried removing the custom backend entirely and
using Firebase's own built-in email verification/reset. That turned out to be
unreliable specifically for this project (confirmed via a side-by-side test:
a brand-new throwaway Firebase project sent mail successfully, this project's
did not) and landed in spam even when it worked. **Final fix**: rebuilt the
same OTP backend on **Cloudflare Workers** instead of Netlify — free tier,
no credit card, no surprise credit exhaustion, and it works.

---

## Current auth flow (as of 2026-08-07)

1. **Signup**: user fills the form → app asks the Worker to email a 4-digit
   code (via EmailJS) → user types the code back in → **Worker verifies the
   code server-side first** → only then does the app create the real Firebase
   Auth account. An unverified account is never created — this is what makes
   the flow unbypassable from a modified client.
2. **Forgot password**: user enters email → Worker checks the account
   actually exists (via Firebase Admin lookup) before sending anything → user
   receives and types the 4-digit code → **code is verified immediately**
   (this used to only happen when the new password was submitted — fixed,
   see below) → user sets a new password → Worker verifies the code again and
   updates the password via a Firebase Admin-authenticated call → app signs
   the user in with the new password.
3. Both flows are rate-limited: 5 wrong-code guesses invalidates the code.

Two UX bugs found and fixed during testing:
- Reset code used to only be checked when the *new password* was submitted,
  so a wrong code wasn't caught until after filling out the whole next
  screen. Now checked immediately via a dedicated `verify-reset-otp` Worker
  endpoint.
- Password-reset emails used to send even for an email with no account.
  Worker now looks the account up first and returns "no account found"
  instead of sending anything.

## Key secrets and where they live

| Secret | Lives in | What it can do if leaked |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` (Google service-account JSON) | Cloudflare Worker encrypted secret only | Highest value target — can reset any user's password (never read one) and read/write Firestore profile data. Never in any file or the repo. |
| `EMAILJS_PRIVATE_KEY` | Cloudflare Worker encrypted secret only | Low value — could only send spam through the EmailJS account, no access to any user data. |
| Firebase Web API key (`src/firebase.js`) | Public, committed in the repo | Not a secret by design — this is normal for every Firebase app; real access control is Firestore Security Rules + Firebase Auth, not hiding this key. |
| Cloudflare API token used to deploy the Worker | Never saved to any file — only used transiently in terminal sessions | Could modify the Worker if stolen, but has no persistent storage anywhere. |

**Pending, not yet done**: turning on 2FA on the Cloudflare account and the
Google account that owns the Firebase project (`pacepulseai@gmail.com` for
both) — the single most impactful remaining hardening step, since those two
accounts are what actually protect the `FIREBASE_SERVICE_ACCOUNT` secret.

## Known residual limitations (by design / not yet addressed)

- Any signed-in user can read other users' profile/step data (needed for the
  friend-search/leaderboard features) — only the account owner can *write*
  their own data. Intentional, unchanged.
- 2FA not yet enabled on Cloudflare/Google accounts (see above).
- Firebase's own email template branding (Console → Authentication →
  Templates) is currently blocked by a Firebase-side Console bug for this
  project ("Email template updates are currently unavailable") — cosmetic
  only, doesn't affect anything since email sending no longer goes through
  Firebase's mailer anyway. Not worth pursuing further; EmailJS's own
  template controls the actual email content now.

## Key files touched (cumulative)

| Area | Files |
|---|---|
| Firebase client | `src/firebase.js` |
| Auth UI | `src/components/AuthModal.jsx`, `src/components/DeleteAccountModal.jsx` |
| App boot | `src/App.jsx` |
| Password policy | `src/utils/passwordPolicy.js` |
| Elevation | `src/components/ElevationWidget.jsx`, `src/utils/fitnessEngine.js` |
| Sharing | `src/components/ShareModal.jsx` |
| **Cloudflare Worker (current backend)** | `pacepulse-worker/src/index.js`, `emailjs.js`, `firebaseAdmin.js`, `passwordPolicy.js`, `pacepulse-worker/wrangler.toml` |
| Firestore rules | `firestore.rules` |
| Android native | `pacepulse-android/app/src/main/java/com/pacepulse/ai/NativeStepManager.kt`, `MotionStateReceiver.kt`, `ElevationManager.kt`, `MainActivity.kt`, `StepTrackingService.kt` |
| Android build config | `pacepulse-android/gradle.properties` |
| Retired (no longer used) | `netlify/` (Netlify Functions, kept in repo history but not deployed/relied on), Firebase's native `sendEmailVerification`/`sendPasswordResetEmail` |

## Suggested test order for the current APK

1. Fresh signup with a real email — confirm the 4-digit code actually arrives
   and a wrong code is rejected.
2. Sign out / sign back in.
3. Forgot password: wrong code shows an immediate error; correct code lets
   you set a new password; an email with no account says so without sending
   anything.
4. On a physical device: ride in a car and confirm steps don't increase;
   confirm elevation is rejected in an elevator/vehicle but counted on stairs.
5. WhatsApp/Instagram "share to story."
6. Delete account, confirm it's really gone from Firebase Console.
