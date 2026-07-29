import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Navbar } from './components/Navbar';
import { StepRing } from './components/StepRing';
import { HourlyChart } from './components/HourlyChart';
import { WeeklyStepChart } from './components/WeeklyStepChart';
import { StreakTracker } from './components/StreakTracker';
import { ProfileModal } from './components/ProfileModal';
import { ShareModal } from './components/ShareModal';
import { AuthModal } from './components/AuthModal';
import { ResetConfirmationModal } from './components/ResetConfirmationModal';
import { HistoryModal } from './components/HistoryModal';
import { SocialLeaderboardModal } from './components/SocialLeaderboardModal';
import { speakMilestoneAnnouncement, speakGoalReachedAnnouncement, setAudioCoachMuted } from './utils/audioCoach';
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

  // UI Modal Visibility States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [socialTab, setSocialTab] = useState('leaderboard');
  const [isAudioMuted, setIsMuted] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // 24-Hour Step Breakdown Array
  const [hourlyData, setHourlyData] = useState(() => {
    const key = user ? getUserKey('pacepulse_hourly', user) : 'pacepulse_hourly_guest';
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 24) return parsed;
      } catch (e) {}
    }
    return generateEmptyHourlyData();
  });

  // Active Streak Days Counter
  const [streakDays, setStreakDays] = useState(() => {
    const key = user ? getUserKey('pacepulse_streak', user) : 'pacepulse_streak_guest';
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved, 10) : 1;
  });

  // 7-Day History Log
  const [weeklyHistory, setWeeklyHistory] = useState(() => {
    const key = user ? getUserKey('pacepulse_history', user) : 'pacepulse_history_guest';
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  });

  // Calculate sum of steps from 24 hourly buckets
  const totalDailySteps = hourlyData.reduce((sum, h) => sum + (h.steps || 0), 0);

  // Compute live Calories, Distance & MET Active Time
  const caloriesData = calculateCalories(totalDailySteps, profile);

  // Instant Native Android Hardware Step Sync Bridge & 1-Second Auto Polling
  useEffect(() => {
    window.syncNativeTodaySteps = (totalSteps) => {
      setHourlyData(prev => {
        const next = [...prev];
        const hour = new Date().getHours();
        const otherHoursSum = prev.reduce((sum, h, idx) => idx === hour ? sum : sum + h.steps, 0);
        const currentHourSteps = Math.max(totalSteps - otherHoursSum, 0);
        next[hour] = {
          ...next[hour],
          steps: currentHourSteps
        };
        return next;
      });
    };

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

    // Auto 1-second instant polling when app is active
    const pollInterval = setInterval(() => {
      if (window.AndroidStepBridge && window.AndroidStepBridge.requestInstantSync) {
        window.AndroidStepBridge.requestInstantSync();
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      delete window.syncNativeTodaySteps;
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

    try {
      const cloudLogs = await getDailyLogsFromDb(authenticatedUser.uid);
      if (cloudLogs && cloudLogs.length > 0) {
        setWeeklyHistory(cloudLogs);
        const historyKey = getUserKey('pacepulse_history', authenticatedUser);
        localStorage.setItem(historyKey, JSON.stringify(cloudLogs));
      }
    } catch (e) {
      console.warn("Cloud log sync error:", e);
    }

    setShowAuthModal(false);
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    setUser(null);
    localStorage.removeItem('pacepulse_user');
  };

  // Sync profile state changes to LocalStorage
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
      speakGoalReachedAnnouncement(profile.dailyGoal, caloriesData.activeKcal);
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
    const accelBuffer = [];

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null) return;

      const alpha = 0.8;
      gravityX = alpha * gravityX + (1 - alpha) * acc.x;
      gravityY = alpha * gravityY + (1 - alpha) * acc.y;
      gravityZ = alpha * gravityZ + (1 - alpha) * acc.z;

      const linearX = acc.x - gravityX;
      const linearY = acc.y - gravityY;
      const linearZ = acc.z - gravityZ;

      const gMagnitude = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ);
      accelBuffer.push(gMagnitude);
      if (accelBuffer.length > windowSize) accelBuffer.shift();

      const smoothMag = accelBuffer.reduce((a, b) => a + b, 0) / accelBuffer.length;
      const now = Date.now();

      if (smoothMag > 2.5 && (now - lastStepTime) > 300) {
        lastStepTime = now;
        const currentHour = new Date().getHours();

        setHourlyData(prev => {
          const next = [...prev];
          next[currentHour] = {
            ...next[currentHour],
            steps: next[currentHour].steps + 1
          };
          return next;
        });
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, []);

  // Reset daily steps baseline
  const handleResetBaseline = () => {
    setHourlyData(generateEmptyHourlyData());

    if (window.AndroidStepBridge && window.AndroidStepBridge.resetNativeBaseline) {
      window.AndroidStepBridge.resetNativeBaseline();
    }
  };

  const handleToggleAudioMute = () => {
    const nextMuted = !isAudioMuted;
    setIsMuted(nextMuted);
    setAudioCoachMuted(nextMuted);
  };

  const handleOpenSocialTab = (tab = 'leaderboard') => {
    setSocialTab(tab);
    setShowSocialModal(true);
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', background: 'var(--bg-gradient)', color: 'var(--text-main)' }}>
      {/* Dynamic Navigation Bar */}
      <Navbar 
        profile={profile}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenSocial={handleOpenSocialTab}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        isAudioMuted={isAudioMuted}
        onToggleAudioMute={handleToggleAudioMute}
      />

      {/* Main Content Layout */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Main Step Ring Widget with Instant Refresh */}
          <StepRing 
            steps={totalDailySteps}
            goal={profile.dailyGoal}
            caloriesData={caloriesData}
            onOpenResetModal={() => setShowResetModal(true)}
            onOpenShareModal={() => setShowShareModal(true)}
            isGoalReached={isGoalReached}
          />

          {/* 7-Day Weekly Progress Bar Chart */}
          <WeeklyStepChart 
            todaySteps={totalDailySteps}
            dailyGoal={profile.dailyGoal}
            weeklyHistory={weeklyHistory}
          />

          {/* 24-Hour Breakdown Hourly Chart */}
          <HourlyChart 
            hourlyData={hourlyData}
            currentHour={new Date().getHours()}
          />

          {/* Streak & Consistency Badge Section with Live Steps */}
          <StreakTracker 
            streakDays={streakDays}
            history={weeklyHistory}
            dailyGoal={profile.dailyGoal}
            currentSteps={totalDailySteps}
            onOpenShareModal={() => setShowShareModal(true)}
          />

        </div>
      </main>

      {/* Modals */}
      {showProfileModal && (
        <ProfileModal 
          profile={profile}
          onSave={(updatedProfile) => setProfile(updatedProfile)}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showShareModal && (
        <ShareModal 
          steps={totalDailySteps}
          goal={profile.dailyGoal}
          caloriesData={caloriesData}
          streakDays={streakDays}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showResetModal && (
        <ResetConfirmationModal 
          onConfirmReset={handleResetBaseline}
          onClose={() => setShowResetModal(false)}
        />
      )}

      {showHistoryModal && (
        <HistoryModal 
          userId={user ? user.uid : 'guest'}
          localHistory={weeklyHistory}
          dailyGoal={profile.dailyGoal}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showSocialModal && (
        <SocialLeaderboardModal 
          currentUser={user}
          currentProfile={profile}
          currentSteps={totalDailySteps}
          initialTab={socialTab}
          onClose={() => setShowSocialModal(false)}
        />
      )}

      {showAuthModal && (
        <AuthModal 
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
