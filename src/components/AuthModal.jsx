import React, { useState } from 'react';
import { X, Lock, Mail, User, ArrowRight, AlertCircle, Database } from 'lucide-react';
import { calculateAgeFromBirthDate, calculateStrideCm } from '../utils/fitnessEngine';
import { registerUserInDb, loginUserInDb } from '../firebase';

export function AuthModal({ onSuccess, onAuthSuccess, onGuestLogin, onClose }) {
  const handleSuccess = onSuccess || onAuthSuccess || (() => {});

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sign-Up Specific Profile Fields
  const [gender, setGender] = useState('male');
  const [birthDate, setBirthDate] = useState('2000-01-01');
  
  // Height State & Units
  const [heightUnit, setHeightUnit] = useState('cm');
  const [heightCmInput, setHeightCmInput] = useState('175');
  const [heightFtInput, setHeightFtInput] = useState('5');
  const [heightInInput, setHeightInInput] = useState('9');

  // Weight State & Units
  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightKgInput, setWeightKgInput] = useState('70');
  const [weightLbsInput, setWeightLbsInput] = useState('154');

  // Daily Step Goal State
  const [dailyGoalInput, setDailyGoalInput] = useState('10000');

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

  // Computed Age
  const computedAge = calculateAgeFromBirthDate(birthDate);

  // Email Sign In / Sign Up handler
  const handleEmailAuth = async (e) => {
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

    if (isSignUp) {
      if (!name.trim()) {
        setErrorMsg('Please enter your full name.');
        setLoading(false);
        return;
      }

      // Calculate numeric height & weight
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

      try {
        const newUser = await registerUserInDb(cleanEmail, cleanPassword, name.trim(), profileObj);
        handleSuccess(newUser);
        setLoading(false);
        onClose();
      } catch (err) {
        setErrorMsg(err.message || 'Account registration failed.');
        setLoading(false);
      }
    } else {
      // SIGN IN FLOW
      const res = await loginUserInDb(cleanEmail, cleanPassword);
      setLoading(false);

      if (res.success) {
        handleSuccess(res.user);
        onClose();
      } else {
        setErrorMsg(res.error || 'Login failed. Please check your credentials.');
      }
    }
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
        maxWidth: isSignUp ? '540px' : '460px',
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
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #00F2FE 0%, #8B5CF6 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
          }}>
            <Database size={22} color="#040914" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800' }}>
            {isSignUp ? 'Create Production Account' : 'Welcome to PacePulse AI'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isSignUp ? 'Free Cloud Database Account Registration' : 'Sign in to access your profile & goals on any mobile or desktop device'}
          </p>
        </div>

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

        {/* Continue as Guest Button (Only in Sign In mode) */}
        {!isSignUp && (
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

        {/* Form Inputs */}
        <form onSubmit={handleEmailAuth}>
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Password
                </label>
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

          <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={loading}>
            {loading ? 'Authenticating...' : isSignUp ? 'Create Free Database Account' : 'Sign In'}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Toggle Login vs Sign Up */}
        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
            }}
            style={{ background: 'none', border: 'none', color: '#00F2FE', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create New Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
