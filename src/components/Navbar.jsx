import React from 'react';
import { Flame, Activity, User, LogIn, LogOut } from 'lucide-react';

export function Navbar({ 
  user,
  streakDays, 
  onOpenAuthModal,
  onSignOut,
  onOpenProfile
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

      {/* Right User Action & Streak Cluster */}
      <div className="nav-action-group">
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
