import { getAdmin, sanitizeEmailKey, jsonResponse, handleCorsPreflight } from './_shared/firebaseAdmin.js';
import { sendOtpEmail, generateOtpCode } from './_shared/sendOtpEmail.js';

const OTP_TTL_MS = 10 * 60 * 1000;

export const handler = async (event) => {
  const preflight = handleCorsPreflight(event);
  if (preflight) return preflight;
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const { email } = JSON.parse(event.body || '{}');
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return jsonResponse(400, { error: 'Email is required.' });

    const admin = getAdmin();

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(cleanEmail);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        return jsonResponse(404, { error: `No account found matching email "${cleanEmail}".` });
      }
      throw e;
    }

    const code = generateOtpCode();
    const expiresAt = Date.now() + OTP_TTL_MS;

    await admin.firestore().collection('reset_otps').doc(sanitizeEmailKey(cleanEmail)).set({
      email: cleanEmail,
      code,
      expiresAt,
      attempts: 0
    });

    const emailResult = await sendOtpEmail({
      toEmail: cleanEmail,
      toName: userRecord.displayName || 'User',
      otpCode: code,
      purpose: 'password_reset'
    });

    if (!emailResult.sent) return jsonResponse(502, { error: 'Could not send the password reset email right now. Please try again.' });

    return jsonResponse(200, { sent: true });
  } catch (err) {
    console.error('send-reset-otp error:', err);
    return jsonResponse(500, { error: 'Something went wrong. Please try again.' });
  }
};
