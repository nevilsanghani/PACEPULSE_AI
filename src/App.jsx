import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import confetti from 'canvas-confetti';
import { Navbar } from './components/Navbar';
import { StepRing } from './components/StepRing';
import { HourlyChart } from './components/HourlyChart';
import { WeeklyStepChart } from './components/WeeklyStepChart';
import { StreakTracker } from './components/StreakTracker';
import { ElevationWidget } from './components/ElevationWidget';
import { ProfileModal } from './components/ProfileModal';
import { ShareModal } from './components/ShareModal';
import { AuthModal } from './components/AuthModal';
import { ResetConfirmationModal } from './components/ResetConfirmationModal';
import { DeleteAccountModal } from './components/DeleteAccountModal';
import { HistoryModal } from './components/HistoryModal';
import { SocialLeaderboardModal } from './components/SocialLeaderboardModal';
import { NotificationModal } from './components/NotificationModal';
import { speakMilestoneAnnouncement, speakGoalReachedAnnouncement, setAudioCoachMuted } from './utils/audioCoach';
import { 
  auth,
  signOut,
  saveDailyLogsToDb,
  getDailyLogsFromDb,
  getPendingRequestsFromDb,
  queueOfflineDailyLog,
  flushOfflineSyncQueue,
  deleteUserAccountFromDb,
  fetchUserProfileDoc,
  saveUserProfileToDb
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
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [socialTab, setSocialTab] = useState('leaderboard');
  const [isAudioMuted, setIsMuted] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const [cloudSyncStatus, setCloudSyncStatus] = useState(navigator.onLine ? 'synced' : 'offline');

  // 24-Hour Step Breakdown Array (Date-scoped to prevent carrying forward yesterday's steps)
  const [hourlyData, setHourlyData] = useState(() => {
    const uid = user ? user.uid : 'guest';
    const key = `pacepulse_hourly_${uid}_${todayStr}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 24) return parsed;
      } catch (e) {}
    }
    return generateEmptyHourlyData();
  });

  // Today's Elevation Gain (meters climbed), synced from the native barometer bridge
  const [todayElevationM, setTodayElevationM] = useState(() => {
    const uid = user ? user.uid : 'guest';
    const key = `pacepulse_elevation_${uid}_${todayStr}`;
    const saved = localStorage.getItem(key);
    return saved !== null ? parseFloat(saved) : 0;
  });
  const [elevationSupported, setElevationSupported] = useState(true);

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

  // Gates window.syncNativeTodaySteps until the authoritative hourly breakdown has
  // been restored from Firestore after login - without this, the native step poll
  // (fires every 1s) can race ahead of that async fetch and reconstruct "current
  // hour = today's total minus everything else recorded so far" against a still-empty
  // array, dumping the whole day's steps into the current hour bucket.
  const hourlyDataReadyRef = React.useRef(!user || user.uid === 'guest');

  // Calculate sum of steps from 24 hourly buckets
  const totalDailySteps = hourlyData.reduce((sum, h) => sum + (h.steps || 0), 0);

  // Compute live Calories, Distance & MET Active Time (Memoized to prevent render loops)
  const caloriesData = React.useMemo(() => {
    return calculateCalories(totalDailySteps, profile);
  }, [totalDailySteps, profile]);

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
    hourlyDataReadyRef.current = false;
    refreshPendingRequests();

    // Fetch remote logs from Cloud Firestore for weekly chart & history
    getDailyLogsFromDb(user.uid).then(remoteLogs => {
      if (remoteLogs && remoteLogs.length > 0) {
        const historyKey = getUserKey('pacepulse_history', user);
        setWeeklyHistory(remoteLogs);
        localStorage.setItem(historyKey, JSON.stringify(remoteLogs));

        const todayLog = remoteLogs.find(l => l.date === todayStr);
        if (todayLog && todayLog.hourlyData && Array.isArray(todayLog.hourlyData) && todayLog.hourlyData.length === 24) {
          setHourlyData(todayLog.hourlyData);
          const hourlyKey = getUserKey('pacepulse_hourly', user);
          localStorage.setItem(hourlyKey, JSON.stringify(todayLog.hourlyData));
        }
        if (todayLog && typeof todayLog.elevationGainM === 'number') {
          setTodayElevationM(todayLog.elevationGainM);
        }
      }
    }).finally(() => {
      hourlyDataReadyRef.current = true;
    });

    const intervalId = setInterval(() => {
      refreshPendingRequests();
    }, 12000);

    return () => clearInterval(intervalId);
  }, [user, todayStr]);

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

  // Handle Online / Offline network event listeners
  useEffect(() => {
    const handleOnline = () => {
      setCloudSyncStatus('syncing');
      if (user && user.uid && user.uid !== 'guest') {
        flushOfflineSyncQueue(user.uid).then(() => setCloudSyncStatus('synced'));
      } else {
        setCloudSyncStatus('synced');
      }
    };

    const handleOffline = () => {
      setCloudSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  const lastSyncedRef = React.useRef({ steps: -1, date: '', uid: '', goal: -1, elevation: -1 });

  // Persist hourly data, streak & profile to user-scoped localStorage & Firestore DB
  useEffect(() => {
    const uid = user ? user.uid : 'guest';
    const key = `pacepulse_hourly_${uid}_${todayStr}`;
    localStorage.setItem(key, JSON.stringify(hourlyData));

    const elevationKey = `pacepulse_elevation_${uid}_${todayStr}`;
    localStorage.setItem(elevationKey, String(todayElevationM));

    // Push live UI metrics directly to Android AppWidget
    if (window.AndroidStepBridge && window.AndroidStepBridge.updateWidgetData) {
      window.AndroidStepBridge.updateWidgetData(
        totalDailySteps,
        profile.dailyGoal || 10000,
        caloriesData ? caloriesData.activeKcal || 0 : 0,
        caloriesData ? caloriesData.distanceKm || 0 : 0
      );
    }

    if (!user || user.uid === 'guest') return;

    // Check if step count or relevant params actually changed since last sync
    const last = lastSyncedRef.current;
    if (last.steps === totalDailySteps && last.date === todayStr && last.uid === user.uid && last.goal === profile.dailyGoal && last.elevation === todayElevationM) {
      return; // No change in steps, profile or elevation - skip network sync to avoid flickering!
    }

    lastSyncedRef.current = { steps: totalDailySteps, date: todayStr, uid: user.uid, goal: profile.dailyGoal, elevation: todayElevationM };

    if (navigator.onLine) {
      setCloudSyncStatus('syncing');
      saveDailyLogsToDb(
        user.uid,
        todayStr,
        totalDailySteps,
        profile.dailyGoal,
        caloriesData,
        hourlyData,
        todayElevationM
      ).then((ok) => {
        // A failed write (timeout, permission hiccup, WebView network flakiness)
        // used to be silently dropped here with no retry and a false "synced"
        // status - queue it for the next 'online' event instead, same as an
        // actually-offline write, so a transient failure can't permanently
        // lose a day's data before the local queue itself gets wiped.
        if (ok) {
          setCloudSyncStatus('synced');
        } else {
          queueOfflineDailyLog(user.uid, todayStr, totalDailySteps, profile.dailyGoal, caloriesData, hourlyData, todayElevationM);
          setCloudSyncStatus('offline');
        }
      });
    } else {
      queueOfflineDailyLog(
        user.uid,
        todayStr,
        totalDailySteps,
        profile.dailyGoal,
        caloriesData,
        hourlyData,
        todayElevationM
      );
      setCloudSyncStatus('offline');
    }
  }, [hourlyData, user, profile.dailyGoal, totalDailySteps, caloriesData, todayStr, todayElevationM]);

  useEffect(() => {
    const key = getUserKey('pacepulse_profile');
    localStorage.setItem(key, JSON.stringify(profile));

    // Push to Firestore too - without this, profile edits (weight, height, goal,
    // etc.) only ever lived in the WebView's local storage, which is wiped on
    // uninstall, silently rolling the user back to their signup-time defaults.
    if (user && user.uid !== 'guest') {
      saveUserProfileToDb(user.uid, profile);
    }
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
      // Skip while the authoritative hourly breakdown is still loading from Firestore
      // after a login - otherwise this can race ahead of that fetch and reconstruct
      // today's whole step total into the current hour against a stale/empty array.
      if (!hourlyDataReadyRef.current) return;

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

    window.syncNativeTodayElevation = (meters, supported = true) => {
      if (typeof meters === 'number' && !isNaN(meters)) {
        setTodayElevationM(meters);
      }
      setElevationSupported(!!supported);
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
      delete window.syncNativeTodayElevation;
    };
  }, [user]);

  // Handle Authentication Success (Switching user or signing in)
  const handleAuthSuccess = async (authenticatedUser) => {
    setUser(authenticatedUser);
    localStorage.setItem('pacepulse_user', JSON.stringify(authenticatedUser));

    const currentUid = authenticatedUser ? authenticatedUser.uid : 'guest';

    if (window.AndroidStepBridge && window.AndroidStepBridge.setActiveUser) {
      window.AndroidStepBridge.setActiveUser(currentUid);
    }

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

    // Load isolated hourly data for authenticated user. Not "ready" yet - the native
    // step poll must not touch hourlyData until the Firestore fetch below (the
    // authoritative source) has had a chance to correct this local copy, otherwise a
    // poll tick racing ahead of that fetch would reconstruct today's whole step total
    // into the current hour against this possibly-stale/empty array.
    hourlyDataReadyRef.current = false;
    const hourlyKey = getUserKey('pacepulse_hourly', authenticatedUser);
    const savedHourly = localStorage.getItem(hourlyKey);
    if (savedHourly) {
      try {
        const parsed = JSON.parse(savedHourly);
        if (Array.isArray(parsed) && parsed.length === 24) {
          setHourlyData(parsed);
        } else {
          setHourlyData(generateEmptyHourlyData());
        }
      } catch (e) {
        setHourlyData(generateEmptyHourlyData());
      }
    } else {
      setHourlyData(generateEmptyHourlyData());
    }

    // Load isolated elevation gain for authenticated user
    const savedElevation = localStorage.getItem(`pacepulse_elevation_${currentUid}_${todayStr}`);
    setTodayElevationM(savedElevation !== null ? parseFloat(savedElevation) : 0);

    if (authenticatedUser.uid && authenticatedUser.uid !== 'guest') {
      try {
        const remoteLogs = await getDailyLogsFromDb(authenticatedUser.uid);
        if (remoteLogs && remoteLogs.length > 0) {
          const historyKey = getUserKey('pacepulse_history', authenticatedUser);
          setWeeklyHistory(remoteLogs);
          localStorage.setItem(historyKey, JSON.stringify(remoteLogs));

          const todayLog = remoteLogs.find(l => l.date === todayStr);
          if (todayLog && todayLog.hourlyData && Array.isArray(todayLog.hourlyData) && todayLog.hourlyData.length === 24) {
            setHourlyData(todayLog.hourlyData);
            localStorage.setItem(hourlyKey, JSON.stringify(todayLog.hourlyData));
          }
          if (todayLog && typeof todayLog.elevationGainM === 'number') {
            setTodayElevationM(todayLog.elevationGainM);
          }
        }
      } finally {
        hourlyDataReadyRef.current = true;
      }
    } else {
      hourlyDataReadyRef.current = true;
    }
  };

  // Keep a ref of the latest user so the long-lived onAuthStateChanged listener
  // below never compares against a stale closure.
  const userRef = React.useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Authoritative session check: real Firebase Auth session state wins over any
  // cached localStorage session. This is what catches a session cached under the
  // old (pre-migration) uid scheme - since it isn't backed by a real Firebase Auth
  // session, it gets cleared here and the user is sent back to sign in, which
  // transparently triggers the one-time legacy-account migration in loginUserInDb.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!userRef.current || userRef.current.uid !== firebaseUser.uid) {
          const freshUser = await fetchUserProfileDoc(firebaseUser.uid, firebaseUser.email || '');
          await handleAuthSuccess(freshUser);
        }
      } else if (userRef.current && userRef.current.uid !== 'guest') {
        // Cached session isn't guest mode and isn't backed by a real Firebase session - stale, clear it
        localStorage.removeItem('pacepulse_user');
        setUser(null);
        setShowAuthModal(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sign Out Handler
  const handleSignOut = () => {
    signOut();
    if (window.AndroidStepBridge && window.AndroidStepBridge.setActiveUser) {
      window.AndroidStepBridge.setActiveUser('guest');
    }
    setUser(null);
    localStorage.removeItem('pacepulse_user');
    setProfile(DEFAULT_PROFILE);
    setHourlyData(generateEmptyHourlyData());
    setTodayElevationM(0);
    setShowAuthModal(true);
  };

  // Permanently Delete Account: wipes Cloud Firestore data + all local caches, then signs out
  const handleDeleteAccount = async () => {
    if (!user || !user.uid || user.uid === 'guest') return;

    const result = await deleteUserAccountFromDb(user.uid, user.email);
    if (!result.success) return result;

    if (window.AndroidStepBridge && window.AndroidStepBridge.setActiveUser) {
      window.AndroidStepBridge.setActiveUser('guest');
    }

    setShowDeleteAccountModal(false);
    setShowProfileModal(false);
    setUser(null);
    localStorage.removeItem('pacepulse_user');
    setProfile(DEFAULT_PROFILE);
    setHourlyData(generateEmptyHourlyData());
    setTodayElevationM(0);
    setWeeklyHistory([]);
    setStreakDays(0);
    setShowAuthModal(true);
  };

  const handleResetBaseline = () => {
    const emptyHourly = generateEmptyHourlyData();
    setHourlyData(emptyHourly);
    setTodayElevationM(0);
    setShowResetModal(false);

    const uid = user ? user.uid : 'guest';
    const hourlyKey = getUserKey('pacepulse_hourly', user);
    localStorage.setItem(hourlyKey, JSON.stringify(emptyHourly));

    const todayHourlyKey = `pacepulse_hourly_${uid}_${todayStr}`;
    localStorage.setItem(todayHourlyKey, JSON.stringify(emptyHourly));

    const todayElevationKey = `pacepulse_elevation_${uid}_${todayStr}`;
    localStorage.setItem(todayElevationKey, '0');

    // Reset weekly step progress entry for today to 0
    setWeeklyHistory(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex(item => item && item.date === todayStr);
      const resetLog = {
        date: todayStr,
        steps: 0,
        goal: profile.dailyGoal || 10000,
        activeKcal: 0,
        distanceKm: 0,
        durationMins: 0,
        elevationGainM: 0,
        completed: false,
        hourlyData: emptyHourly
      };

      if (idx >= 0) {
        list[idx] = resetLog;
      } else {
        list.unshift(resetLog);
      }

      const historyKey = getUserKey('pacepulse_history', user);
      localStorage.setItem(historyKey, JSON.stringify(list));
      return list;
    });

    if (user && user.uid !== 'guest') {
      saveDailyLogsToDb(user.uid, todayStr, 0, profile.dailyGoal, { activeKcal: 0, distanceKm: 0 }, emptyHourly, 0);
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
        cloudSyncStatus={cloudSyncStatus}
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
            onOpenHistory={() => setShowHistoryModal(true)}
          />

          {/* 24-Hour Breakdown Hourly Chart */}
          <HourlyChart 
            hourlyData={hourlyData}
            currentHour={new Date().getHours()}
          />

          {/* Elevation Gain (barometer-based, rejects elevators/vehicles) */}
          <ElevationWidget
            elevationM={todayElevationM}
            supported={elevationSupported}
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
          user={user}
          onSave={(updatedProfile) => setProfile(updatedProfile)}
          onClose={() => setShowProfileModal(false)}
          onOpenDeleteAccount={() => setShowDeleteAccountModal(true)}
        />
      )}

      {showDeleteAccountModal && (
        <DeleteAccountModal
          userEmail={user ? user.email : ''}
          onConfirmDelete={handleDeleteAccount}
          onClose={() => setShowDeleteAccountModal(false)}
        />
      )}

      {showShareModal && (
        <ShareModal
          steps={totalDailySteps}
          goal={profile.dailyGoal}
          caloriesData={caloriesData}
          streakDays={streakDays}
          profile={profile}
          elevationM={todayElevationM}
          elevationSupported={elevationSupported}
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
          user={user}
          profile={profile}
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
          onUpdatePendingCount={refreshPendingRequests}
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
