import React from 'react';
import { Calendar, TrendingUp } from 'lucide-react';

export function WeeklyStepChart({ totalDailySteps, dailyGoal = 10000, history = [] }) {
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIndex = (new Date().getDay() + 6) % 7; // Convert Sun=0 -> Sun=6

  // Construct 7-day step breakdown array (Mon-Sun)
  const weeklyData = daysOfWeek.map((dayLabel, idx) => {
    let steps = 0;
    if (idx === todayIndex) {
      steps = totalDailySteps;
    } else if (history[idx] && typeof history[idx].steps === 'number') {
      steps = history[idx].steps;
    } else {
      steps = 0;
    }
    return {
      day: dayLabel,
      steps,
      isToday: idx === todayIndex,
      isGoalMet: steps >= dailyGoal
    };
  });

  const maxSteps = Math.max(...weeklyData.map(d => d.steps), dailyGoal, 10000);
  const totalWeeklySteps = weeklyData.reduce((sum, d) => sum + d.steps, 0);

  return (
    <div className="glass-card" style={{
      padding: '24px',
      borderRadius: '24px',
      background: 'rgba(10, 15, 26, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={20} color="#60a5fa" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)' }}>
              Weekly Step Progress
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
              Step counts for Monday through Sunday
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#34d399' }}>
          <TrendingUp size={16} />
          <span>Total: {totalWeeklySteps.toLocaleString()} steps</span>
        </div>
      </div>

      {/* Bar Chart Grid (Y-axis: Steps, X-axis: Day of Week) */}
      <div style={{
        position: 'relative',
        height: '180px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingTop: '20px',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Goal Indicator Line */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `${(dailyGoal / maxSteps) * 140 + 24}px`,
          borderTop: '1px dashed rgba(251, 191, 36, 0.5)',
          display: 'flex',
          justifyContent: 'flex-end',
          pointerEvents: 'none'
        }}>
          <span style={{
            background: 'rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '4px',
            marginTop: '-10px'
          }}>
            Goal: {dailyGoal.toLocaleString()}
          </span>
        </div>

        {/* 7 Daily Bars */}
        {weeklyData.map((d, index) => {
          const barHeightPct = Math.min((d.steps / maxSteps) * 100, 100);

          return (
            <div key={d.day} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              position: 'relative'
            }}>
              {/* Step Value Tooltip */}
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: d.isToday ? '#00F2FE' : 'var(--text-dim)',
                marginBottom: '6px'
              }}>
                {d.steps > 0 ? (d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps) : '0'}
              </span>

              {/* Bar Fill */}
              <div style={{
                width: '60%',
                maxWidth: '36px',
                height: `${Math.max(barHeightPct, 4)}%`,
                borderRadius: '8px 8px 4px 4px',
                background: d.isToday 
                  ? 'linear-gradient(180deg, #00F2FE 0%, #3b82f6 100%)' 
                  : d.isGoalMet 
                  ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' 
                  : 'rgba(255, 255, 255, 0.12)',
                boxShadow: d.isToday ? '0 0 16px rgba(0, 242, 254, 0.4)' : 'none',
                transition: 'height 0.4s ease'
              }} />

              {/* X-Axis Label (Day of Week) */}
              <span style={{
                position: 'absolute',
                bottom: '-22px',
                fontSize: '12px',
                fontWeight: d.isToday ? 900 : 600,
                color: d.isToday ? '#00F2FE' : 'var(--text-dim)'
              }}>
                {d.day} {d.isToday && '•'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
