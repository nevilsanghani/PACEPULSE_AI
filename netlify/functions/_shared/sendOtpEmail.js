/**
 * PacePulse AI - Server-side OTP Email Dispatcher (EmailJS REST API)
 * Same EmailJS service/template/public key as the (removed) client-side
 * emailService.js - the EmailJS public key is safe to use server-side too.
 */
const EMAILJS_SERVICE_ID = 'service_sez5spj';
const EMAILJS_TEMPLATE_ID = 'template_r1xq7vi';
const EMAILJS_PUBLIC_KEY = '-502sjnNrTh7AE8Cc';

export async function sendOtpEmail({ toEmail, toName = 'PacePulse User', otpCode, purpose = 'signup' }) {
  const purposeTitle = purpose === 'signup'
    ? 'Account Registration Verification'
    : 'Password Reset Request';

  const messageBody = `Hello ${toName},\n\nYour 4-digit PacePulse AI verification code for ${purposeTitle} is:\n\n🔐 ${otpCode}\n\nThis code is valid for 10 minutes. Please enter this code in your PacePulse AI app to proceed.\n\nIf you did not request this code, please ignore this email.\n\nBest regards,\nPacePulse AI Fitness Team`;

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
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

export function generateOtpCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
