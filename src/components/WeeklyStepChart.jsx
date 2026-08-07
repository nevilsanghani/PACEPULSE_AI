import React, { useState } from 'react';
import { Calendar, TrendingUp, CheckCircle, Target, Flame, Navigation, Clock } from 'lucide-react';

export function WeeklyStepChart({ todaySteps = 0, dailyGoal = 10000, weeklyHistory = [], history = [], onOpenHistory }) {
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIndex = (new Date().getDay() + 6) % 7; // Convert Sun=0 -> Sun=6

  const [selectedDayIdx, setSelectedDayIdx] = useState(todayIndex);

  // Combine weekly history logs with today's steps
  const effectiveHistory = (weeklyHistory && weeklyHistory.length > 0) ? weeklyHistory : history;

  // Calculate the 7 calendar dates (Mon -> Sun) for the current active week
  const now = new Date();
  const currentDayIdx = (now.getDay() + 6) % 7;
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() - currentDayIdx);

  const currentWeekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const weeklyData = daysOfWeek.map((dayLabel, idx) => {
    const targetDateStr = currentWeekDates[idx];
    let steps = 0;

    const matchedLog = effectiveHistory.find(item => item && item.date === targetDateStr);

    if (idx === todayIndex) {
      steps = Math.max(todaySteps, matchedLog ? matchedLog.steps || 0 : 0);
    } else if (matchedLog && typeof matchedLog.steps === 'number') {
      steps = matchedLog.steps;
    } else {
      steps = 0;
    }

    const distKm = Math.round((steps * 0.72) / 10) / 100;
    const calories = Math.round(steps * 0.04);

    return {
      index: idx,
      day: dayLabel,
      dateStr: targetDateStr,
      steps,
      distKm,
      calories,
      isToday: idx === todayIndex,
      isGoalMet: steps >= dailyGoal && steps > 0
    };
  });

  const maxSteps = Math.max(...weeklyData.map(d => d.steps), dailyGoal, 1000);
  const totalWeeklySteps = weeklyData.reduce((sum, d) => sum + d.steps, 0);

  const selectedData = weeklyData[selectedDayIdx] || weeklyData[todayIndex];

  return (
    <div className="glass-card" style={{
      padding: '24px',
      borderRadius: '24px',
      background: 'rgba(10, 15, 26, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={20} color="#00F2FE" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)' }}>
              Weekly Step Progress
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
              Tap any day bar to view detailed metrics
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#34D399' }}>
            <TrendingUp size={16} />
            <span>Total: {totalWeeklySteps.toLocaleString()} steps</span>
          </div>

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              style={{
                background: 'rgba(0, 242, 254, 0.12)',
                border: '1px solid rgba(0, 242, 254, 0.35)',
                borderRadius: '12px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00F2FE',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              className="hover-card-bright"
              title="Daily Activity History Logs"
            >
              <Clock size={18} color="#00F2FE" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Day Info Details Panel */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.1) 0%, rgba(59, 130, 246, 0.08) 100%)',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        borderRadius: '16px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: '#00F2FE',
            color: '#040914',
            fontSize: '11px',
            fontWeight: '800',
            padding: '2px 8px',
            borderRadius: '8px'
          }}>
            {selectedData.day} {selectedData.isToday ? '(Today)' : ''}
          </span>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>
            {selectedData.steps.toLocaleString()} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>steps</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
          <span style={{ color: '#FF9E44', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Flame size={14} /> {selectedData.calories} kcal
          </span>
          <span style={{ color: '#38BDF8', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Navigation size={14} /> {selectedData.distKm} km
          </span>
        </div>
      </div>

      {/* Full Box Y-Axis Scaled Bar Chart */}
      <div style={{
        position: 'relative',
        height: '210px',
        display: 'flex',
        paddingLeft: '38px',
        paddingRight: '8px',
        paddingTop: '24px',
        paddingBottom: '30px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.015)',
        borderRadius: '16px'
      }}>
        {/* Y-Axis Scale Reference Labels */}
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '24px',
          bottom: '30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'var(--text-dim)',
          fontWeight: '600'
        }}>
          <span>{maxSteps >= 1000 ? `${(maxSteps / 1000).toFixed(0)}k` : maxSteps}</span>
          <span>{Math.round(maxSteps / 2)}</span>
          <span>0</span>
        </div>

        {/* Target Goal Line */}
        <div style={{
          position: 'absolute',
          left: '38px',
          right: '8px',
          bottom: `${Math.min((dailyGoal / maxSteps) * 156 + 30, 180)}px`,
          borderTop: '1.5px dashed rgba(251, 191, 36, 0.6)',
          pointerEvents: 'none',
          zIndex: 2
        }}>
          <span style={{
            position: 'absolute',
            right: 0,
            top: '-10px',
            background: 'rgba(251, 191, 36, 0.2)',
            color: '#FCD34D',
            fontSize: '9px',
            fontWeight: '800',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Goal: {dailyGoal >= 1000 ? `${(dailyGoal / 1000).toFixed(1)}k` : dailyGoal}
          </span>
        </div>

        {/* 7 Interactive Day Bars */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: '100%'
        }}>
          {weeklyData.map((d) => {
            const barHeightPct = Math.min((d.steps / maxSteps) * 100, 100);
            const isSelected = selectedDayIdx === d.index;

            return (
              <div
                key={d.day}
                onClick={() => setSelectedDayIdx(d.index)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  position: 'relative',
                  cursor: 'pointer',
                  padding: '0 4px'
                }}
                title={`Click to view ${d.day} steps`}
              >
                {/* Step Count Badge above Bar */}
                <span style={{
                  fontSize: '10px',
                  fontWeight: isSelected ? 900 : 700,
                  color: isSelected ? '#00F2FE' : d.isToday ? '#38BDF8' : 'var(--text-dim)',
                  marginBottom: '6px',
                  transition: 'all 0.2s ease'
                }}>
                  {d.steps > 0 ? (d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps) : '0'}
                </span>

                {/* Bar Element */}
                <div style={{
                  width: '100%',
                  maxWidth: isSelected ? '34px' : '26px',
                  height: `${Math.max(barHeightPct, 6)}%`,
                  borderRadius: '10px 10px 4px 4px',
                  background: isSelected
                    ? 'linear-gradient(180deg, #00F2FE 0%, #3B82F6 100%)'
                    : d.isGoalMet
                    ? 'linear-gradient(180deg, #34D399 0%, #059669 100%)'
                    : d.isToday
                    ? 'linear-gradient(180deg, rgba(0, 242, 254, 0.6) 0%, rgba(59, 130, 246, 0.4) 100%)'
                    : 'rgba(255, 255, 255, 0.12)',
                  boxShadow: isSelected
                    ? '0 0 20px rgba(0, 242, 254, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.5)'
                    : d.isToday
                    ? '0 0 10px rgba(0, 242, 254, 0.3)'
                    : 'none',
                  border: isSelected
                    ? '1.5px solid #00F2FE'
                    : '1px solid transparent',
                  transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />

                {/* X-Axis Label */}
                <span style={{
                  position: 'absolute',
                  bottom: '-24px',
                  fontSize: '11px',
                  fontWeight: isSelected || d.isToday ? 900 : 600,
                  color: isSelected ? '#00F2FE' : d.isToday ? '#38BDF8' : 'var(--text-dim)'
                }}>
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
