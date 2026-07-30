import React from 'react';
import { Footprints, Flame, Navigation, Clock, RefreshCw, Share2, Trophy, Zap } from 'lucide-react';

export function StepRing({ 
  steps = 0, 
  goal = 10000, 
  caloriesData, 
  onOpenResetModal, 
  onOpenShareModal,
  isGoalReached = false
}) {
  const percentage = Math.min(Math.round((steps / goal) * 100), 100);
  const size = 260;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const bmrDisplay = (caloriesData && typeof caloriesData.bmrDaily === 'number') ? caloriesData.bmrDaily : 1669;

  const handleInstantSync = () => {
    if (window.AndroidStepBridge && window.AndroidStepBridge.requestInstantSync) {
      window.AndroidStepBridge.requestInstantSync();
    }
  };

  return (
    <div className="glass-card main-ring-card" style={{
      position: 'relative',
      overflow: 'hidden',
      padding: '32px 24px',
      borderRadius: '28px',
      background: 'rgba(10, 15, 26, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      textAlign: 'center'
    }}>
      {/* Top Action Buttons (Reset, Instant Sync & Share) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <button
          onClick={onOpenResetModal}
          className="btn-secondary"
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#F87171',
            borderColor: 'rgba(248, 113, 113, 0.3)'
          }}
          title="Reset Daily Steps Baseline"
        >
          <RefreshCw size={14} /> Reset Steps
        </button>

        <button
          onClick={handleInstantSync}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            borderRadius: '12px',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid rgba(0, 242, 254, 0.4)',
            color: '#00F2FE',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Query Hardware Sensor Instantly"
        >
          <Zap size={14} /> Sync Now
        </button>

        <button
          onClick={onOpenShareModal}
          className="btn-primary"
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Share Daily Progress"
        >
          <Share2 size={14} /> Share Card
        </button>
      </div>

      {/* Goal Reached Celebration Banner */}
      {isGoalReached && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '16px',
          padding: '10px 18px',
          marginBottom: '24px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Trophy size={20} color="#10B981" />
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#34D399' }}>
            Goal Achieved! You walked {(steps || 0).toLocaleString()} steps today! 🎉
          </span>
        </div>
      )}

      {/* Ring & Counter Container */}
      <div style={{ position: 'relative', width: '100%', maxWidth: `${size}px`, aspectRatio: '1', margin: '0 auto 28px' }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 15px rgba(0, 242, 254, 0.3))' }}>
          <defs>
            <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F2FE" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.05)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
            </linearGradient>
          </defs>
          {/* Track Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#trackGradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#stepGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>

        {/* Center Content */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Footprints size={28} color="#00F2FE" style={{ marginBottom: '6px' }} />
          <h2 style={{ fontSize: '42px', fontWeight: '900', lineHeight: 1, letterSpacing: '-1px' }}>
            {(steps || 0).toLocaleString()}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '4px' }}>
            / {(goal || 10000).toLocaleString()} Steps Goal
          </p>
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            fontWeight: '700',
            background: 'rgba(0, 242, 254, 0.15)',
            color: '#00F2FE',
            padding: '3px 10px',
            borderRadius: '12px',
            border: '1px solid rgba(0, 242, 254, 0.3)'
          }}>
            {percentage}% Complete
          </div>
        </div>
      </div>

      {/* BMR & MET Live Metabolism Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(0, 242, 254, 0.08) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '16px',
        padding: '10px 16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={18} color="#F59E0B" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Estimated BMR (Resting Energy):</span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: '800', color: '#FCD34D' }}>
          {bmrDisplay.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '500' }}>kcal/day</span>
        </span>
      </div>

      {/* PREVIOUS SLEEK 3-COLUMN METRICS UI DESIGN (Active Calories, Distance, Active Time) */}
      <div className="metrics-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Active Calories Card */}
        <div style={{
          background: 'rgba(255, 107, 0, 0.08)',
          border: '1px solid rgba(255, 107, 0, 0.2)',
          borderRadius: '18px',
          padding: '16px 12px',
          textAlign: 'center',
          boxShadow: '0 8px 20px rgba(255, 107, 0, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
            <Flame size={18} color="#FF6B00" />
            <span style={{ fontSize: '12px', color: '#FF9E44', fontWeight: '700', letterSpacing: '0.2px' }}>Active Calories</span>
          </div>
          <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', margin: '2px 0' }}>
            {caloriesData ? caloriesData.activeKcal : 0} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>kcal</span>
          </p>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '500' }}>Movement energy only</span>
        </div>

        {/* Distance Card */}
        <div style={{
          background: 'rgba(0, 242, 254, 0.08)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '18px',
          padding: '16px 12px',
          textAlign: 'center',
          boxShadow: '0 8px 20px rgba(0, 242, 254, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
            <Navigation size={18} color="#00F2FE" />
            <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '700', letterSpacing: '0.2px' }}>Distance</span>
          </div>
          <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', margin: '2px 0' }}>
            {caloriesData ? caloriesData.distanceKm : 0} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>km</span>
          </p>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '500' }}>Stride length based</span>
        </div>

        {/* Active Time Card */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '18px',
          padding: '16px 12px',
          textAlign: 'center',
          boxShadow: '0 8px 20px rgba(139, 92, 246, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
            <Clock size={18} color="#8B5CF6" />
            <span style={{ fontSize: '12px', color: '#A78BFA', fontWeight: '700', letterSpacing: '0.2px' }}>Active Time</span>
          </div>
          <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', margin: '2px 0' }}>
            {caloriesData ? caloriesData.durationMins : 0} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>mins</span>
          </p>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '500' }}>Estimated walk time</span>
        </div>
      </div>
    </div>
  );
}
