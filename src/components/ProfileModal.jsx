import React, { useState } from 'react';
import { X, User, Check, Sparkles, Flame, Calendar } from 'lucide-react';
import { calculateStrideCm, calculateBMR, calculateAgeFromBirthDate } from '../utils/fitnessEngine';

export function ProfileModal({ profile, onSave, onClose }) {
  // Unit Toggles ('cm' | 'ft_in', 'kg' | 'lbs')
  const [heightUnit, setHeightUnit] = useState(profile.heightUnit || 'cm');
  const [weightUnit, setWeightUnit] = useState(profile.weightUnit || 'kg');

  const [gender, setGender] = useState(profile.gender || 'male');

  // Birth Date State (Format YYYY-MM-DD)
  const [birthDate, setBirthDate] = useState(profile.birthDate || '2000-01-01');

  // Daily Goal State
  const [dailyGoalInput, setDailyGoalInput] = useState(String(profile.dailyGoal || 10000));

  // Height input states
  const [heightCmInput, setHeightCmInput] = useState(String(profile.heightCm || 175));
  const [heightFtInput, setHeightFtInput] = useState(String(Math.floor((profile.heightCm || 175) / 30.48)));
  const [heightInInput, setHeightInInput] = useState(String(Math.round(((profile.heightCm || 175) % 30.48) / 2.54)));

  // Weight input states
  const [weightKgInput, setWeightKgInput] = useState(String(profile.weightKg || 70));
  const [weightLbsInput, setWeightLbsInput] = useState(String(Math.round((profile.weightKg || 70) * 2.20462)));

  // Calculate age automatically from Birth Date
  const computedAge = calculateAgeFromBirthDate(birthDate);

  // Helper functions for Height conversions
  const handleHeightCmChange = (val) => {
    setHeightCmInput(val);
    const numCm = parseFloat(val);
    if (!isNaN(numCm) && numCm > 0) {
      setHeightFtInput(String(Math.floor(numCm / 30.48)));
      setHeightInInput(String(Math.round((numCm % 30.48) / 2.54)));
    }
  };

  const handleHeightFtInChange = (newFt, newIn) => {
    setHeightFtInput(newFt);
    setHeightInInput(newIn);
    const ft = parseFloat(newFt) || 0;
    const inch = parseFloat(newIn) || 0;
    const cm = Math.round((ft * 30.48) + (inch * 2.54));
    if (cm > 0) {
      setHeightCmInput(String(cm));
    }
  };

  // Helper functions for Weight conversions
  const handleWeightKgChange = (val) => {
    setWeightKgInput(val);
    const numKg = parseFloat(val);
    if (!isNaN(numKg) && numKg > 0) {
      setWeightLbsInput(String(Math.round(numKg * 2.20462)));
    }
  };

  const handleWeightLbsChange = (val) => {
    setWeightLbsInput(val);
    const numLbs = parseFloat(val);
    if (!isNaN(numLbs) && numLbs > 0) {
      setWeightKgInput(String(Math.round((numLbs / 2.20462) * 10) / 10));
    }
  };

  // Unit Toggle Buttons
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
      dailyGoal: Math.max(500, parsedDailyGoal),
      strideCm: liveStride,
      heightUnit,
      weightUnit,
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
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '540px',
        padding: '28px',
        position: 'relative',
        maxHeight: '92vh',
        overflowY: 'auto'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #00F2FE 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
          }}>
            <User size={24} color="#040914" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Fitness Profile Settings</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Birthdate, Height, Weight & Daily Step Goal
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Gender & Birth Date (Auto-calculates Age) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Gender / Sex
              </label>
              <select
                className="glass-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="male" style={{ background: '#0F172A' }}>Male</option>
                <option value="female" style={{ background: '#0F172A' }}>Female</option>
                <option value="other" style={{ background: '#0F172A' }}>Other</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Date of Birth
              </label>
              <input
                type="date"
                className="glass-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
              <span style={{ fontSize: '11px', color: '#00F2FE', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                Calculated Age: {computedAge} years
              </span>
            </div>
          </div>

          {/* Height Row with Unit Toggle (cm / ft+in) */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Height
              </label>
              {/* Unit Toggle Buttons */}
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
                  onClick={() => handleHeightUnitToggle('ft_in')}
                  style={{
                    border: 'none',
                    background: heightUnit === 'ft_in' ? '#00F2FE' : 'transparent',
                    color: heightUnit === 'ft_in' ? '#040914' : 'var(--text-muted)',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="5"
                    value={heightFtInput}
                    onChange={(e) => handleHeightFtInChange(e.target.value, heightInInput)}
                  />
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-dim)' }}>ft</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="9"
                    value={heightInInput}
                    onChange={(e) => handleHeightFtInChange(heightFtInput, e.target.value)}
                  />
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-dim)' }}>in</span>
                </div>
              </div>
            )}
          </div>

          {/* Weight Row with Unit Toggle (kg / lbs) */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Weight
              </label>
              {/* Unit Toggle Buttons */}
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
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Daily Step Goal
            </label>
            <input
              type="number"
              step="500"
              className="glass-input"
              placeholder="10000"
              value={dailyGoalInput}
              onChange={(e) => setDailyGoalInput(e.target.value)}
            />
          </div>

          {/* Live Calibrated Metrics Preview Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '22px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="#F59E0B" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Live Estimated BMR:</span>
              </div>
              <span style={{ fontSize: '15px', fontWeight: '900', color: '#FCD34D' }}>
                {Math.round(liveBmr).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)' }}>kcal/day</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '11px' }}>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px' }}>AGE</span>
                <strong style={{ color: '#F59E0B' }}>{computedAge} yrs</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px' }}>HEIGHT</span>
                <strong style={{ color: '#00F2FE' }}>{parsedHeightCm} cm</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px' }}>WEIGHT</span>
                <strong style={{ color: '#10B981' }}>{parsedWeightKg} kg</strong>
              </div>
            </div>
          </div>

          {/* Submit Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              <Check size={18} /> Update Profile & Goals
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
