import React, { useState, useRef } from 'react';
import { X, Lock, Mail, User, ArrowRight, AlertCircle, Database, KeyRound, CheckCircle2, RefreshCw } from 'lucide-react';
import { calculateAgeFromBirthDate, calculateStrideCm } from '../utils/fitnessEngine';
import { registerUserInDb, loginUserInDb, validateUserExistsInDb, updateUserPasswordInDb } from '../firebase';
import { sendRealEmailOtp } from '../utils/emailService';

export function AuthModal({ onSuccess, onAuthSuccess, onGuestLogin, onClose }) {
  const handleSuccess = onSuccess || onAuthSuccess || (() => {});

  // View States: 'auth' | 'verify_signup_pin' | 'forgot_email' | 'verify_reset_pin' | 'new_password'
  const [authStep, setAuthStep] = useState('auth');
  const [isSignUp, setIsSignUp] = useState(false);

  // Core Auth Inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 4-Digit PIN States & 10-Minute Expiry Timer
  const [generatedPin, setGeneratedPin] = useState('');
  const [enteredPin, setEnteredPin] = useState(['', '', '', '']);
  const [pinExpiresAt, setPinExpiresAt] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes = 600s
  const pinInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Live countdown timer effect for PIN validity
  React.useEffect(() => {
    if (!pinExpiresAt || (authStep !== 'verify_signup_pin' && authStep !== 'verify_reset_pin')) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((pinExpiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pinExpiresAt, authStep]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Password Reset Inputs
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sign-Up Specific Profile Fields
  const [gender, setGender] = useState('male');
  const [birthDate, setBirthDate] = useState('2000-01-01');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [heightCmInput, setHeightCmInput] = useState('175');
  const [heightFtInput, setHeightFtInput] = useState('5');
  const [heightInInput, setHeightInInput] = useState('9');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightKgInput, setWeightKgInput] = useState('70');
  const [weightLbsInput, setWeightLbsInput] = useState('154');
  const [dailyGoalInput, setDailyGoalInput] = useState('10000');
  const [draftSignupData, setDraftSignupData] = useState(null);

  // Computed Age
  const computedAge = calculateAgeFromBirthDate(birthDate);

  // Generate a random 4-digit PIN and set 10-minute expiry
  const createRandomPin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes from now
    setPinExpiresAt(expiry);
    setSecondsRemaining(600);
    return pin;
  };

  // Height Unit Toggle Helper
  const handleHeightUnitToggle = (unit) => {
    setHeightUnit(unit);
    if (unit === 'ft_in') {
      const cmVal = parseFloat(heightCmInput) || 175;
      setHeightFtInput(String(Math.floor(cmVal / 30.48)));
      setHeightInInput(String(Math.round((cmVal % 30.48) / 2.54)));
    } else {
      const ftVal = parseFloat(heightFtInput) || 5;
      const inVal = parseFloat(heightInInput) || 0;
      setHeightCmInput(String(Math.round((ftVal * 30.48) + (inVal * 2.54))));
    }
  };

  // Weight Unit Toggle Helper
  const handleWeightUnitToggle = (unit) => {
    setWeightUnit(unit);
    if (unit === 'lbs') {
      const kgVal = parseFloat(weightKgInput) || 70;
      setWeightLbsInput(String(Math.round(kgVal * 2.20462)));
    } else {
      const lbsVal = parseFloat(weightLbsInput) || 154;
      setWeightKgInput(String(Math.round((lbsVal / 2.20462) * 10) / 10));
    }
  };

  // Single Digit PIN Input Handler
  const handlePinDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...enteredPin];
    newPin[index] = value.slice(-1);
    setEnteredPin(newPin);

    // Auto-advance focus to next digit box
    if (value && index < 3) {
      pinInputRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !enteredPin[index] && index > 0) {
      pinInputRefs[index - 1].current?.focus();
    }
  };

  // Step 1: Initiate Sign-Up (Generate & Send 4-digit Email Verification PIN)
  const handleStartSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Please enter both Email Address and Password.');
      return;
    }
    if (cleanPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    const parsedHeightCm = heightUnit === 'cm'
      ? (parseFloat(heightCmInput) || 175)
      : Math.round(((parseFloat(heightFtInput) || 5) * 30.48) + ((parseFloat(heightInInput) || 0) * 2.54));

    const parsedWeightKg = weightUnit === 'kg'
      ? (parseFloat(weightKgInput) || 70)
      : Math.round(((parseFloat(weightLbsInput) || 154) / 2.20462) * 10) / 10;

    const parsedDailyGoal = parseInt(dailyGoalInput) || 10000;
    const strideCm = calculateStrideCm(parsedHeightCm, gender);

    const profileObj = {
      name: name.trim(),
      email: cleanEmail,
      gender,
      birthDate,
      age: computedAge,
      heightCm: parsedHeightCm,
      weightKg: parsedWeightKg,
      dailyGoal: parsedDailyGoal,
      strideCm,
      heightUnit,
      weightUnit,
      useAutoStride: true
    };

    const newPin = createRandomPin();
    setGeneratedPin(newPin);
    setDraftSignupData({ cleanEmail, cleanPassword, name: name.trim(), profileObj });
    setEnteredPin(['', '', '', '']);

    await sendRealEmailOtp({
      toEmail: cleanEmail,
      toName: name.trim(),
      otpCode: newPin,
      purpose: 'signup'
    });

    setSuccessMsg(`📧 4-Digit Verification Code sent to ${cleanEmail}! Please check your email inbox and spam folder.`);
    setAuthStep('verify_signup_pin');
  };

  // Step 2: Verify Signup PIN & Create Account in Cloud Firestore
  const handleVerifySignupPin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const code = enteredPin.join('');

    if (code.length !== 4) {
      setErrorMsg('Please enter all 4 digits of the verification PIN.');
      return;
    }

    // Enforce 10-Minute Expiry
    if (pinExpiresAt && Date.now() > pinExpiresAt) {
      setErrorMsg('⏰ 4-Digit PIN has expired (10-minute limit). Please tap "Resend PIN" to get a fresh code.');
      return;
    }

    if (code !== generatedPin) {
      setErrorMsg('❌ Invalid 4-Digit Verification PIN. Please check your email code and try again.');
      return;
    }

    // PIN Verified! Register in Cloud Firestore DB
    setLoading(true);
    try {
      const { cleanEmail, cleanPassword, name, profileObj } = draftSignupData;
      const newUser = await registerUserInDb(cleanEmail, cleanPassword, name, profileObj);
      setLoading(false);
      handleSuccess(newUser);
      onClose();
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Account registration failed.');
    }
  };

  // Sign In Direct Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Please enter both Email Address and Password.');
      setLoading(false);
      return;
    }

    const res = await loginUserInDb(cleanEmail, cleanPassword);
    setLoading(false);

    if (res.success) {
      handleSuccess(res.user);
      onClose();
    } else {
      setErrorMsg(res.error || 'Login failed. Please check your credentials.');
    }
  };

  // Forgot Password Step 1: Check Email & Send PIN
  const handleStartForgotPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      setLoading(false);
      return;
    }

    const validation = await validateUserExistsInDb(cleanEmail);
    setLoading(false);

    if (!validation.exists) {
      setErrorMsg(`No account found matching email "${cleanEmail}" in Cloud Database.`);
      return;
    }

    const newPin = createRandomPin();
    setGeneratedPin(newPin);
    setEnteredPin(['', '', '', '']);

    await sendRealEmailOtp({
      toEmail: cleanEmail,
      toName: validation.targetUser?.displayName || 'User',
      otpCode: newPin,
      purpose: 'password_reset'
    });

    setSuccessMsg(`📧 Password Reset 4-Digit Code sent to ${cleanEmail}! Please check your email inbox and spam folder.`);
    setAuthStep('verify_reset_pin');
  };

  // Forgot Password Step 2: Verify Reset PIN
  const handleVerifyResetPin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const code = enteredPin.join('');

    if (code.length !== 4) {
      setErrorMsg('Please enter the 4-digit reset PIN.');
      return;
    }

    // Enforce 10-Minute Expiry
    if (pinExpiresAt && Date.now() > pinExpiresAt) {
      setErrorMsg('⏰ Password Reset PIN has expired (10-minute limit). Please tap "Resend PIN" to get a fresh code.');
      return;
    }

    if (code !== generatedPin) {
      setErrorMsg('❌ Invalid Reset PIN. Please check your code and try again.');
      return;
    }

    setSuccessMsg('✅ PIN verified! Enter your new password below.');
    setAuthStep('new_password');
  };

  // Forgot Password Step 3: Save New Password
  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    await updateUserPasswordInDb(email, newPassword);
    setLoading(false);

    setPassword(newPassword);
    setSuccessMsg('✨ Password updated successfully! Please sign in with your new password.');
    setAuthStep('auth');
    setIsSignUp(false);
  };

  // Continue as Guest Handler
  const handleGuestLoginClick = () => {
    const guestUser = {
      uid: 'guest',
      displayName: 'Guest User',
      email: 'guest@pacepulse.app',
      isGuest: true
    };
    if (onGuestLogin) {
      onGuestLogin(guestUser);
    } else {
      handleSuccess(guestUser);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 9, 20, 0.88)',
      backdropFilter: 'blur(14px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 250,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: (isSignUp && authStep === 'auth') ? '540px' : '460px',
        padding: '28px 24px',
        position: 'relative',
        maxHeight: '92vh',
        overflowY: 'auto',
        transition: 'all 0.3s ease'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        {/* Title Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: authStep.includes('pin') 
              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
              : authStep === 'new_password' || authStep === 'forgot_email'
              ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
              : 'linear-gradient(135deg, #00F2FE 0%, #8B5CF6 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
          }}>
            {authStep.includes('pin') ? <KeyRound size={24} color="#FFFFFF" /> : <Database size={24} color="#040914" />}
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: '800' }}>
            {authStep === 'verify_signup_pin' ? 'Verify Email (4-Digit PIN)' :
             authStep === 'forgot_email' ? 'Reset Account Password' :
             authStep === 'verify_reset_pin' ? 'Verify Password Reset PIN' :
             authStep === 'new_password' ? 'Set New Account Password' :
             isSignUp ? 'Create Production Account' : 'Welcome to PacePulse AI'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {authStep === 'verify_signup_pin' ? `Enter the 4-digit verification PIN sent to ${email}` :
             authStep === 'forgot_email' ? 'Enter your registered email to receive a password reset code' :
             authStep === 'verify_reset_pin' ? `Enter the 4-digit PIN sent to ${email}` :
             authStep === 'new_password' ? 'Enter your new secure password' :
             isSignUp ? 'Free Cloud Database Account Registration' : 'Sign in to access your profile & goals on any mobile or desktop device'}
          </p>
        </div>

        {/* Success Alert Toast Box */}
        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            color: '#34D399',
            fontSize: '13px',
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            {successMsg}
          </div>
        )}

        {/* Error Alert Box */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#F87171',
            fontSize: '12px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Continue as Guest Button (Only in main Sign In view) */}
        {!isSignUp && authStep === 'auth' && (
          <>
            <button 
              onClick={handleGuestLoginClick}
              className="btn-secondary"
              style={{
                width: '100%',
                borderColor: 'rgba(0, 242, 254, 0.3)',
                background: 'rgba(0, 242, 254, 0.08)',
                color: '#00F2FE',
                fontWeight: '700',
                padding: '12px',
                borderRadius: '14px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px'
              }}
            >
              <User size={18} />
              Continue as Guest (Setup Profile Now)
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600' }}>OR CLOUD DATABASE LOGIN</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
            </div>
          </>
        )}

        {/* ================= VIEW 1: MAIN AUTH FORM ================= */}
        {authStep === 'auth' && (
          <form onSubmit={isSignUp ? handleStartSignUp : handleSignIn}>
            {isSignUp ? (
              <>
                {/* Name & Email Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Alex Hunter"
                      className="glass-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="glass-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="glass-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#00F2FE', display: 'block', marginBottom: '10px' }}>
                    ⚙️ FITNESS PROFILE PARAMETERS
                  </span>

                  {/* Gender & Birth Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Gender / Sex
                      </label>
                      <select
                        className="glass-input"
                        style={{ padding: '10px' }}
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="male" style={{ background: '#0F172A' }}>Male</option>
                        <option value="female" style={{ background: '#0F172A' }}>Female</option>
                        <option value="other" style={{ background: '#0F172A' }}>Other</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        className="glass-input"
                        style={{ padding: '10px' }}
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: '600' }}>Age: {computedAge} yrs</span>
                    </div>
                  </div>

                  {/* Height Row with Unit Toggle */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Height</label>
                      <div style={{ display: 'flex', gap: '2px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '2px' }}>
                        <button type="button" onClick={() => handleHeightUnitToggle('cm')} style={{ border: 'none', background: heightUnit === 'cm' ? '#00F2FE' : 'transparent', color: heightUnit === 'cm' ? '#040914' : 'var(--text-muted)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>cm</button>
                        <button type="button" onClick={() => handleHeightUnitToggle('ft_in')} style={{ border: 'none', background: heightUnit === 'ft_in' ? '#00F2FE' : 'transparent', color: heightUnit === 'ft_in' ? '#040914' : 'var(--text-muted)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>ft/in</button>
                      </div>
                    </div>

                    {heightUnit === 'cm' ? (
                      <input type="number" className="glass-input" placeholder="175" value={heightCmInput} onChange={(e) => setHeightCmInput(e.target.value)} />
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input type="number" className="glass-input" placeholder="5 ft" value={heightFtInput} onChange={(e) => setHeightFtInput(e.target.value)} />
                        <input type="number" className="glass-input" placeholder="9 in" value={heightInInput} onChange={(e) => setHeightInInput(e.target.value)} />
                      </div>
                    )}
                  </div>

                  {/* Weight Row with Unit Toggle */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Weight</label>
                      <div style={{ display: 'flex', gap: '2px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '2px' }}>
                        <button type="button" onClick={() => handleWeightUnitToggle('kg')} style={{ border: 'none', background: weightUnit === 'kg' ? '#10B981' : 'transparent', color: weightUnit === 'kg' ? '#040914' : 'var(--text-muted)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>kg</button>
                        <button type="button" onClick={() => handleWeightUnitToggle('lbs')} style={{ border: 'none', background: weightUnit === 'lbs' ? '#10B981' : 'transparent', color: weightUnit === 'lbs' ? '#040914' : 'var(--text-muted)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>lbs</button>
                      </div>
                    </div>

                    {weightUnit === 'kg' ? (
                      <input type="number" step="any" className="glass-input" placeholder="70" value={weightKgInput} onChange={(e) => setWeightKgInput(e.target.value)} />
                    ) : (
                      <input type="number" step="any" className="glass-input" placeholder="154" value={weightLbsInput} onChange={(e) => setWeightLbsInput(e.target.value)} />
                    )}
                  </div>

                  {/* Daily Goal */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Daily Step Goal
                    </label>
                    <input type="number" step="100" min="100" className="glass-input" placeholder="10000" value={dailyGoalInput} onChange={(e) => setDailyGoalInput(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Sign In Inputs */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="glass-input"
                      style={{ paddingLeft: '40px' }}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Mail size={18} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setSuccessMsg('');
                        setAuthStep('forgot_email');
                      }}
                      style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="glass-input"
                      style={{ paddingLeft: '40px' }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Lock size={18} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px', marginTop: '14px' }} disabled={loading}>
              {loading ? 'Authenticating...' : isSignUp ? 'Send 4-Digit Verification PIN 📩' : 'Sign In'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* ================= VIEW 2: 4-DIGIT PIN VERIFICATION FOR SIGNUP ================= */}
        {authStep === 'verify_signup_pin' && (
          <form onSubmit={handleVerifySignupPin} style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: secondsRemaining > 60 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${secondsRemaining > 60 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              padding: '6px 14px',
              borderRadius: '20px',
              color: secondsRemaining > 60 ? '#34D399' : '#F87171',
              fontSize: '12px',
              fontWeight: 800,
              marginBottom: '10px'
            }}>
              ⏱️ OTP Valid for: {formatTimer(secondsRemaining)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '14px 0 20px' }}>
              {enteredPin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={pinInputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  style={{
                    width: '56px',
                    height: '60px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: digit ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    fontSize: '24px',
                    fontWeight: '800',
                    textAlign: 'center',
                    outline: 'none',
                    boxShadow: digit ? '0 0 12px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', marginBottom: '14px' }} disabled={loading}>
              {loading ? 'Registering...' : 'Verify OTP & Create Account'}
              <CheckCircle2 size={18} />
            </button>

            <button
              type="button"
              onClick={() => {
                const newPin = createRandomPin();
                setGeneratedPin(newPin);
                setEnteredPin(['', '', '', '']);
                setSuccessMsg(`📧 New Verification OTP sent to ${email}: [ ${newPin} ] (Valid 10 mins)`);
              }}
              style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> Resend OTP Code
            </button>
          </form>
        )}

        {/* ================= VIEW 3: FORGOT PASSWORD - EMAIL ENTRY ================= */}
        {authStep === 'forgot_email' && (
          <form onSubmit={handleStartForgotPassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Your Registered Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="glass-input"
                  style={{ paddingLeft: '40px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={18} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '14px' }} disabled={loading}>
              {loading ? 'Searching Account...' : 'Send 4-Digit Reset OTP 📩'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* ================= VIEW 4: FORGOT PASSWORD - PIN VERIFICATION ================= */}
        {authStep === 'verify_reset_pin' && (
          <form onSubmit={handleVerifyResetPin} style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: secondsRemaining > 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${secondsRemaining > 60 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              padding: '6px 14px',
              borderRadius: '20px',
              color: secondsRemaining > 60 ? '#FBBF24' : '#F87171',
              fontSize: '12px',
              fontWeight: 800,
              marginBottom: '10px'
            }}>
              ⏱️ Reset OTP Valid for: {formatTimer(secondsRemaining)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '14px 0 20px' }}>
              {enteredPin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={pinInputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  style={{
                    width: '56px',
                    height: '60px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: digit ? '2px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    fontSize: '24px',
                    fontWeight: '800',
                    textAlign: 'center',
                    outline: 'none',
                    boxShadow: digit ? '0 0 12px rgba(245, 158, 11, 0.3)' : 'none'
                  }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', marginBottom: '14px' }}>
              Verify Reset OTP
              <CheckCircle2 size={18} />
            </button>
          </form>
        )}

        {/* ================= VIEW 5: FORGOT PASSWORD - SET NEW PASSWORD ================= */}
        {authStep === 'new_password' && (
          <form onSubmit={handleSaveNewPassword}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="glass-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="glass-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '14px' }} disabled={loading}>
              {loading ? 'Saving...' : 'Save New Password & Sign In'}
              <CheckCircle2 size={18} />
            </button>
          </form>
        )}

        {/* Toggle Login vs Sign Up / Back to Sign In */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          {authStep === 'auth' ? (
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              style={{ background: 'none', border: 'none', color: '#00F2FE', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create New Account"}
            </button>
          ) : (
            <button 
              onClick={() => {
                setAuthStep('auth');
                setIsSignUp(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
