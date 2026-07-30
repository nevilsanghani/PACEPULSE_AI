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
import { NotificationModal } from './components/NotificationModal';
import { speakMilestoneAnnouncement, speakGoalReachedAnnouncement, setAudioCoachMuted } from './utils/audioCoach';
import { 
  auth, 
  signOut,
  saveDailyLogsToDb,
  getDailyLogsFromDb,
  getPendingRequestsFromDb
} from './firebase';
import { 
  DEFAULT_PROFILE, 
  calculateCalories, 
  calculateDistanceKm, 
  calculateAgeFromBirthDate, 
  calculateBMR, 
  calculateStrideCm 
} from './utils/fitnessEngine';

// Generate 24 empty hourly buckets (00:00 to 23:00)
function generateEmptyHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, '0')}:00`,
    steps: 0
  }));
}

export default function App() {
  // Current Authenticated User State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pacepulse_user');
    return saved ? JSON.parse(saved) : null;
  });

  const getUserKey = (prefix, currentUser = user) => {
    const uid = currentUser ? currentUser.uid : 'guest';
    return `${prefix}_${uid}`;
  };

  // User Profile Parameters State
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
  const [showNotificationModal, setShowNotificationModal] = useState(false);
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
    return saved !== null ? parseInt(saved, 10) : 0;
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

  const isGoalReached = totalDailySteps >= profile.dailyGoal;

  // Calculate dynamic streak: consecutive daily goal achievements
  const computedStreakDays = React.useMemo(() => {
    let count = 0;
    const sortedHistory = [...weeklyHistory].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    for (const log of sortedHistory) {
      if (log.date === todayStr) continue;
      if (log.steps >= (log.goal || profile.dailyGoal) && log.steps > 0) {
        count++;
      } else {
        break;
      }
    }
    if (isGoalReached) count++;
    return count;
  }, [weeklyHistory, todayStr, isGoalReached, profile.dailyGoal]);

  const [prevGoalReached, setPrevGoalReached] = useState(isGoalReached);
  const [lastMilestoneSpoken, setLastMilestoneSpoken] = useState(0);

  // Show Auth Modal if not logged in
  const [showAuthModal, setShowAuthModal] = useState(!user);

  // Pending connection requests for Notification Dot & Modal
  const [pendingRequestsList, setPendingRequestsList] = useState([]);
  const [lastReadTime, setLastReadTime] = useState(() => {
    const saved = localStorage.getItem('pacepulse_notifications_read_time');
    return saved ? parseInt(saved, 10) : 0;
  });

  const refreshPendingRequests = () => {
    if (!user || user.uid === 'guest') return;
    getPendingRequestsFromDb(user.uid).then(reqs => setPendingRequestsList(reqs));
  };

  useEffect(() => {
    if (!user || user.uid === 'guest') return;
    refreshPendingRequests();

    const intervalId = setInterval(() => {
      refreshPendingRequests();
    }, 12000);

    return () => clearInterval(intervalId);
  }, [user]);

  const isEveningGoalWarning = new Date().getHours() >= 20 && totalDailySteps < profile.dailyGoal;
  const hasActiveNotifications = pendingRequestsList.length > 0 || isGoalReached || isEveningGoalWarning;

  // Notification red dot on Navbar Bell icon
  const hasUnreadDot = hasActiveNotifications && (
    (pendingRequestsList.length > 0 && pendingRequestsList.some(r => new Date(r.sentAt || 0).getTime() > lastReadTime)) ||
    (isGoalReached && (Date.now() - lastReadTime > 3600000)) ||
    (isEveningGoalWarning && (Date.now() - lastReadTime > 3600000))
  );

  const handleOpenNotificationsModal = () => {
    setShowNotificationModal(true);
    const now = Date.now();
    setLastReadTime(now);
    localStorage.setItem('pacepulse_notifications_read_time', String(now));
  };

  // Milestone confetti & Voice Coach triggers
  useEffect(() => {
    if (isGoalReached && !prevGoalReached) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
      speakGoalReachedAnnouncement(profile.dailyGoal, caloriesData.activeKcal);
      setPrevGoalReached(true);
    } else if (!isGoalReached && prevGoalReached) {
      setPrevGoalReached(false);
    }

    const milestoneIntervals = [2500, 5000, 7500, 10000, 15000, 20000];
    const currentMilestone = milestoneIntervals.filter(m => totalDailySteps >= m).pop() || 0;
    
    if (currentMilestone > lastMilestoneSpoken && currentMilestone < profile.dailyGoal) {
      speakMilestoneAnnouncement(currentMilestone, profile.dailyGoal);
      setLastMilestoneSpoken(currentMilestone);
    }
  }, [totalDailySteps, profile.dailyGoal, isGoalReached, prevGoalReached, lastMilestoneSpoken, caloriesData.activeKcal]);

  // Persist hourly data, streak & profile to user-scoped localStorage & Firestore DB
  useEffect(() => {
    const key = getUserKey('pacepulse_hourly');
    localStorage.setItem(key, JSON.stringify(hourlyData));

    if (user && user.uid !== 'guest') {
      saveDailyLogsToDb(
        user.uid,
        todayStr,
        totalDailySteps,
        profile.dailyGoal,
        caloriesData,
        hourlyData
      );
    }
  }, [hourlyData, user, profile.dailyGoal, totalDailySteps, caloriesData, todayStr]);

  useEffect(() => {
    const key = getUserKey('pacepulse_profile');
    localStorage.setItem(key, JSON.stringify(profile));
  }, [profile, user]);

  useEffect(() => {
    const key = getUserKey('pacepulse_streak');
    localStorage.setItem(key, String(streakDays));
  }, [streakDays, user]);

  useEffect(() => {
    const key = getUserKey('pacepulse_history');
    localStorage.setItem(key, JSON.stringify(weeklyHistory));
  }, [weeklyHistory, user]);

  // Expose Hardware Step JS Bridge listener (`window.syncNativeTodaySteps`)
  useEffect(() => {
    window.syncNativeTodaySteps = (totalSteps) => {
      if (typeof totalSteps !== 'number' || isNaN(totalSteps)) return;

      setHourlyData(prev => {
        const next = [...prev];
        const hour = new Date().getHours();
        const otherHoursSum = prev.reduce((acc, item, idx) => idx === hour ? acc : acc + item.steps, 0);
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
          name: authenticatedUser.displayName || 'PacePulse User',
          email: authenticatedUser.email || ''
        };
        setProfile(newProfile);
        localStorage.setItem(profileKey, JSON.stringify(newProfile));
      }
    }

    if (authenticatedUser.uid && authenticatedUser.uid !== 'guest') {
      const remoteLogs = await getDailyLogsFromDb(authenticatedUser.uid);
      if (remoteLogs && remoteLogs.length > 0) {
        const historyKey = getUserKey('pacepulse_history', authenticatedUser);
        setWeeklyHistory(remoteLogs);
        localStorage.setItem(historyKey, JSON.stringify(remoteLogs));
      }
    }
  };

  // Sign Out Handler
  const handleSignOut = () => {
    signOut();
    setUser(null);
    localStorage.removeItem('pacepulse_user');
    setProfile(DEFAULT_PROFILE);
    setHourlyData(generateEmptyHourlyData());
    setShowAuthModal(true);
  };

  const handleResetBaseline = () => {
    const emptyHourly = generateEmptyHourlyData();
    setHourlyData(emptyHourly);
    setShowResetModal(false);

    const hourlyKey = getUserKey('pacepulse_hourly');
    localStorage.setItem(hourlyKey, JSON.stringify(emptyHourly));

    if (user && user.uid !== 'guest') {
      saveDailyLogsToDb(user.uid, todayStr, 0, profile.dailyGoal, null, emptyHourly);
    }

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
        onOpenNotifications={handleOpenNotificationsModal}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        isAudioMuted={isAudioMuted}
        onToggleAudioMute={handleToggleAudioMute}
        streakDays={computedStreakDays}
        pendingCount={pendingRequestsList.length}
        hasUnreadDot={hasUnreadDot}
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
            streakDays={computedStreakDays}
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

      {showNotificationModal && (
        <NotificationModal
          user={user}
          currentSteps={totalDailySteps}
          dailyGoal={profile.dailyGoal}
          pendingRequests={pendingRequestsList}
          onRefreshPendingRequests={refreshPendingRequests}
          onClose={() => setShowNotificationModal(false)}
          onMarkNotificationsRead={() => {
            const now = Date.now();
            setLastReadTime(now);
            localStorage.setItem('pacepulse_notifications_read_time', String(now));
          }}
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
