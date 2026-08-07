import React, { useState, useEffect } from 'react';
import { getDailyLogsFromDb } from '../firebase';
import { getLocalDateStr } from '../utils/fitnessEngine';

export function HistoryModal({ user, profile, onClose }) {
  const todayStr = getLocalDateStr();
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  useEffect(() => {
    let isMounted = true;

    async function loadUserPastHistory() {
      if (!user || !user.uid || user.uid === 'guest') {
        setHistoryLogs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const uid = user.uid;

      // 1. Read user-isolated local history cache
      let localLogs = [];
      try {
        const historyKey = `pacepulse_history_${uid}`;
        const savedHistory = localStorage.getItem(historyKey);
        if (savedHistory) {
          localLogs = JSON.parse(savedHistory);
        }
      } catch (e) {}

      // Grab today's date-scoped local hourly data if available
      try {
        const todayHourlyKey = `pacepulse_hourly_${uid}_${todayStr}`;
        const savedHourly = localStorage.getItem(todayHourlyKey);
        if (savedHourly) {
          const parsedHourly = JSON.parse(savedHourly);
          const todayTotal = parsedHourly.reduce((acc, h) => acc + (h.steps || 0), 0);
          if (todayTotal > 0) {
            const existingIdx = localLogs.findIndex(l => l.date === todayStr);
            const todayLogObj = {
              date: todayStr,
              steps: todayTotal,
              goal: profile?.dailyGoal || 10000,
              activeKcal: Math.round(todayTotal * 0.04),
              distanceKm: parseFloat(((todayTotal * 0.72) / 1000).toFixed(2)),
              durationMins: Math.round(todayTotal / 100),
              hourlyData: parsedHourly
            };

            if (existingIdx >= 0) {
              localLogs[existingIdx] = todayLogObj;
            } else {
              localLogs.unshift(todayLogObj);
            }
          }
        }
      } catch (e) {}

      if (isMounted) {
        setHistoryLogs(localLogs);
        setLoading(false);
      }

      // 2. Fetch remote daily logs from Cloud Firestore ONLY for current logged-in user!
      try {
        const remoteLogs = await getDailyLogsFromDb(uid);
        if (Array.isArray(remoteLogs) && remoteLogs.length > 0 && isMounted) {
          const formatted = remoteLogs.map(log => {
            return {
              date: log.date,
              steps: log.steps || 0,
              goal: log.goal || profile?.dailyGoal || 10000,
              activeKcal: log.activeKcal || Math.round((log.steps || 0) * 0.04),
              distanceKm: log.distanceKm || parseFloat((((log.steps || 0) * 0.72) / 1000).toFixed(2)),
              durationMins: Math.round((log.steps || 0) / 100),
              hourlyData: log.hourlyData || null
            };
          }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

          setHistoryLogs(formatted);
          localStorage.setItem(`pacepulse_history_${uid}`, JSON.stringify(formatted));
        }
      } catch (e) {
        console.error("Firestore user history fetch error:", e);
      }
    }

    loadUserPastHistory();

    return () => {
      isMounted = false;
    };
  }, [user, profile, todayStr]);

  // Find the selected date log, or generate a fallback structure if not logged yet
  const activeLog = React.useMemo(() => {
    const found = historyLogs.find(l => l.date === selectedDate);
    if (found) return found;

    // Default empty structure for dates with no activity yet
    return {
      date: selectedDate,
      steps: 0,
      goal: profile?.dailyGoal || 10000,
      activeKcal: 0,
      distanceKm: 0,
      durationMins: 0,
      hourlyData: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${i.toString().padStart(2, '0')}:00`,
        steps: 0
      }))
    };
  }, [historyLogs, selectedDate, profile?.dailyGoal]);

  const formatDateDisplay = (dateString) => {
    if (dateString === todayStr) return 'Today (' + dateString + ')';
    const d = new Date(dateString + 'T00:00:00');
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.84)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        padding: '24px',
        borderRadius: '24px',
        background: 'rgba(10, 15, 26, 0.96)',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#00F2FE', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Activity History Analysis
            </span>
            <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 900, color: 'var(--text-bright)' }}>
              📅 Select Date & View Progress
            </h2>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              color: 'var(--text-dim)',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* 1. Date Selector Controls */}
        <div style={{
          background: 'rgba(0, 242, 254, 0.06)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '16px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#00F2FE', textTransform: 'uppercase', marginBottom: '8px' }}>
            Choose Date to Inspect:
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(10, 15, 26, 0.9)',
                border: '1px solid rgba(0, 242, 254, 0.4)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            />

            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
              Showing: <span style={{ color: '#00F2FE' }}>{formatDateDisplay(selectedDate)}</span>
            </span>
          </div>

          {/* Quick Date Chips (Past 7 Days) */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingTop: '10px' }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const dateStr = getLocalDateStr(d);
              const isSelected = dateStr === selectedDate;
              const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: isSelected ? 'linear-gradient(135deg, #00F2FE 0%, #3B82F6 100%)' : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? '#040914' : 'var(--text-dim)',
                    border: `1px solid ${isSelected ? '#00F2FE' : 'rgba(255, 255, 255, 0.1)'}`
                  }}
                >
                  {dayName} ({dateStr.slice(5)})
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Selected Date Activity Breakdown UI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '16px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Total Steps</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#00F2FE', marginTop: '4px' }}>
                🚶 {activeLog.steps.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                Goal: {(activeLog.goal || 10000).toLocaleString()} ({Math.min(Math.round((activeLog.steps / (activeLog.goal || 10000)) * 100), 999)}%)
              </div>
            </div>

            <div style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: '16px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Active Calories</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#F87171', marginTop: '4px' }}>
                🔥 {activeLog.activeKcal} kcal
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                Distance: 📏 {activeLog.distanceKm} km • ⏱️ {activeLog.durationMins} mins
              </div>
            </div>
          </div>

          {/* 24-Hour Hourly Step Progress Breakdown Bar Chart */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-bright)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📊 24-Hour Step Breakdown for {selectedDate}</span>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>00:00 - 23:00</span>
            </div>

            {activeLog.hourlyData && Array.isArray(activeLog.hourlyData) && activeLog.hourlyData.length === 24 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {(() => {
                  const maxHourlySteps = Math.max(...activeLog.hourlyData.map(h => h.steps || 0), 10);
                  return activeLog.hourlyData.map((h, i) => {
                    const pct = Math.min(Math.round(((h.steps || 0) / maxHourlySteps) * 100), 100);
                    const hourLabel = `${i.toString().padStart(2, '0')}:00`;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                        <span style={{ width: '42px', color: '#9CA3AF', fontWeight: 600 }}>{hourLabel}</span>
                        <div style={{ flex: 1, height: '12px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct > 0 ? 'linear-gradient(90deg, #00F2FE 0%, #3B82F6 100%)' : 'transparent',
                            borderRadius: '6px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ width: '50px', textAlign: 'right', fontWeight: 700, color: (h.steps || 0) > 0 ? '#00F2FE' : '#6B7280' }}>
                          {(h.steps || 0).toLocaleString()}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', fontSize: '13px' }}>
                No hourly step breakdown recorded for this selected date.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
