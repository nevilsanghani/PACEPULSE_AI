/**
 * PacePulse AI - EmailJS OTP dispatcher (Cloudflare Worker version).
 * Authenticates with EMAILJS_PRIVATE_KEY (server-side "accessToken"). Both the
 * "Use Private Key" and "Allow EmailJS API for non-browser applications" toggles
 * need to be enabled together in the EmailJS account's Security settings for
 * server-side calls like this to be accepted.
 */
const EMAILJS_SERVICE_ID = 'service_sez5spj';
const EMAILJS_TEMPLATE_ID = 'template_r1xq7vi';
const EMAILJS_PUBLIC_KEY = '-502sjnNrTh7AE8Cc';

export async function sendOtpEmail(env, { toEmail, toName = 'PacePulse User', otpCode, purpose = 'signup' }) {
  const purposeTitle = purpose === 'signup' ? 'Account Registration Verification' : 'Password Reset Request';
  const messageBody = `Hello ${toName},\n\nYour 4-digit PacePulse AI verification code for ${purposeTitle} is:\n\n${otpCode}\n\nThis code is valid for 10 minutes. Please enter this code in your PacePulse AI app to proceed.\n\nIf you did not request this code, please ignore this email.\n\nBest regards,\nPacePulse AI Fitness Team`;

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: env.EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: toEmail,
        to_name: toName,
        otp_code: otpCode,
        purpose_title: purposeTitle,
        message: messageBody
      }
    })
  }).catch(() => null);

  return { sent: !!(res && res.ok) };
}
