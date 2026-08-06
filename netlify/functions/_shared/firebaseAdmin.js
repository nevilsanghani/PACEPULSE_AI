/**
 * PacePulse AI - Shared Firebase Admin SDK Initializer for Netlify Functions
 * Uses the FIREBASE_SERVICE_ACCOUNT env var (full service-account JSON, minified
 * to one line) - never exposed to the client, only readable by server functions.
 */
import admin from 'firebase-admin';

// Max wrong-code guesses allowed before an OTP is invalidated and a new one must
// be requested - a 4-digit code only has 10,000 combinations, so this is what
// actually stops it being brute-forced within its 10-minute validity window.
export const MAX_OTP_ATTEMPTS = 5;

let app;

export function getAdmin() {
  if (!app) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

export function sanitizeEmailKey(email) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// This site has no public web frontend - these functions are called directly by
// the Android (and future Mac) app's WebView, which is always a different origin
// than this Netlify site, so every response needs CORS headers to be reachable.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body)
  };
}

/** Call at the top of every handler to answer the browser's CORS preflight request. */
export function handleCorsPreflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  return null;
}
