import React from 'react';
import { Flame, Activity, Bell, Trophy } from 'lucide-react';

export function Navbar({ 
  user,
  streakDays = 0, 
  pendingCount = 0,
  hasUnreadDot = false,
  onOpenAuth,
  onOpenAuthModal,
  onSignOut,
  onOpenProfile,
  onOpenSocial,
  onOpenNotifications
}) {
  const handleAuth = onOpenAuth || onOpenAuthModal;

  return (
    <header className="nav-header">
      {/* Brand Logo */}
      <div className="nav-logo-group">
        <div className="nav-logo-icon">
          <Activity size={22} color="#040914" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="nav-title">
            PacePulse <span className="nav-title-accent">AI</span>
          </h1>
          <p className="nav-subtitle">
            Precision Step Tracker
          </p>
        </div>
      </div>

      {/* Right User Action & Notification Cluster */}
      <div className="nav-action-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* Dedicated Social Leaderboard & Connection Button */}
        <button
          onClick={() => onOpenSocial && onOpenSocial('leaderboard')}
          style={{
            background: 'rgba(0, 242, 254, 0.12)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            color: '#00F2FE',
            borderRadius: '14px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Social Leaderboard & Make Connections"
        >
          <Trophy size={16} color="#00F2FE" />
          <span>Leaderboard & Friends</span>
        </button>

        {/* Notification Bell Icon with Red Dot (Disappears once opened!) */}
        <button
          onClick={() => onOpenNotifications && onOpenNotifications()}
          style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '50%',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Notifications & System Alerts"
        >
          <Bell size={18} color="#60a5fa" />
          {hasUnreadDot && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: 'linear-gradient(135deg, #FF3B30 0%, #EF4444 100%)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 900,
              borderRadius: '50%',
              width: '14px',
              height: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #040914',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.9)'
            }}>
              {pendingCount > 0 ? pendingCount : ''}
            </span>
          )}
        </button>

        {/* Modern Streak Badge Pill */}
        <div className={`nav-streak-pill ${streakDays >= 7 ? 'active-streak' : ''}`}>
          <Flame size={15} color={streakDays >= 7 ? '#FF6B00' : '#F97316'} className={streakDays >= 7 ? 'float-anim' : ''} />
          <span className="nav-streak-text">
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'} {streakDays >= 7 && '🏆'}
          </span>
        </div>

        {/* User Auth & Profile Trigger */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              onClick={onOpenProfile}
              className="btn-secondary"
              style={{
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981'
              }} />
              <span>{user.displayName || user.profile?.name || 'Account'}</span>
            </button>
            
            <button
              onClick={onSignOut}
              className="btn-secondary"
              style={{
                borderRadius: '12px',
                padding: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={handleAuth}
            className="btn-primary"
            style={{
              borderRadius: '12px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700'
            }}
          >
            Sign In
          </button>
        )}

      </div>
    </header>
  );
}
