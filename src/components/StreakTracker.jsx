import React from 'react';
import { Flame, Award, Calendar, CheckCircle2, Share2, Sparkles, ShieldCheck } from 'lucide-react';

export function StreakTracker({ streakDays = 1, history = [], dailyGoal = 10000, currentSteps = 0, onOpenShareModal }) {
  // Days of the week (Mon-Sun)
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Compute live current streak including today's completion
  const isTodayGoalHit = currentSteps >= dailyGoal && currentSteps > 0;
  const activeStreak = isTodayGoalHit ? Math.max(streakDays, 1) : streakDays;

  return (
    <div className="glass-panel" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(255, 107, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 107, 0, 0.25)'
          }}>
            <Flame size={20} color="#FF6B00" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Streak & Badges</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {activeStreak} Day Active Streak 🔥
            </p>
          </div>
        </div>

        {/* 1-Week Milestone Status */}
        {activeStreak >= 7 ? (
          <div style={{
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(255, 107, 0, 0.2) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.5)',
            padding: '6px 14px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={14} color="#EC4899" />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#F472B6' }}>
              1-Week Streak Unlocked! 🔥
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {Math.max(7 - activeStreak, 0)} days to 1-Week Badge
          </span>
        )}
      </div>

      {/* Weekly Goal Progress Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '8px',
        marginBottom: '24px'
      }}>
        {daysOfWeek.map((day, idx) => {
          const isCurrentDay = idx === (new Date().getDay() + 6) % 7;
          const dayData = history[idx] || { completed: false, steps: 0 };
          const effectiveSteps = isCurrentDay ? currentSteps : (dayData.steps || 0);
          const isCompleted = dayData.completed || (isCurrentDay && isTodayGoalHit);

          return (
            <div
              key={day}
              style={{
                background: isCompleted 
                  ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.05) 100%)'
                  : isCurrentDay
                  ? 'rgba(0, 242, 254, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isCompleted
                  ? '1px solid rgba(16, 185, 129, 0.5)'
                  : isCurrentDay
                  ? '1px solid rgba(0, 242, 254, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '14px',
                padding: '12px 6px',
                textAlign: 'center',
                transition: 'all 0.25s ease'
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                {day}
              </span>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                {isCompleted ? (
                  <CheckCircle2 size={20} color="#10B981" />
                ) : (
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(255, 255, 255, 0.2)'
                  }} />
                )}
              </div>
              <span style={{ fontSize: '10px', color: isCompleted ? '#34D399' : 'var(--text-dim)', fontWeight: '600' }}>
                {effectiveSteps > 0 ? (effectiveSteps >= 1000 ? `${(effectiveSteps / 1000).toFixed(1)}k` : `${effectiveSteps}`) : '0'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unlocked Badges Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Badge 1 */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Award size={24} color="#00F2FE" />
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700' }}>First Step</h4>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Walk 100+ steps</p>
          </div>
        </div>

        {/* Badge 2 */}
        <div style={{
          background: isTodayGoalHit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
          border: isTodayGoalHit ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <ShieldCheck size={24} color={isTodayGoalHit ? '#10B981' : '#64748B'} />
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: isTodayGoalHit ? '#34D399' : 'var(--text-main)' }}>
              Goal Crusher
            </h4>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {isTodayGoalHit ? 'Achieved Today! 🎉' : 'Hit daily target'}
            </p>
          </div>
        </div>

        {/* Badge 3 (7-Day Titan) */}
        <div style={{
          background: activeStreak >= 7 
            ? 'linear-gradient(135deg, rgba(255, 107, 0, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)'
            : 'rgba(15, 23, 42, 0.4)',
          border: activeStreak >= 7 ? '1px solid rgba(255, 107, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          opacity: activeStreak >= 7 ? 1 : 0.6
        }}>
          <Flame size={24} color={activeStreak >= 7 ? '#FF6B00' : '#64748B'} />
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: activeStreak >= 7 ? '#FF9E44' : 'var(--text-main)' }}>
              7-Day Titan
            </h4>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>1 Week Streak</p>
          </div>
        </div>
      </div>

      {/* Share Streak Trigger Button */}
      <button 
        className="btn-primary" 
        onClick={onOpenShareModal}
        style={{ width: '100%', background: 'linear-gradient(135deg, #FF6B00 0%, #EC4899 100%)' }}
      >
        <Share2 size={18} />
        Share Progress Story to WhatsApp / Instagram
      </button>
    </div>
  );
}
