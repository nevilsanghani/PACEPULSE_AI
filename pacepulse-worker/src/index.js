import { sendOtpEmail } from './emailjs.js';
import { getGoogleAccessToken, firebaseAdminLookupUserByEmail, firebaseAdminUpdatePassword } from './firebaseAdmin.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from './passwordPolicy.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// A 4-digit code only has 10,000 combinations, so capping wrong guesses is what
// actually stops it being brute-forced within its 10-minute validity window.
const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

function sanitizeEmailKey(email) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function generateOtpCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const url = new URL(request.url);
    let body = {};
    try { body = await request.json(); } catch (e) {}

    try {
      if (url.pathname === '/send-signup-otp') return await handleSendSignupOtp(body, env);
      if (url.pathname === '/verify-signup-otp') return await handleVerifySignupOtp(body, env);
      if (url.pathname === '/send-reset-otp') return await handleSendResetOtp(body, env);
      if (url.pathname === '/verify-reset-otp') return await handleVerifyResetOtp(body, env);
      if (url.pathname === '/confirm-password-reset') return await handleConfirmPasswordReset(body, env);
      return json(404, { error: 'Not found' });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'Something went wrong. Please try again.' });
    }
  }
};

async function handleSendSignupOtp(body, env) {
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  const displayName = body.displayName || 'PacePulse User';
  if (!cleanEmail) return json(400, { error: 'Email is required.' });

  const code = generateOtpCode();
  const expiresAt = Date.now() + OTP_TTL_MS;
  await env.OTP_STORE.put(`signup:${sanitizeEmailKey(cleanEmail)}`, JSON.stringify({ code, expiresAt, attempts: 0 }), { expirationTtl: 900 });

  const emailResult = await sendOtpEmail(env, { toEmail: cleanEmail, toName: displayName, otpCode: code, purpose: 'signup' });
  if (!emailResult.sent) return json(502, { error: 'Could not send the verification email right now. Please try again.' });
  return json(200, { sent: true });
}

async function handleVerifySignupOtp(body, env) {
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  const cleanCode = String(body.code || '').trim();
  if (!cleanEmail || !cleanCode) return json(400, { error: 'Missing required fields.' });

  const key = `signup:${sanitizeEmailKey(cleanEmail)}`;
  const raw = await env.OTP_STORE.get(key);
  if (!raw) return json(400, { error: 'No verification code was requested for this email. Please start sign up again.' });

  const data = JSON.parse(raw);
  if (Date.now() > data.expiresAt) {
    await env.OTP_STORE.delete(key);
    return json(400, { error: 'Verification code has expired. Please request a new one.' });
  }
  if ((data.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    await env.OTP_STORE.delete(key);
    return json(429, { error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (data.code !== cleanCode) {
    data.attempts = (data.attempts || 0) + 1;
    await env.OTP_STORE.put(key, JSON.stringify(data), { expirationTtl: 900 });
    return json(400, { error: 'Invalid verification code.' });
  }

  await env.OTP_STORE.delete(key);
  return json(200, { verified: true });
}

async function handleVerifyResetOtp(body, env) {
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  const cleanCode = String(body.code || '').trim();
  if (!cleanEmail || !cleanCode) return json(400, { error: 'Missing required fields.' });

  const key = `reset:${sanitizeEmailKey(cleanEmail)}`;
  const raw = await env.OTP_STORE.get(key);
  if (!raw) return json(400, { error: 'No reset code was requested for this email. Please start again.' });

  const data = JSON.parse(raw);
  if (Date.now() > data.expiresAt) {
    await env.OTP_STORE.delete(key);
    return json(400, { error: 'Reset code has expired. Please request a new one.' });
  }
  if ((data.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    await env.OTP_STORE.delete(key);
    return json(429, { error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (data.code !== cleanCode) {
    data.attempts = (data.attempts || 0) + 1;
    await env.OTP_STORE.put(key, JSON.stringify(data), { expirationTtl: 900 });
    return json(400, { error: 'Invalid reset code.' });
  }

  // Deliberately NOT deleted here - confirm-password-reset checks the code again
  // right before actually changing the password, so it stays the sole point where
  // a code becomes single-use.
  return json(200, { verified: true });
}

async function handleSendResetOtp(body, env) {
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  if (!cleanEmail) return json(400, { error: 'Email is required.' });

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getGoogleAccessToken(env.FIREBASE_SERVICE_ACCOUNT);
  const user = await firebaseAdminLookupUserByEmail(accessToken, sa.project_id, cleanEmail);
  if (!user) return json(404, { error: `No account found matching email "${cleanEmail}".` });

  const code = generateOtpCode();
  const expiresAt = Date.now() + OTP_TTL_MS;
  await env.OTP_STORE.put(`reset:${sanitizeEmailKey(cleanEmail)}`, JSON.stringify({ code, expiresAt, attempts: 0 }), { expirationTtl: 900 });

  const emailResult = await sendOtpEmail(env, { toEmail: cleanEmail, toName: 'PacePulse User', otpCode: code, purpose: 'reset' });
  if (!emailResult.sent) return json(502, { error: 'Could not send the password reset email right now. Please try again.' });
  return json(200, { sent: true });
}

async function handleConfirmPasswordReset(body, env) {
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  const cleanCode = String(body.code || '').trim();
  const newPassword = String(body.newPassword || '');
  if (!cleanEmail || !cleanCode || !newPassword) return json(400, { error: 'Missing required fields.' });
  if (!isStrongPassword(newPassword)) return json(400, { error: PASSWORD_POLICY_MESSAGE });

  const key = `reset:${sanitizeEmailKey(cleanEmail)}`;
  const raw = await env.OTP_STORE.get(key);
  if (!raw) return json(400, { error: 'No reset code was requested for this email. Please start again.' });

  const data = JSON.parse(raw);
  if (Date.now() > data.expiresAt) {
    await env.OTP_STORE.delete(key);
    return json(400, { error: 'Reset code has expired. Please request a new one.' });
  }
  if ((data.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    await env.OTP_STORE.delete(key);
    return json(429, { error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (data.code !== cleanCode) {
    data.attempts = (data.attempts || 0) + 1;
    await env.OTP_STORE.put(key, JSON.stringify(data), { expirationTtl: 900 });
    return json(400, { error: 'Invalid reset code.' });
  }

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getGoogleAccessToken(env.FIREBASE_SERVICE_ACCOUNT);
  const user = await firebaseAdminLookupUserByEmail(accessToken, sa.project_id, cleanEmail);
  if (!user) return json(404, { error: `No account found matching email "${cleanEmail}".` });

  await firebaseAdminUpdatePassword(accessToken, sa.project_id, user.localId, newPassword);
  await env.OTP_STORE.delete(key);
  return json(200, { success: true });
}
