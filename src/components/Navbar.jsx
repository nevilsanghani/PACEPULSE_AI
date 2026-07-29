import React from 'react';
import { Flame, Activity, User, LogIn, LogOut, Bell } from 'lucide-react';

export function Navbar({ 
  user,
  streakDays, 
  pendingCount = 0,
  onOpenAuthModal,
  onSignOut,
  onOpenProfile,
  onOpenSocial
}) {
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
      <div className="nav-action-group">
        {/* Notification Bell Icon for Pending Friend Requests */}
        <button
          onClick={onOpenSocial}
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
          title="Connection Requests & Notifications"
        >
          <Bell size={18} color="#60a5fa" />
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: 'white',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #040914'
            }}>
              {pendingCount}
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
              className="btn-secondary nav-user-btn"
              title="Edit Profile & Fitness Goals"
            >
              <User size={15} color="#00F2FE" />
              <span className="nav-user-name">{user.displayName || 'Profile'}</span>
            </button>

            <button 
              onClick={onSignOut}
              className="btn-secondary nav-logout-btn"
              title="Sign Out"
            >
              <LogOut size={15} color="#F87171" />
            </button>
          </div>
        ) : (
          <button 
            onClick={onOpenAuthModal}
            className="btn-primary nav-login-btn"
          >
            <LogIn size={15} /> Sign In
          </button>
        )}
      </div>
    </header>
  );
}
