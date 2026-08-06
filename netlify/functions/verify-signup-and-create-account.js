import { getAdmin, sanitizeEmailKey, jsonResponse, handleCorsPreflight, MAX_OTP_ATTEMPTS } from './_shared/firebaseAdmin.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from './_shared/passwordPolicy.js';

export const handler = async (event) => {
  const preflight = handleCorsPreflight(event);
  if (preflight) return preflight;
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const { email, code, password, displayName, profile } = JSON.parse(event.body || '{}');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanEmail || !cleanCode || !cleanPassword || !displayName) {
      return jsonResponse(400, { error: 'Missing required fields.' });
    }

    if (!isStrongPassword(cleanPassword)) {
      return jsonResponse(400, { error: PASSWORD_POLICY_MESSAGE });
    }

    const admin = getAdmin();
    const db = admin.firestore();
    const otpRef = db.collection('signup_otps').doc(sanitizeEmailKey(cleanEmail));
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return jsonResponse(400, { error: 'No verification code was requested for this email. Please start sign up again.' });
    }

    const otpData = otpSnap.data();

    if (Date.now() > otpData.expiresAt) {
      await otpRef.delete();
      return jsonResponse(400, { error: 'Verification code has expired. Please request a new one.' });
    }

    if ((otpData.attempts || 0) >= MAX_OTP_ATTEMPTS) {
      await otpRef.delete();
      return jsonResponse(429, { error: 'Too many incorrect attempts. Please request a new code.' });
    }

    if (otpData.code !== cleanCode) {
      await otpRef.update({ attempts: (otpData.attempts || 0) + 1 });
      return jsonResponse(400, { error: 'Invalid verification code.' });
    }

    // Code verified server-side - the account is only created now, not before.
    const username = `@${cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '')}`;

    const userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password: cleanPassword,
      displayName: displayName.trim(),
      emailVerified: true
    });

    const uid = userRecord.uid;
    const fullProfile = {
      ...(profile || {}),
      name: displayName.trim(),
      email: cleanEmail,
      username
    };

    await db.collection('users').doc(uid).set({
      uid,
      displayName: displayName.trim(),
      email: cleanEmail,
      username,
      createdAt: new Date().toISOString(),
      profile: fullProfile
    });

    await otpRef.delete();

    const customToken = await admin.auth().createCustomToken(uid);

    return jsonResponse(200, {
      success: true,
      customToken,
      user: {
        uid,
        displayName: displayName.trim(),
        email: cleanEmail,
        username,
        profile: fullProfile
      }
    });
  } catch (err) {
    console.error('verify-signup-and-create-account error:', err);
    if (err.code === 'auth/email-already-exists') {
      return jsonResponse(409, { error: 'An account with this email address already exists. Please sign in instead.' });
    }
    return jsonResponse(500, { error: 'Account creation failed. Please try again.' });
  }
};
