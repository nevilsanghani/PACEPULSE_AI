import React, { useState } from 'react';
import { calculateBMR, calculateStrideCm, calculateAgeFromBirthDate } from '../utils/fitnessEngine';

export function ProfileModal({ profile, onSave, onClose }) {
  const [gender, setGender] = useState(profile.gender || 'male');
  const [birthDate, setBirthDate] = useState(profile.birthDate || '2000-01-01');

  // Unit System Toggles
  const [heightUnit, setHeightUnit] = useState(profile.heightUnit || 'cm');
  const [weightUnit, setWeightUnit] = useState(profile.weightUnit || 'kg');

  // Input states in user's active unit preference
  const [heightCmInput, setHeightCmInput] = useState(String(profile.heightCm || 175));
  const [heightFtInput, setHeightFtInput] = useState(() => {
    const totalInches = (profile.heightCm || 175) / 2.54;
    return String(Math.floor(totalInches / 12));
  });
  const [heightInInput, setHeightInInput] = useState(() => {
    const totalInches = (profile.heightCm || 175) / 2.54;
    return String(Math.round(totalInches % 12));
  });

  const [weightKgInput, setWeightKgInput] = useState(String(profile.weightKg || 70));
  const [weightLbsInput, setWeightLbsInput] = useState(String(Math.round((profile.weightKg || 70) * 2.20462 * 10) / 10));

  const [dailyGoalInput, setDailyGoalInput] = useState(String(profile.dailyGoal || 10000));
  const [widgetStyle, setWidgetStyle] = useState(profile.widgetStyle || 'solid');

  // Calculate live user age from Birth Date
  const computedAge = calculateAgeFromBirthDate(birthDate);

  // Widget Style Handler
  const handleWidgetStyleChange = (newStyle) => {
    setWidgetStyle(newStyle);
    if (window.AndroidStepBridge && window.AndroidStepBridge.setWidgetStyle) {
      window.AndroidStepBridge.setWidgetStyle(newStyle);
    }
  };

  // Unit conversion handlers
  const handleHeightUnitToggle = (newUnit) => {
    if (newUnit === heightUnit) return;
    setHeightUnit(newUnit);

    if (newUnit === 'ft') {
      const currentCm = parseFloat(heightCmInput) || 175;
      const totalInches = currentCm / 2.54;
      const ft = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      setHeightFtInput(String(ft));
      setHeightInInput(String(inches));
    } else {
      const ft = parseFloat(heightFtInput) || 5;
      const inches = parseFloat(heightInInput) || 0;
      const totalCm = Math.round((ft * 12 + inches) * 2.54);
      setHeightCmInput(String(totalCm));
    }
  };

  const handleWeightUnitToggle = (newUnit) => {
    if (newUnit === weightUnit) return;
    setWeightUnit(newUnit);

    if (newUnit === 'lbs') {
      const currentKg = parseFloat(weightKgInput) || 70;
      const lbs = Math.round(currentKg * 2.20462 * 10) / 10;
      setWeightLbsInput(String(lbs));
    } else {
      const currentLbs = parseFloat(weightLbsInput) || 154;
      const kg = Math.round((currentLbs / 2.20462) * 10) / 10;
      setWeightKgInput(String(kg));
    }
  };

  const handleHeightCmChange = (val) => {
    setHeightCmInput(val);
    const cm = parseFloat(val) || 0;
    if (cm > 0) {
      const totalInches = cm / 2.54;
      setHeightFtInput(String(Math.floor(totalInches / 12)));
      setHeightInInput(String(Math.round(totalInches % 12)));
    }
  };

  const handleWeightKgChange = (val) => {
    setWeightKgInput(val);
    const kg = parseFloat(val) || 0;
    if (kg > 0) {
      setWeightLbsInput(String(Math.round(kg * 2.20462 * 10) / 10));
    }
  };

  const handleWeightLbsChange = (val) => {
    setWeightLbsInput(val);
    const lbs = parseFloat(val) || 0;
    if (lbs > 0) {
      setWeightKgInput(String(Math.round((lbs / 2.20462) * 10) / 10));
    }
  };

  // Compute live numeric values for BMR & Stride calculation
  const parsedHeightCm = heightUnit === 'cm'
    ? (parseFloat(heightCmInput) || 175)
    : Math.round(((parseFloat(heightFtInput) || 5) * 30.48) + ((parseFloat(heightInInput) || 0) * 2.54));

  const parsedWeightKg = weightUnit === 'kg'
    ? (parseFloat(weightKgInput) || 70)
    : Math.round(((parseFloat(weightLbsInput) || 154) / 2.20462) * 10) / 10;

  const parsedDailyGoal = parseInt(dailyGoalInput) || 10000;

  // Real-time BMR & Stride calculation
  const liveBmr = calculateBMR(parsedWeightKg, parsedHeightCm, computedAge, gender);
  const liveStride = calculateStrideCm(parsedHeightCm, gender);

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedProfile = {
      ...profile,
      gender,
      birthDate,
      age: computedAge,
      heightCm: Math.max(50, parsedHeightCm),
      weightKg: Math.max(10, parsedWeightKg),
      dailyGoal: Math.max(100, parsedDailyGoal),
      strideCm: liveStride,
      heightUnit,
      weightUnit,
      widgetStyle,
      useAutoStride: true
    };
    onSave(updatedProfile);
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
      <div className="glass-panel modal-card" style={{
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '24px',
        padding: '28px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
              Physiology & Preferences
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Calibrates stride length, BMR & Widget Style
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Gender Selector */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Biological Sex
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`btn-secondary ${gender === 'male' ? 'active-unit' : ''}`}
                style={{
                  border: `1.5px solid ${gender === 'male' ? '#00F2FE' : 'rgba(255, 255, 255, 0.1)'}`,
                  background: gender === 'male' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  color: gender === 'male' ? '#00F2FE' : 'var(--text-muted)',
                  fontWeight: '700',
                  padding: '10px'
                }}
                onClick={() => setGender('male')}
              >
                 Male ♂
              </button>
              <button
                type="button"
                className={`btn-secondary ${gender === 'female' ? 'active-unit' : ''}`}
                style={{
                  border: `1.5px solid ${gender === 'female' ? '#EC4899' : 'rgba(255, 255, 255, 0.1)'}`,
                  background: gender === 'female' ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  color: gender === 'female' ? '#EC4899' : 'var(--text-muted)',
                  fontWeight: '700',
                  padding: '10px'
                }}
                onClick={() => setGender('female')}
              >
                 Female ♀
              </button>
            </div>
          </div>

          {/* Birth Date Picker */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Date of Birth
              </label>
              <span style={{ fontSize: '11px', color: '#00F2FE', fontWeight: '700' }}>
                Age: {computedAge} years
              </span>
            </div>
            <input
              type="date"
              className="glass-input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Height Row with Unit Toggle */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Height
              </label>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => handleHeightUnitToggle('cm')}
                  style={{
                    border: 'none',
                    background: heightUnit === 'cm' ? '#00F2FE' : 'transparent',
                    color: heightUnit === 'cm' ? '#040914' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => handleHeightUnitToggle('ft')}
                  style={{
                    border: 'none',
                    background: heightUnit === 'ft' ? '#00F2FE' : 'transparent',
                    color: heightUnit === 'ft' ? '#040914' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  ft / in
                </button>
              </div>
            </div>

            {heightUnit === 'cm' ? (
              <input
                type="number"
                className="glass-input"
                placeholder="175"
                value={heightCmInput}
                onChange={(e) => handleHeightCmChange(e.target.value)}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="5"
                    value={heightFtInput}
                    onChange={(e) => setHeightFtInput(e.target.value)}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '11px', color: 'var(--text-dim)' }}>ft</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="9"
                    value={heightInInput}
                    onChange={(e) => setHeightInInput(e.target.value)}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '11px', color: 'var(--text-dim)' }}>in</span>
                </div>
              </div>
            )}
          </div>

          {/* Weight Row with Unit Toggle */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Weight
              </label>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => handleWeightUnitToggle('kg')}
                  style={{
                    border: 'none',
                    background: weightUnit === 'kg' ? '#10B981' : 'transparent',
                    color: weightUnit === 'kg' ? '#040914' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  kg
                </button>
                <button
                  type="button"
                  onClick={() => handleWeightUnitToggle('lbs')}
                  style={{
                    border: 'none',
                    background: weightUnit === 'lbs' ? '#10B981' : 'transparent',
                    color: weightUnit === 'lbs' ? '#040914' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  lbs
                </button>
              </div>
            </div>

            {weightUnit === 'kg' ? (
              <input
                type="number"
                step="any"
                className="glass-input"
                placeholder="70"
                value={weightKgInput}
                onChange={(e) => handleWeightKgChange(e.target.value)}
              />
            ) : (
              <input
                type="number"
                step="any"
                className="glass-input"
                placeholder="154"
                value={weightLbsInput}
                onChange={(e) => handleWeightLbsChange(e.target.value)}
              />
            )}
          </div>

          {/* Daily Step Goal Input */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Daily Step Goal
            </label>
            <input
              type="number"
              step="100"
              min="100"
              className="glass-input"
              placeholder="10000"
              value={dailyGoalInput}
              onChange={(e) => setDailyGoalInput(e.target.value)}
            />
          </div>

          {/* Android Home Screen Widget Theme Preference */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Android Home Screen Widget Style
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleWidgetStyleChange('solid')}
                style={{
                  border: `1.5px solid ${widgetStyle === 'solid' ? '#00F2FE' : 'rgba(255, 255, 255, 0.1)'}`,
                  background: widgetStyle === 'solid' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  color: widgetStyle === 'solid' ? '#00F2FE' : 'var(--text-muted)',
                  fontWeight: '700',
                  fontSize: '12px',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                🌙 Solid Cyber Dark
              </button>
              <button
                type="button"
                onClick={() => handleWidgetStyleChange('transparent')}
                style={{
                  border: `1.5px solid ${widgetStyle === 'transparent' ? '#38BDF8' : 'rgba(255, 255, 255, 0.1)'}`,
                  background: widgetStyle === 'transparent' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  color: widgetStyle === 'transparent' ? '#38BDF8' : 'var(--text-muted)',
                  fontWeight: '700',
                  fontSize: '12px',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                💎 Glass Transparent
              </button>
            </div>
          </div>

          {/* Live Calibrated Metrics Preview Box */}
          <div style={{
            background: 'rgba(0, 242, 254, 0.05)',
            border: '1px solid rgba(0, 242, 254, 0.15)',
            borderRadius: '16px',
            padding: '14px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Estimated BMR</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#FCD34D' }}>
                {Math.round(liveBmr)} kcal/day
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Stride Length</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#00F2FE' }}>
                {liveStride} cm / step
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, padding: '12px' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1, padding: '12px' }}
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
