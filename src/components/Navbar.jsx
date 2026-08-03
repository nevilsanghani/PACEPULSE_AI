import React from 'react';
import { Flame, Activity, Bell, Trophy } from 'lucide-react';

export function Navbar({ 
  user,
  streakDays = 0, 
  pendingCount = 0,
  hasUnreadDot = false,
  cloudSyncStatus = 'synced',
  onOpenAuth,
  onOpenAuthModal,
  onSignOut,
  onOpenProfile,
  onOpenSocial,
  onOpenNotifications
}) {
  const handleAuth = onOpenAuth || onOpenAuthModal;

  return (
    <div className="nav-container" style={{ width: '100%' }}>
      {/* Top Navbar Header */}
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

        {/* Right Action Group: Notification Bell + Auth / Profile */}
        <div className="nav-action-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Notification Bell Icon with Red Dot */}
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

      {/* Uncrowded Sub-Bar Below Navbar: Leaderboard & Streak */}
      <div className="nav-subbar">
        {/* Dedicated Social Leaderboard & Connection Button */}
        <button
          onClick={() => onOpenSocial && onOpenSocial('leaderboard')}
          className="btn-subbar-leaderboard"
          style={{
            background: 'rgba(0, 242, 254, 0.12)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            color: '#00F2FE',
            borderRadius: '14px',
            padding: '8px 16px',
            fontSize: '13px',
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

        {/* Modern Streak Badge Pill */}
        <div className={`nav-streak-pill ${streakDays >= 7 ? 'active-streak' : ''}`}>
          <Flame size={15} color={streakDays >= 7 ? '#FF6B00' : '#F97316'} className={streakDays >= 7 ? 'float-anim' : ''} />
          <span className="nav-streak-text">
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'} {streakDays >= 7 && '🏆'}
          </span>
        </div>

        {/* Live Cloud Sync Status Badge (No Manual Sync Button Required) */}
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          padding: '6px 12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: cloudSyncStatus === 'offline' 
            ? 'rgba(249, 115, 22, 0.15)' 
            : cloudSyncStatus === 'syncing' 
            ? 'rgba(234, 179, 8, 0.15)' 
            : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${cloudSyncStatus === 'offline' ? 'rgba(249, 115, 22, 0.4)' : cloudSyncStatus === 'syncing' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
          color: cloudSyncStatus === 'offline' ? '#FB923C' : cloudSyncStatus === 'syncing' ? '#FACC15' : '#34D399'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            boxShadow: '0 0 6px currentColor'
          }} />
          <span>
            {cloudSyncStatus === 'offline' 
              ? 'Offline (Saved Locally)' 
              : cloudSyncStatus === 'syncing' 
              ? 'Syncing...' 
              : 'Synced to Cloud'}
          </span>
        </div>
      </div>
    </div>
  );
}
