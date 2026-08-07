import React, { useState } from 'react';
import { getLocalDateStr } from '../utils/fitnessEngine';

export function ManualEntryModal({ onClose, onSaveEntry }) {
  const todayStr = getLocalDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [stepsInput, setStepsInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [distanceInput, setDistanceInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const steps = parseInt(stepsInput) || 0;
    const activeKcal = parseInt(caloriesInput) || 0;
    const distanceKm = parseFloat(distanceInput) || 0;

    if (!selectedDate) {
      alert("Please select a valid date.");
      return;
    }

    onSaveEntry({
      dateStr: selectedDate,
      steps,
      activeKcal,
      distanceKm
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '28px',
        borderRadius: '20px',
        background: 'rgba(12, 18, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-bright)' }}>
            📅 Log Past Activity / Manual Entry
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '6px' }}>
              Select Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={todayStr}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '6px' }}>
              Steps Walked:
            </label>
            <input
              type="number"
              placeholder="e.g. 7500"
              value={stepsInput}
              onChange={(e) => {
                const val = e.target.value;
                setStepsInput(val);
                // Auto estimate active kcal & distance
                const st = parseInt(val) || 0;
                setCaloriesInput(String(Math.round(st * 0.04)));
                setDistanceInput(String((st * 0.00075).toFixed(2)));
              }}
              min="0"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                Active Calories (kcal):
              </label>
              <input
                type="number"
                placeholder="e.g. 300"
                value={caloriesInput}
                onChange={(e) => setCaloriesInput(e.target.value)}
                min="0"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                Distance (km):
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5.2"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
                min="0"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                border: 'none',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
