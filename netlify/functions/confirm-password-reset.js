import { getAdmin, sanitizeEmailKey, jsonResponse, handleCorsPreflight, MAX_OTP_ATTEMPTS } from './_shared/firebaseAdmin.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from './_shared/passwordPolicy.js';

export const handler = async (event) => {
  const preflight = handleCorsPreflight(event);
  if (preflight) return preflight;
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const { email, code, newPassword } = JSON.parse(event.body || '{}');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const cleanPassword = String(newPassword || '').trim();

    if (!cleanEmail || !cleanCode || !cleanPassword) {
      return jsonResponse(400, { error: 'Missing required fields.' });
    }
    if (!isStrongPassword(cleanPassword)) {
      return jsonResponse(400, { error: PASSWORD_POLICY_MESSAGE });
    }

    const admin = getAdmin();
    const db = admin.firestore();
    const otpRef = db.collection('reset_otps').doc(sanitizeEmailKey(cleanEmail));
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return jsonResponse(400, { error: 'No reset code was requested for this email. Please start again.' });
    }

    const otpData = otpSnap.data();

    if (Date.now() > otpData.expiresAt) {
      await otpRef.delete();
      return jsonResponse(400, { error: 'Reset code has expired. Please request a new one.' });
    }

    if ((otpData.attempts || 0) >= MAX_OTP_ATTEMPTS) {
      await otpRef.delete();
      return jsonResponse(429, { error: 'Too many incorrect attempts. Please request a new code.' });
    }

    if (otpData.code !== cleanCode) {
      await otpRef.update({ attempts: (otpData.attempts || 0) + 1 });
      return jsonResponse(400, { error: 'Invalid reset code.' });
    }

    // Code verified server-side - only now is the password actually changed.
    const userRecord = await admin.auth().getUserByEmail(cleanEmail);
    await admin.auth().updateUser(userRecord.uid, { password: cleanPassword });

    await otpRef.delete();

    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error('confirm-password-reset error:', err);
    if (err.code === 'auth/user-not-found') {
      return jsonResponse(404, { error: 'No account found for this email.' });
    }
    return jsonResponse(500, { error: 'Password reset failed. Please try again.' });
  }
};
