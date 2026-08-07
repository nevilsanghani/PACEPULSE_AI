/**
 * PacePulse AI - Firebase Authentication + Cloud Firestore Database Service
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { DEFAULT_PROFILE } from './utils/fitnessEngine';

// PacePulse AI has no public web frontend - this Worker is called directly by
// the Android (and future Mac) app's WebView, which is always a different origin,
// so relative fetch URLs would not resolve correctly.
const OTP_WORKER_BASE = 'https://pacepulse-otp.pacepulseai.workers.dev';

/**
 * Public, safe-to-ship Firebase Web App config (not a secret - this is meant to
 * be embedded in client apps; access is governed by Firestore Security Rules
 * and Firebase Auth, not by keeping this value hidden).
 * Fill these in from Firebase Console -> Project Settings -> Your apps -> Web app.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCyw8ntKlVJyrR_22SxaE0jVdaI5nGcI2Y',
  authDomain: 'pacepulse-ai.firebaseapp.com',
  projectId: 'pacepulse-ai',
  storageBucket: 'pacepulse-ai.firebasestorage.app',
  messagingSenderId: '930426837446',
  appId: '1:930426837446:web:190493214d1f226ae87ac7'
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

const FIRESTORE_PROJECT_ID = 'pacepulse-ai';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Rolling in-memory log of every Firestore call this session, for the on-device
 * debug panel - lets a build be diagnosed without a USB/adb connection by showing
 * exactly what each call sent and got back (auth state, status code, or the raw
 * exception if the network call itself failed).
 */
export const debugLog = [];
function pushDebug(entry) {
  debugLog.unshift({ time: new Date().toLocaleTimeString(), ...entry });
  if (debugLog.length > 25) debugLog.length = 25;
}

/**
 * All Firestore REST calls must go through this wrapper now that security rules
 * require a real signed-in identity (`request.auth != null`) for every read/write -
 * it attaches the current Firebase ID token as a Bearer header. Plain anonymous
 * `fetch()` calls to Firestore will be rejected with a permission error.
 */
async function firestoreFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const shortPath = url.replace(FIRESTORE_REST_BASE, '').split('?')[0] || '/';
  const method = options.method || 'GET';
  let authAttached = false;
  let tokenError = null;

  try {
    // Right after a cold app start, Firebase Auth needs a moment to finish
    // restoring the persisted session internally - a call that fires before
    // that finishes sees auth.currentUser as null even though a real session
    // exists, sends no identity, and gets rejected by Firestore's rules.
    // authStateReady() resolves once that initial check is done (immediately,
    // if it already was) so this never sends an unauthenticated request while
    // a real session is still loading.
    await auth.authStateReady();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
      authAttached = true;
    }
  } catch (e) {
    tokenError = e && e.message ? e.message : String(e);
  }

  try {
    const res = await fetch(url, { ...options, headers });
    pushDebug({
      path: shortPath, method,
      authUser: auth.currentUser ? auth.currentUser.uid : null,
      authAttached, tokenError,
      status: res.status, ok: res.ok
    });
    return res;
  } catch (e) {
    pushDebug({
      path: shortPath, method,
      authUser: auth.currentUser ? auth.currentUser.uid : null,
      authAttached, tokenError,
      status: null, ok: false, fetchError: e && e.message ? e.message : String(e)
    });
    throw e;
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (e) {}
  return true;
}

/**
 * Step 1 of signup: ask the Cloudflare Worker to generate a 4-digit code, store it
 * server-side, and email it via EmailJS. The account is NOT created yet - it only
 * gets created (see verifySignupOtpAndCreateAccount) once the server confirms the
 * code was entered correctly, which is what makes this unbypassable from client JS.
 */
export async function sendSignupOtp(email, displayName) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const res = await fetch(`${OTP_WORKER_BASE}/send-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, displayName })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || 'Could not send the verification email right now.' };
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Step 2 of signup: the Worker verifies the code server-side; only if it confirms
 * success do we create the real Firebase Auth account and its Firestore profile doc.
 */
export async function verifySignupOtpAndCreateAccount(email, code, password, displayName, profile) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  try {
    const res = await fetch(`${OTP_WORKER_BASE}/verify-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verified) return { success: false, error: data.error || 'Verification failed.' };
  } catch (e) {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      return { success: false, error: 'An account with this email address already exists. Please sign in instead.' };
    }
    return { success: false, error: 'Account creation failed. Please check your connection and try again.' };
  }

  const uid = cred.user.uid;
  const username = `@${cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '')}`;
  const fullProfile = { ...(profile || {}), name: displayName.trim(), email: cleanEmail, username };

  await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: uid },
        displayName: { stringValue: displayName.trim() },
        email: { stringValue: cleanEmail },
        username: { stringValue: username },
        createdAt: { stringValue: new Date().toISOString() },
        profile: { mapValue: { fields: objectToFirestoreFields(fullProfile) } }
      }
    })
  }).catch(() => {});

  return {
    success: true,
    user: { uid, displayName: displayName.trim(), email: cleanEmail, username, profile: fullProfile }
  };
}

/** Asks the Worker to send a password-reset code via EmailJS. */
export async function sendResetOtp(email) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const res = await fetch(`${OTP_WORKER_BASE}/send-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || `No account found matching email "${cleanEmail}".` };
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Checks the reset code alone (without consuming it) so the UI can show an
 * immediate error before asking for a new password, instead of only finding out
 * the code was wrong after the user has already filled out the next screen.
 */
export async function verifyResetOtp(email, code) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const res = await fetch(`${OTP_WORKER_BASE}/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verified) return { success: false, error: data.error || 'Invalid reset code.' };
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Sends the code + new password together - the Worker verifies the code server-side
 * and only then updates the Firebase Auth password via an Admin-authenticated call,
 * then we sign the user in with their new password to get a real session.
 */
export async function confirmPasswordReset(email, code, newPassword) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const res = await fetch(`${OTP_WORKER_BASE}/confirm-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) return { success: false, error: data.error || 'Password reset failed. Please try again.' };
  } catch (e) {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }

  return loginUserInDb(cleanEmail, newPassword);
}

/** Converts a plain JS object into Firestore REST API's typed field format (flat values only). */
function objectToFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      fields[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

/**
 * Legacy Password Hash Verification (PBKDF2-SHA256 via the browser's Web Crypto
 * API) - ONLY used to verify pre-migration accounts (created before real Firebase
 * Authentication was adopted) during their one-time migration in loginUserInDb.
 * New accounts never touch this - Firebase Auth owns all credential storage now.
 */
const PBKDF2_ITERATIONS = 100000;

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function derivePasswordHash(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBuffer(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: bufferToHex(derivedBits), salt: bufferToHex(salt) };
}

/**
 * Local Account Cache Purge Helper
 */
export function getLocalDbAccounts() {
  try {
    return JSON.parse(localStorage.getItem('pacepulse_accounts') || '{}');
  } catch (e) {
    return {};
  }
}

export function saveLocalDbAccounts(accounts) {
  try {
    localStorage.setItem('pacepulse_accounts', JSON.stringify(accounts));
  } catch (e) {}
}

export function purgeLocalDbAccount(email) {
  try {
    const accounts = getLocalDbAccounts();
    delete accounts[email.trim().toLowerCase()];
    saveLocalDbAccounts(accounts);
  } catch (e) {}
}

/**
 * Save Daily Step Log to Firestore Database (Includes 24 Hourly Buckets!)
 */
export async function saveDailyLogsToDb(uid, dateStr, totalSteps, goal, caloriesData, hourlyData, elevationGainM = 0) {
  if (!uid || uid === 'guest') return false;

  try {
    const hourlyValues = (hourlyData || []).map(h => ({
      mapValue: {
        fields: {
          hour: { integerValue: String(h.hour || 0) },
          label: { stringValue: h.label || `${String(h.hour || 0).padStart(2, '0')}:00` },
          steps: { integerValue: String(h.steps || 0) }
        }
      }
    }));

    const computedKcal = (caloriesData && typeof caloriesData.activeKcal === 'number' && caloriesData.activeKcal > 0)
      ? caloriesData.activeKcal
      : Math.round(totalSteps * 0.04);

    const computedDist = (caloriesData && typeof caloriesData.distanceKm === 'number' && caloriesData.distanceKm > 0)
      ? caloriesData.distanceKm
      : Math.round((totalSteps * 0.72) / 10) / 100;

    const firestoreBody = {
      fields: {
        date: { stringValue: dateStr },
        steps: { integerValue: String(totalSteps) },
        goal: { integerValue: String(goal) },
        activeKcal: { integerValue: String(computedKcal) },
        distanceKm: { doubleValue: Number(computedDist) },
        elevationGainM: { doubleValue: Number(elevationGainM) || 0 },
        updatedAt: { stringValue: new Date().toISOString() },
        hourly: {
          arrayValue: {
            values: hourlyValues
          }
        }
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs/${dateStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      console.log(`✅ Daily Log for ${dateStr} saved to Firestore 'users/${uid}/daily_logs'!`);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Persists profile settings (weight, height, goal, gender, etc.) to the user's
 * Firestore doc. Without this, edits made in the Profile modal only ever lived in
 * localStorage - a reinstall (which wipes the WebView's local storage) would
 * silently roll the user back to whatever profile existed at signup time.
 */
export async function saveUserProfileToDb(uid, profile) {
  if (!uid || uid === 'guest') return;
  try {
    await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}?updateMask.fieldPaths=profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          profile: { mapValue: { fields: objectToFirestoreFields(profile || {}) } }
        }
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Fetches a user's Firestore profile doc (users/{uid}) and shapes it into the
 * app's expected user object. Falls back to sane defaults if the doc is missing.
 */
export async function fetchUserProfileDoc(uid, fallbackEmail) {
  const rawTag = fallbackEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
  try {
    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}`);
    if (res && res.ok) {
      const docData = await res.json();
      const f = docData.fields || {};
      const pFields = f.profile && f.profile.mapValue ? f.profile.mapValue.fields : {};
      // Firestore's REST API stores whole numbers as integerValue and fractional
      // numbers as doubleValue - a field can legitimately arrive as either
      // depending on what was last saved, so both must be checked.
      const num = (field, fallback) => field && (field.integerValue !== undefined || field.doubleValue !== undefined)
        ? Number(field.integerValue !== undefined ? field.integerValue : field.doubleValue)
        : fallback;
      return {
        uid,
        displayName: f.displayName ? f.displayName.stringValue : fallbackEmail.split('@')[0],
        email: f.email ? f.email.stringValue : fallbackEmail,
        username: f.username ? f.username.stringValue : `@${rawTag}`,
        createdAt: f.createdAt ? f.createdAt.stringValue : new Date().toISOString(),
        profile: {
          ...DEFAULT_PROFILE,
          name: pFields.name ? pFields.name.stringValue : fallbackEmail.split('@')[0],
          email: fallbackEmail,
          username: f.username ? f.username.stringValue : `@${rawTag}`,
          gender: pFields.gender ? pFields.gender.stringValue : 'male',
          birthDate: pFields.birthDate ? pFields.birthDate.stringValue : '2000-01-01',
          age: num(pFields.age, 25),
          heightCm: num(pFields.heightCm, 175),
          weightKg: num(pFields.weightKg, 70),
          dailyGoal: num(pFields.dailyGoal, 10000),
          strideCm: num(pFields.strideCm, DEFAULT_PROFILE.strideCm),
          heightUnit: pFields.heightUnit ? pFields.heightUnit.stringValue : DEFAULT_PROFILE.heightUnit,
          weightUnit: pFields.weightUnit ? pFields.weightUnit.stringValue : DEFAULT_PROFILE.weightUnit,
          useAutoStride: pFields.useAutoStride ? pFields.useAutoStride.booleanValue : DEFAULT_PROFILE.useAutoStride
        }
      };
    }
  } catch (e) {}

  return {
    uid,
    displayName: fallbackEmail.split('@')[0],
    email: fallbackEmail,
    username: `@${rawTag}`,
    createdAt: new Date().toISOString(),
    profile: {
      name: fallbackEmail.split('@')[0], email: fallbackEmail, username: `@${rawTag}`,
      gender: 'male', birthDate: '2000-01-01', age: 25, heightCm: 175, weightKg: 70, dailyGoal: 10000
    }
  };
}

/**
 * One-time migration for accounts created before real Firebase Authentication was
 * adopted: mints a real Firebase Auth account (the password was already verified
 * against the legacy hash by the caller), copies the Firestore doc + subcollections
 * to the new uid (fixing up reverse friend references), then deletes the old doc.
 */
async function migrateLegacyAccountToFirebaseAuth(oldUid, cleanEmail, cleanPassword, legacyFields) {
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
  const newUid = cred.user.uid;

  const { passwordHash, passwordSalt, password, ...profileFields } = legacyFields;
  profileFields.uid = { stringValue: newUid };
  await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${newUid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: profileFields })
  }).catch(() => {});

  for (const subcollection of ['daily_logs', 'pending_requests', 'friends']) {
    const docs = await listSubcollectionDocs(oldUid, subcollection);
    for (const doc of docs) {
      const docId = doc.name.split('/').pop();
      await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${newUid}/${subcollection}/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: doc.fields || {} })
      }).catch(() => {});

      if (subcollection === 'friends') {
        const friendUid = docId;
        const reverseDocs = await listSubcollectionDocs(friendUid, 'friends');
        const reverseDoc = reverseDocs.find(d => d.name.split('/').pop() === oldUid);
        if (reverseDoc) {
          await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${friendUid}/friends/${newUid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { ...(reverseDoc.fields || {}), id: { stringValue: newUid } } })
          }).catch(() => {});
          await deleteFirestoreDocByUrl(`${FIRESTORE_REST_BASE}/users/${friendUid}/friends/${oldUid}`);
        }
      }

      await deleteFirestoreDocByUrl(`https://firestore.googleapis.com/v1/${doc.name}`);
    }
  }

  await deleteFirestoreDocByUrl(`${FIRESTORE_REST_BASE}/users/${oldUid}`);

  return newUid;
}

async function listSubcollectionDocs(uid, subcollection) {
  try {
    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/${subcollection}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      return data.documents || [];
    }
  } catch (e) {}
  return [];
}

/**
 * Sign In User with Real Firebase Authentication
 */
export async function loginUserInDb(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    const user = await fetchUserProfileDoc(cred.user.uid, cleanEmail);
    return { success: true, user };
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      // Might be a legacy pre-migration account - check for one and migrate if the password matches
      const legacyUid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      try {
        const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${legacyUid}`);
        if (res && res.ok) {
          const docData = await res.json();
          const f = docData.fields || {};
          const dbPasswordHash = f.passwordHash ? f.passwordHash.stringValue : '';
          const dbPasswordSalt = f.passwordSalt ? f.passwordSalt.stringValue : '';

          if (dbPasswordHash && dbPasswordSalt) {
            const { hash: attemptHash } = await derivePasswordHash(cleanPassword, dbPasswordSalt);
            if (attemptHash === dbPasswordHash) {
              const newUid = await migrateLegacyAccountToFirebaseAuth(legacyUid, cleanEmail, cleanPassword, f);
              const user = await fetchUserProfileDoc(newUid, cleanEmail);
              return { success: true, user };
            }
          }
        }
      } catch (e) {}

      return { success: false, error: 'Incorrect email or password. Please try again.' };
    }

    if (err.code === 'auth/too-many-requests') {
      return { success: false, error: 'Too many failed attempts. Please wait a moment and try again.' };
    }

    return { success: false, error: 'Database network error. Please check your internet connection and try again.' };
  }
}

/**
 * Validate if a target user exists in Firebase Database (Multi-Field Search)
 */
export async function validateUserExistsInDb(searchQuery) {
  const rawInput = searchQuery.trim();
  if (!rawInput) return { exists: false, error: 'Please enter a valid User ID / Tag (e.g. @Nevil3), email, or name.' };

  // For direct document lookup, use the raw email (with @) to match registration format
  const cleanForDoc = rawInput.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const docUid = `usr_${cleanForDoc}`;

  // For collection scan matching, strip @ prefix for username comparisons
  const clean = rawInput.toLowerCase().replace(/^@/, '');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // 1. Direct Document ID check (usr_...)
    const directRes = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${docUid}`, { signal: controller.signal }).catch(() => null);
    if (directRes && directRes.ok) {
      const docData = await directRes.json();
      if (docData && docData.fields) {
        const f = docData.fields;
        return {
          exists: true,
          targetUser: {
            uid: f.uid ? f.uid.stringValue : docUid,
            displayName: f.displayName ? f.displayName.stringValue : clean,
            email: f.email ? f.email.stringValue : `${clean}@example.com`,
            username: f.username ? f.username.stringValue : `@${clean}`
          }
        };
      }
    }

    // 2. Scan /users collection to match username, email, displayName, or prefix
    const listRes = await firestoreFetch(`${FIRESTORE_REST_BASE}/users`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (listRes && listRes.ok) {
      const data = await listRes.json();
      if (data.documents && Array.isArray(data.documents)) {
        for (const doc of data.documents) {
          if (doc.fields) {
            const f = doc.fields;
            const docEmail = (f.email?.stringValue || '').toLowerCase();
            const docUsername = (f.username?.stringValue || '').toLowerCase().replace('@', '');
            const docName = (f.displayName?.stringValue || '').toLowerCase();
            const docUidVal = (f.uid?.stringValue || '').toLowerCase();
            const emailPrefix = docEmail.split('@')[0];

            if (
              docUsername === clean ||
              docEmail === clean ||
              emailPrefix === clean ||
              docName === clean ||
              docUidVal === docUid
            ) {
              const docId = doc.name.split('/').pop();
              return {
                exists: true,
                targetUser: {
                  uid: docId,
                  displayName: f.displayName ? f.displayName.stringValue : (f.name ? f.name.stringValue : clean),
                  email: f.email ? f.email.stringValue : `${clean}@example.com`,
                  username: f.username ? f.username.stringValue : `@${clean}`
                }
              };
            }
          }
        }
      }
    }
  } catch (e) {}

  // Deliberately no local-cache fallback here: `pacepulse_accounts` is a leftover
  // from before real Firebase Authentication existed, nothing writes new entries
  // into it anymore, and trusting it let searches "find" and send requests to
  // accounts that had been fully deleted from the real database - the DB is the
  // only thing that should ever get to say an account exists.
  return { exists: false, error: `No user found matching "${searchQuery}" in Cloud Database. Please check the spelling.` };
}

/**
 * 2-Way Friend Request Cloud Firestore Sync
 */
export async function sendFriendRequestInDb(senderUser, targetUser) {
  const senderUid = senderUser.uid || `usr_${senderUser.email.replace(/[^a-z0-9]/g, '_')}`;
  const senderName = senderUser.displayName || senderUser.profile?.name || senderUser.email.split('@')[0];
  const senderEmail = senderUser.email;
  const senderTag = senderUser.username || senderUser.profile?.username || `@${senderEmail.split('@')[0]}`;

  const targetUid = targetUser.uid;
  const reqId = `req_${Date.now()}`;

  const outgoingObj = {
    id: reqId,
    toUid: targetUid,
    toName: targetUser.displayName || targetUser.name || 'Friend',
    toEmail: targetUser.email,
    sentAt: new Date().toISOString()
  };

  const pendingObj = {
    id: reqId,
    fromUid: senderUid,
    name: senderName,
    email: senderEmail,
    username: senderTag,
    sentAt: new Date().toISOString()
  };

  // 1. Store Outgoing Request locally for Sender
  try {
    const outKey = `pacepulse_outgoing_${senderUid}`;
    const outSaved = JSON.parse(localStorage.getItem(outKey) || '[]');
    if (!outSaved.some(r => r.toUid === targetUid)) {
      outSaved.push(outgoingObj);
      localStorage.setItem(outKey, JSON.stringify(outSaved));
    }
  } catch (e) {}

  // 2. AWAIT Direct Cloud Firestore Write to Receiver's pending_requests subcollection!
  try {
    const firestoreBody = {
      fields: {
        id: { stringValue: reqId },
        fromUid: { stringValue: senderUid },
        name: { stringValue: senderName },
        email: { stringValue: senderEmail },
        username: { stringValue: senderTag },
        sentAt: { stringValue: new Date().toISOString() }
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${targetUid}/pending_requests/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      console.log(`✅ Friend Request successfully saved in Cloud Firestore for receiver '${targetUid}'!`);
    } else {
      console.error(`⚠️ Cloud Firestore pending_request write returned: ${res ? res.status : 'Network error'}`);
    }
  } catch (e) {}

  return outgoingObj;
}

export async function getPendingRequestsFromDb(uid) {
  if (!uid || uid === 'guest') return [];

  const pendingKey = `pacepulse_pending_${uid}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/pending_requests`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      const remoteList = (data.documents && Array.isArray(data.documents))
        ? data.documents.map(doc => {
            const f = doc.fields;
            return {
              id: f.id ? f.id.stringValue : doc.name.split('/').pop(),
              fromUid: f.fromUid ? f.fromUid.stringValue : '',
              name: f.name ? f.name.stringValue : 'Friend',
              email: f.email ? f.email.stringValue : '',
              username: f.username ? f.username.stringValue : '@user',
              sentAt: f.sentAt ? f.sentAt.stringValue : new Date().toISOString()
            };
          })
        : [];

      // Update local storage directly with authoritative remote list from Cloud Firestore!
      localStorage.setItem(pendingKey, JSON.stringify(remoteList));
      return remoteList;
    }
  } catch (e) {}

  try {
    return JSON.parse(localStorage.getItem(pendingKey) || '[]');
  } catch (e) {
    return [];
  }
}

export function getOutgoingRequestsFromDb(uid) {
  if (!uid || uid === 'guest') return [];
  const outKey = `pacepulse_outgoing_${uid}`;
  try {
    return JSON.parse(localStorage.getItem(outKey) || '[]');
  } catch (e) {
    return [];
  }
}

export async function acceptFriendRequestInDb(currentUser, reqItem) {
  const myUid = currentUser.uid || `usr_${currentUser.email.replace(/[^a-z0-9]/g, '_')}`;
  const myName = currentUser.displayName || currentUser.profile?.name || currentUser.email.split('@')[0];
  const myEmail = currentUser.email;

  const friendObjForMe = {
    id: reqItem.fromUid,
    name: reqItem.name,
    email: reqItem.email,
    username: reqItem.username,
    status: 'connected',
    connectedAt: new Date().toISOString()
  };

  const friendObjForTarget = {
    id: myUid,
    name: myName,
    email: myEmail,
    username: currentUser.username || `@${myEmail.split('@')[0]}`,
    status: 'connected',
    connectedAt: new Date().toISOString()
  };

  const myFriendsKey = `pacepulse_friends_${myUid}`;
  const myFriends = JSON.parse(localStorage.getItem(myFriendsKey) || '[]');
  if (!myFriends.some(f => f.id === reqItem.fromUid)) {
    myFriends.push(friendObjForMe);
    localStorage.setItem(myFriendsKey, JSON.stringify(myFriends));
  }

  const friendUid = reqItem.fromUid;
  if (friendUid) {
    const friendKey = `pacepulse_friends_${friendUid}`;
    const friendList = JSON.parse(localStorage.getItem(friendKey) || '[]');
    if (!friendList.some(f => f.id === myUid)) {
      friendList.push(friendObjForTarget);
      localStorage.setItem(friendKey, JSON.stringify(friendList));
    }
  }

  // Await removal from pending requests!
  await declineFriendRequestInDb(myUid, reqItem.id);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    await Promise.all([
      firestoreFetch(`${FIRESTORE_REST_BASE}/users/${myUid}/friends/${reqItem.fromUid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { id: { stringValue: reqItem.fromUid }, name: { stringValue: reqItem.name }, email: { stringValue: reqItem.email } } }),
        signal: controller.signal
      }).catch(() => {}),
      firestoreFetch(`${FIRESTORE_REST_BASE}/users/${reqItem.fromUid}/friends/${myUid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { id: { stringValue: myUid }, name: { stringValue: myName }, email: { stringValue: myEmail } } }),
        signal: controller.signal
      }).catch(() => {})
    ]);

    clearTimeout(timeoutId);
  } catch (e) {}

  return myFriends;
}

export async function declineFriendRequestInDb(uid, reqId) {
  const pendingKey = `pacepulse_pending_${uid}`;
  const saved = JSON.parse(localStorage.getItem(pendingKey) || '[]');
  const updated = saved.filter(r => r.id !== reqId);
  localStorage.setItem(pendingKey, JSON.stringify(updated));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/pending_requests/${reqId}`, {
      method: 'DELETE',
      signal: controller.signal
    }).catch(() => {});

    clearTimeout(timeoutId);
  } catch (e) {}

  return updated;
}

export function cancelOutgoingRequestInDb(uid, reqId) {
  const outKey = `pacepulse_outgoing_${uid}`;
  const saved = JSON.parse(localStorage.getItem(outKey) || '[]');
  const updated = saved.filter(r => r.id !== reqId);
  localStorage.setItem(outKey, JSON.stringify(updated));
  return updated;
}

export function getLocalFriendsList(uid) {
  if (!uid || uid === 'guest') return [];
  const friendsKey = `pacepulse_friends_${uid}`;
  try {
    const saved = localStorage.getItem(friendsKey);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export async function getFriendsListFromDb(uid) {
  if (!uid || uid === 'guest') return [];
  const friendsKey = `pacepulse_friends_${uid}`;
  const localSaved = getLocalFriendsList(uid);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/friends`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        const remoteFriends = data.documents.map(doc => {
          const f = doc.fields;
          return {
            id: f.id ? f.id.stringValue : doc.name.split('/').pop(),
            name: f.name ? f.name.stringValue : 'Friend',
            email: f.email ? f.email.stringValue : '',
            username: f.username ? f.username.stringValue : '@user',
            status: 'connected'
          };
        });

        localStorage.setItem(friendsKey, JSON.stringify(remoteFriends));
        return remoteFriends;
      }
    }
  } catch (e) {}

  return localSaved;
}

export function queueOfflineDailyLog(uid, dateStr, totalSteps, goal, caloriesData, hourlyData, elevationGainM = 0) {
  try {
    const queueKey = `pacepulse_offline_queue_${uid}`;
    const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
    const item = { uid, dateStr, totalSteps, goal, caloriesData, hourlyData, elevationGainM, timestamp: Date.now() };
    const filtered = existing.filter(i => i.dateStr !== dateStr);
    filtered.push(item);
    localStorage.setItem(queueKey, JSON.stringify(filtered));
  } catch (e) {}
}

export async function flushOfflineSyncQueue(uid) {
  if (!uid || uid === 'guest' || !navigator.onLine) return false;

  try {
    const queueKey = `pacepulse_offline_queue_${uid}`;
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    if (!queue || queue.length === 0) return true;

    for (const item of queue) {
      await saveDailyLogsToDb(item.uid, item.dateStr, item.totalSteps, item.goal, item.caloriesData, item.hourlyData, item.elevationGainM || 0);
    }

    localStorage.removeItem(queueKey);
    return true;
  } catch (e) {
    return false;
  }
}

export function removeFriendInDb(uid, friendId) {
  const friendsKey = `pacepulse_friends_${uid}`;
  const saved = JSON.parse(localStorage.getItem(friendsKey) || '[]');
  const updated = saved.filter(f => f.id !== friendId);
  localStorage.setItem(friendsKey, JSON.stringify(updated));

  if (friendId) {
    const targetFriendsKey = `pacepulse_friends_${friendId}`;
    const targetSaved = JSON.parse(localStorage.getItem(targetFriendsKey) || '[]');
    const targetUpdated = targetSaved.filter(f => f.id !== uid);
    localStorage.setItem(targetFriendsKey, JSON.stringify(targetUpdated));
  }

  try {
    firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/friends/${friendId}`, { method: 'DELETE' });
    firestoreFetch(`${FIRESTORE_REST_BASE}/users/${friendId}/friends/${uid}`, { method: 'DELETE' });
  } catch (e) {}

  return updated;
}

async function deleteFirestoreDocByUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    await firestoreFetch(url, { method: 'DELETE', signal: controller.signal }).catch(() => {});
    clearTimeout(timeoutId);
  } catch (e) {}
}

async function listSubcollectionDocIds(uid, subcollection) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/${subcollection}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const data = await res.json();
      const docs = data.documents || [];
      return docs.map(doc => doc.name.split('/').pop());
    }
  } catch (e) {}
  return [];
}

/**
 * Permanently Delete a User Account - Cloud Firestore Doc, All Subcollections
 * (daily_logs, pending_requests, friends), Reverse Friend References on Other
 * Users, Outstanding Sent Friend Requests, and All Local Device Caches.
 */
export async function deleteUserAccountFromDb(uid, email) {
  if (!uid || uid === 'guest') return { success: false };

  try {
    // 1. Remove this user from each friend's own friends subcollection (reverse reference)
    const friendIds = await listSubcollectionDocIds(uid, 'friends');
    await Promise.all(friendIds.map(friendId =>
      deleteFirestoreDocByUrl(`${FIRESTORE_REST_BASE}/users/${friendId}/friends/${uid}`)
    ));

    // 2. Cancel any pending friend requests this user sent to others
    const outgoing = getOutgoingRequestsFromDb(uid);
    await Promise.all(outgoing.map(req =>
      req.toUid ? deleteFirestoreDocByUrl(`${FIRESTORE_REST_BASE}/users/${req.toUid}/pending_requests/${req.id}`) : Promise.resolve()
    ));

    // 3. Delete this user's own subcollections
    for (const subcollection of ['friends', 'pending_requests', 'daily_logs']) {
      const ids = await listSubcollectionDocIds(uid, subcollection);
      await Promise.all(ids.map(id =>
        deleteFirestoreDocByUrl(`${FIRESTORE_REST_BASE}/users/${uid}/${subcollection}/${id}`)
      ));
    }

    // 4. Delete the user document itself
    await deleteFirestoreDocByUrl(`${FIRESTORE_REST_BASE}/users/${uid}`);
  } catch (e) {}

  // 5. Delete the actual Firebase Auth credential (only possible while signed in as
  // that user, which account deletion always is)
  if (auth.currentUser && auth.currentUser.uid === uid) {
    try {
      await deleteUser(auth.currentUser);
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, error: 'For your security, please sign out and back in, then try deleting your account again.' };
      }
    }
  }

  // 6. Purge every local cache tied to this account
  if (email) purgeLocalDbAccount(email);
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(uid)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}

  return { success: true };
}

/**
 * Fetch Today's Steps & Stats for Connected Friends from Cloud Firestore
 */
export async function getTodayStepsForFriends(friendsList, dateStr) {
  if (!Array.isArray(friendsList) || friendsList.length === 0) return [];

  const updatedFriends = await Promise.all(
    friendsList.map(async (friend) => {
      if (!friend || !friend.id) return friend;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${friend.id}/daily_logs/${dateStr}`, {
          signal: controller.signal
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.fields) {
            const steps = Number(data.fields.steps?.integerValue || 0);
            const goal = Number(data.fields.goal?.integerValue || 10000);
            const activeKcal = Number(data.fields.activeKcal?.integerValue || Math.round(steps * 0.04));
            const distanceKm = Number(data.fields.distanceKm?.doubleValue || Math.round((steps * 0.72) / 10) / 100);

            return {
              ...friend,
              steps,
              goal,
              kcal: activeKcal,
              dist: distanceKm
            };
          }
        }
      } catch (e) {}

      return {
        ...friend,
        steps: friend.steps || 0,
        kcal: friend.kcal || Math.round((friend.steps || 0) * 0.04),
        dist: friend.dist || Math.round(((friend.steps || 0) * 0.72) / 10) / 100
      };
    })
  );

  return updatedFriends;
}

export async function getDailyLogsFromDb(uid) {
  if (!uid || uid === 'guest') return [];

  try {
    // This is the sole hydration path for a user's entire step/goal history after
    // login (e.g. right after a reinstall, when the local cache has just been
    // wiped) - a single timed-out request here used to silently render as "no
    // history" with no retry, even though the data was still safe in Firestore.
    // One retry with a longer timeout gives a cold-started WebView (fresh
    // install, first network call, OS still finishing package setup) a second
    // chance before giving up.
    let res = null;
    for (const timeoutMs of [8000, 15000]) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      res = await firestoreFetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) break;
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        return data.documents.map(doc => {
          const f = doc.fields;
          const stepsVal = f.steps ? Number(f.steps.integerValue || f.steps.doubleValue || 0) : 0;
          const goalVal = f.goal ? Number(f.goal.integerValue || f.goal.doubleValue || 10000) : 10000;
          const rawKcal = f.activeKcal ? Number(f.activeKcal.integerValue || f.activeKcal.doubleValue || 0) : 0;
          const rawDist = f.distanceKm ? Number(f.distanceKm.doubleValue || f.distanceKm.integerValue || 0) : 0;
          const elevationGainM = f.elevationGainM ? Number(f.elevationGainM.doubleValue || f.elevationGainM.integerValue || 0) : 0;

          const computedKcal = rawKcal > 0 ? rawKcal : Math.round(stepsVal * 0.04);
          const computedDist = rawDist > 0 ? rawDist : Math.round((stepsVal * 0.72) / 10) / 100;

          let hourlyArr = f.hourly && f.hourly.arrayValue && f.hourly.arrayValue.values
            ? f.hourly.arrayValue.values.map(item => ({
                hour: Number(item.mapValue?.fields?.hour?.integerValue || item.mapValue?.fields?.hour?.doubleValue || 0),
                label: item.mapValue?.fields?.label?.stringValue || `${String(item.mapValue?.fields?.hour?.integerValue || 0).padStart(2, '0')}:00`,
                steps: Number(item.mapValue?.fields?.steps?.integerValue || item.mapValue?.fields?.steps?.doubleValue || 0)
              }))
            : null;

          if (!hourlyArr || hourlyArr.length < 24) {
            hourlyArr = Array.from({ length: 24 }, (_, i) => ({
              hour: i,
              label: `${i.toString().padStart(2, '0')}:00`,
              steps: 0
            }));
          }

          return {
            date: f.date ? f.date.stringValue : '',
            steps: stepsVal,
            goal: goalVal,
            activeKcal: computedKcal,
            distanceKm: computedDist,
            elevationGainM,
            completed: stepsVal >= goalVal && stepsVal > 0,
            hourlyData: hourlyArr
          };
        });
      }
    }
  } catch (e) {}

  return [];
}
