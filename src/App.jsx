import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Navbar } from './components/Navbar';
import { StepRing } from './components/StepRing';
import { HourlyChart } from './components/HourlyChart';
import { StreakTracker } from './components/StreakTracker';
import { ProfileModal } from './components/ProfileModal';
import { ShareModal } from './components/ShareModal';
import { AuthModal } from './components/AuthModal';
import { ResetConfirmationModal } from './components/ResetConfirmationModal';
import { HistoryModal } from './components/HistoryModal';
import { CalorieTrackerWidget } from './components/CalorieTrackerWidget';
import { SocialLeaderboardModal } from './components/SocialLeaderboardModal';
import { speakMilestoneAnnouncement, setAudioCoachMuted } from './utils/audioCoach';
import { 
  auth, 
  signOut,
  saveDailyLogsToDb,
  getDailyLogsFromDb
} from './firebase';
import { 
  DEFAULT_PROFILE, 
  calculateCalories, 
  generateEmptyHourlyData
} from './utils/fitnessEngine';

export default function App() {
  // Persisted User Auth State
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('pacepulse_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [showAuthModal, setShowAuthModal] = useState(false);

  // Derive user storage key helper
  const getUserKey = (prefix, currentUser = user) => {
    const key = currentUser ? (currentUser.uid || currentUser.email) : 'guest';
    return `${prefix}_${key}`;
  };

  // User Profile State
  const [profile, setProfile] = useState(() => {
    const key = user ? getUserKey('pacepulse_profile', user) : 'pacepulse_profile_guest';
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  // Hourly Breakdown State (24 hours)
  const [hourlyData, setHourlyData] = useState(() => {
    const key = user ? getUserKey('pacepulse_hourly', user) : 'pacepulse_hourly_guest';
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : generateEmptyHourlyData();
  });

  // Daily Steps Sum
  const totalDailySteps = hourlyData.reduce((sum, h) => sum + h.steps, 0);

  // Food Intake Calories State
  const [foodIntakeKcal, setFoodIntakeKcal] = useState(() => {
    const key = user ? getUserKey('pacepulse_food', user) : 'pacepulse_food_guest';
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved) : 0;
  });

  // Audio Coach Mute Toggle State
  const [isMuted, setIsMuted] = useState(false);

  // Streak & History State
  const [streakDays, setStreakDays] = useState(() => {
    const key = user ? getUserKey('pacepulse_streak', user) : 'pacepulse_streak_guest';
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved) : 0;
  });

  const [weeklyHistory, setWeeklyHistory] = useState(() => {
    const key = user ? getUserKey('pacepulse_history', user) : 'pacepulse_history_guest';
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return Array.from({ length: 7 }, () => ({ completed: false, steps: 0 }));
  });

  // Modals Visibility
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);

  // Current Hour Slot & Date
  const currentHour = new Date().getHours();
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate High-Precision Active Calories & Distance (EXCLUDES BMR)
  const caloriesData = calculateCalories(totalDailySteps, profile);

  // AI Voice Audio Coach Milestone Announcement Trigger
  const [lastAnnouncedMilestone, setLastAnnouncedMilestone] = useState(0);
  useEffect(() => {
    if (totalDailySteps > 0 && totalDailySteps % 1000 < 5 && totalDailySteps !== lastAnnouncedMilestone) {
      setLastAnnouncedMilestone(totalDailySteps);
      speakMilestoneAnnouncement(totalDailySteps, caloriesData.activeKcal, profile.dailyGoal);
    }
  }, [totalDailySteps, caloriesData.activeKcal, profile.dailyGoal, lastAnnouncedMilestone]);

  // Audio Mute Handler
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setAudioCoachMuted(nextMuted);
  };

  // Add Meal Handler
  const handleAddMeal = (meal) => {
    const nextIntake = foodIntakeKcal + meal.calories;
    setFoodIntakeKcal(nextIntake);
    const key = getUserKey('pacepulse_food');
    localStorage.setItem(key, String(nextIntake));
  };

  // Native Android Bridge Window Listener
  useEffect(() => {
    window.addNativeSteps = (count = 1) => {
      setHourlyData(prev => {
        const next = [...prev];
        const hour = new Date().getHours();
        next[hour] = {
          ...next[hour],
          steps: next[hour].steps + count
        };
        return next;
      });
    };
    return () => {
      delete window.addNativeSteps;
    };
  }, []);

  // Handle Auth Login / Registration
  const handleAuthSuccess = async (authenticatedUser) => {
    setUser(authenticatedUser);
    localStorage.setItem('pacepulse_user', JSON.stringify(authenticatedUser));

    const profileKey = getUserKey('pacepulse_profile', authenticatedUser);

    if (authenticatedUser.profile) {
      setProfile(authenticatedUser.profile);
      localStorage.setItem(profileKey, JSON.stringify(authenticatedUser.profile));
    } else {
      const savedProfile = localStorage.getItem(profileKey);
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      } else {
        const newProfile = {
          ...DEFAULT_PROFILE,
          name: authenticatedUser.displayName || 'My Profile',
          email: authenticatedUser.email || ''
        };
        setProfile(newProfile);
        localStorage.setItem(profileKey, JSON.stringify(newProfile));
      }
    }

    const hourlyKey = getUserKey('pacepulse_hourly', authenticatedUser);
    const cloudLog = await getDailyLogsFromDb(authenticatedUser.uid, todayStr);
    
    if (cloudLog && cloudLog.hourlyData) {
      setHourlyData(cloudLog.hourlyData);
      localStorage.setItem(hourlyKey, JSON.stringify(cloudLog.hourlyData));
    } else {
      const savedHourly = localStorage.getItem(hourlyKey);
      setHourlyData(savedHourly ? JSON.parse(savedHourly) : generateEmptyHourlyData());
    }

    const streakKey = getUserKey('pacepulse_streak', authenticatedUser);
    const savedStreak = localStorage.getItem(streakKey);
    setStreakDays(savedStreak ? parseInt(savedStreak) : 0);

    const historyKey = getUserKey('pacepulse_history', authenticatedUser);
    const savedHistory = localStorage.getItem(historyKey);
    setWeeklyHistory(savedHistory ? JSON.parse(savedHistory) : Array.from({ length: 7 }, () => ({ completed: false, steps: 0 })));
  };

  const handleGuestLogin = (guestUser) => {
    handleAuthSuccess(guestUser);
    setShowProfileModal(true);
  };

  useEffect(() => {
    const key = getUserKey('pacepulse_profile');
    localStorage.setItem(key, JSON.stringify(profile));
  }, [profile, user]);

  useEffect(() => {
    const key = getUserKey('pacepulse_hourly');
    localStorage.setItem(key, JSON.stringify(hourlyData));

    if (user && user.uid && user.uid !== 'guest') {
      saveDailyLogsToDb(user.uid, todayStr, totalDailySteps, profile.dailyGoal, caloriesData, hourlyData);
    }
  }, [hourlyData, totalDailySteps, profile.dailyGoal, user]);

  useEffect(() => {
    const key = getUserKey('pacepulse_streak');
    localStorage.setItem(key, String(streakDays));
  }, [streakDays, user]);

  useEffect(() => {
    const key = getUserKey('pacepulse_history');
    localStorage.setItem(key, JSON.stringify(weeklyHistory));
  }, [weeklyHistory, user]);

  const isGoalReached = totalDailySteps >= profile.dailyGoal && totalDailySteps > 0;

  useEffect(() => {
    if (isGoalReached) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isGoalReached]);

  // Web Motion Fallback
  useEffect(() => {
    if (window.addNativeSteps) return;

    let gravityX = 0;
    let gravityY = 0;
    let gravityZ = 0;
    let lastStepTime = 0;
    const windowSize = 4;
    const magBuffer = [];
    const alpha = 0.8;

    const handleDeviceMotion = (event) => {
      let userX = 0;
      let userY = 0;
      let userZ = 0;

      if (event.acceleration && typeof event.acceleration.x === 'number' && event.acceleration.x !== null && (event.acceleration.x !== 0 || event.acceleration.y !== 0 || event.acceleration.z !== 0)) {
        userX = event.acceleration.x || 0;
        userY = event.acceleration.y || 0;
        userZ = event.acceleration.z || 0;
      } else if (event.accelerationIncludingGravity && typeof event.accelerationIncludingGravity.x === 'number') {
        const rawX = event.accelerationIncludingGravity.x || 0;
        const rawY = event.accelerationIncludingGravity.y || 0;
        const rawZ = event.accelerationIncludingGravity.z || 0;

        gravityX = alpha * gravityX + (1 - alpha) * rawX;
        gravityY = alpha * gravityY + (1 - alpha) * rawY;
        gravityZ = alpha * gravityZ + (1 - alpha) * rawZ;

        userX = rawX - gravityX;
        userY = rawY - gravityY;
        userZ = rawZ - gravityZ;
      }

      const userMagnitude = Math.sqrt(userX * userX + userY * userY + userZ * userZ);
      magBuffer.push(userMagnitude);
      if (magBuffer.length > windowSize) magBuffer.shift();
      const smoothedMag = magBuffer.reduce((a, b) => a + b, 0) / magBuffer.length;
      const now = Date.now();

      if (smoothedMag > 0.65 && (now - lastStepTime) >= 150 && (now - lastStepTime) <= 1800) {
        lastStepTime = now;
        setHourlyData(prev => {
          const next = [...prev];
          const hour = new Date().getHours();
          next[hour] = {
            ...next[hour],
            steps: next[hour].steps + 1
          };
          return next;
        });
      }
    };

    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleDeviceMotion, true);
    }
    return () => {
      if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleDeviceMotion, true);
      }
    };
  }, []);

  const handleConfirmReset = () => {
    if (window.AndroidStepBridge && window.AndroidStepBridge.resetNativeBaseline) {
      try {
        window.AndroidStepBridge.resetNativeBaseline();
      } catch (e) {}
    }
    setHourlyData(generateEmptyHourlyData());
    setFoodIntakeKcal(0);
    setStreakDays(0);
    setWeeklyHistory(Array.from({ length: 7 }, () => ({ completed: false, steps: 0 })));
    setShowResetModal(false);
  };

  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {}
    }
    setUser(null);
    localStorage.removeItem('pacepulse_user');
    setHourlyData(generateEmptyHourlyData());
    setProfile(DEFAULT_PROFILE);
    setStreakDays(0);
    setWeeklyHistory(Array.from({ length: 7 }, () => ({ completed: false, steps: 0 })));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Sticky Navbar */}
      <Navbar
        user={user}
        streakDays={streakDays}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* Action Bar for Social Connections, Audio Coach & History */}
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '16px auto 0',
        padding: '0 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowSocialModal(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              border: 'none',
              color: 'white',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
          >
            <span>🏆</span> Friends Leaderboard & Requests
          </button>

          <button
            onClick={handleToggleMute}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: isMuted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${isMuted ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              color: isMuted ? '#f87171' : '#34d399',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{isMuted ? '🔇' : '🎙️'}</span> {isMuted ? 'Voice Muted' : 'Voice Coach ON'}
          </button>
        </div>

        {/* Right Action Button */}
        <button
          onClick={() => setShowHistoryModal(true)}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#60a5fa',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>📜</span> View Activity History Log
        </button>
      </div>

      {/* Main Dashboard Layout */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 16px 60px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Top Section: Main Step Gauge & Streak Summary */}
        <div className="dashboard-grid">
          {/* Circular Step Ring Card */}
          <StepRing
            steps={totalDailySteps}
            goal={profile.dailyGoal}
            caloriesData={caloriesData}
            onOpenResetModal={() => setShowResetModal(true)}
            onOpenShareModal={() => setShowShareModal(true)}
            isGoalReached={isGoalReached}
          />

          {/* Streak & Weekly Badges Card */}
          <StreakTracker
            streakDays={streakDays}
            history={weeklyHistory}
            dailyGoal={profile.dailyGoal}
            onOpenShareModal={() => setShowShareModal(true)}
          />
        </div>

        {/* Net Active Calorie Balance Widget */}
        <CalorieTrackerWidget
          activeKcal={caloriesData.activeKcal}
          foodIntakeKcal={foodIntakeKcal}
          onAddMeal={handleAddMeal}
        />

        {/* Bottom Section: 24-Hour Step Breakdown Chart */}
        <HourlyChart
          hourlyData={hourlyData}
          currentHour={currentHour}
        />
      </main>

      {/* Footer */}
      <footer style={{
        padding: '20px',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        fontSize: '12px',
        color: 'var(--text-dim)',
        background: 'rgba(7, 9, 14, 0.9)'
      }}>
        PacePulse AI — AI Voice Coach, Social Leaderboards & High Precision Active Calorie Engine
      </footer>

      {/* Modals */}
      {showAuthModal && (
        <AuthModal
          onAuthSuccess={handleAuthSuccess}
          onGuestLogin={handleGuestLogin}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          profile={profile}
          onSave={setProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showShareModal && (
        <ShareModal
          steps={totalDailySteps}
          goal={profile.dailyGoal}
          streakDays={streakDays}
          caloriesData={caloriesData}
          profile={profile}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showResetModal && (
        <ResetConfirmationModal
          onConfirmReset={handleConfirmReset}
          onClose={() => setShowResetModal(false)}
        />
      )}

      {showHistoryModal && (
        <HistoryModal
          user={user}
          profile={profile}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showSocialModal && (
        <SocialLeaderboardModal
          user={user}
          userSteps={totalDailySteps}
          activeKcal={caloriesData.activeKcal}
          distanceKm={caloriesData.distanceKm}
          onClose={() => setShowSocialModal(false)}
        />
      )}
    </div>
  );
}
