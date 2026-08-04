/**
 * PacePulse AI - Email OTP Service
 * 
 * This service attempts to send real emails via EmailJS.
 * To enable real email delivery:
 *   1. Go to https://www.emailjs.com/ and create a free account
 *   2. Add an Email Service (Gmail, Outlook, etc.)
 *   3. Create an Email Template with variables: {{to_name}}, {{otp_code}}, {{purpose}}
 *   4. Copy your Service ID, Template ID, and Public Key
 *   5. In the app, the OTP is always shown as a backup code in the green banner
 */

const EMAILJS_CONFIG_KEY = 'pacepulse_emailjs_config';

export function getEmailConfig() {
  try {
    const saved = localStorage.getItem(EMAILJS_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
}

export function saveEmailConfig(config) {
  try {
    localStorage.setItem(EMAILJS_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {}
}

/**
 * Send OTP Email via EmailJS REST API
 * Returns { sent: true/false, method: string }
 */
export async function sendRealEmailOtp({ toEmail, toName = 'User', otpCode, purpose = 'signup' }) {
  const config = getEmailConfig();
  
  const purposeText = purpose === 'signup' 
    ? 'Account Email Verification' 
    : 'Password Reset';

  // Only attempt EmailJS if user has configured real credentials
  if (config && config.serviceId && config.templateId && config.publicKey) {
    try {
      const payload = {
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
          to_email: toEmail,
          to_name: toName,
          otp_code: otpCode,
          purpose: purposeText,
          message: `Your PacePulse AI ${purposeText} code is: ${otpCode}. Valid for 10 minutes.`
        }
      };

      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        return { sent: true, method: 'emailjs' };
      }
    } catch (err) {
      console.warn('EmailJS dispatch failed:', err);
    }
  }

  // No email service configured — OTP shown in-app as backup code
  return { sent: false, method: 'in_app' };
}
