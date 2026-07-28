import React, { useState } from 'react';

export function CalorieTrackerWidget({ activeKcal, foodIntakeKcal, onAddMeal }) {
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [showMealForm, setShowMealForm] = useState(false);

  const handleAddMealSubmit = (e) => {
    e.preventDefault();
    const kcal = parseInt(mealCalories) || 0;
    if (kcal <= 0) return;

    onAddMeal({
      name: mealName.trim() || 'Quick Snack',
      calories: kcal
    });

    setMealName('');
    setMealCalories('');
    setShowMealForm(false);
  };

  const netBalance = activeKcal - foodIntakeKcal;

  return (
    <div className="glass-card" style={{
      padding: '24px',
      borderRadius: '20px',
      background: 'rgba(12, 18, 30, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)' }}>
            ⚖️ Net Calorie Balance (Burn vs. Intake)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
            Strict Active Burned Calories minus Food Intake (Excludes BMR)
          </p>
        </div>

        <button
          onClick={() => setShowMealForm(!showMealForm)}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {showMealForm ? '✕ Cancel' : '+ Log Meal'}
        </button>
      </div>

      {/* 3 Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '14px',
          padding: '14px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Active Burned</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>
            🔥 {activeKcal} <span style={{ fontSize: '12px' }}>kcal</span>
          </div>
        </div>

        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '14px',
          padding: '14px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Food Intake</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>
            🥗 {foodIntakeKcal} <span style={{ fontSize: '12px' }}>kcal</span>
          </div>
        </div>

        <div style={{
          background: netBalance >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${netBalance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          borderRadius: '14px',
          padding: '14px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Net Deficit</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: netBalance >= 0 ? '#34d399' : '#f87171', marginTop: '4px' }}>
            {netBalance >= 0 ? `+${netBalance}` : netBalance} <span style={{ fontSize: '12px' }}>kcal</span>
          </div>
        </div>
      </div>

      {/* Quick Meal Logging Form */}
      {showMealForm && (
        <form onSubmit={handleAddMealSubmit} style={{
          display: 'flex',
          gap: '10px',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '14px',
          borderRadius: '12px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Meal / Snack name (e.g. Oatmeal)"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            style={{
              flex: 2,
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <input
            type="number"
            placeholder="Calories (kcal)"
            value={mealCalories}
            onChange={(e) => setMealCalories(e.target.value)}
            min="1"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
              fontSize: '13px',
              outline: 'none'
            }}
            required
          />
          <button
            type="submit"
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
