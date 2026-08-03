import React, { useState, useEffect } from 'react';
import { getDailyLogsFromDb } from '../firebase';

export function HistoryModal({ user, profile, onClose }) {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPastHistory() {
      const todayStr = new Date().toISOString().split('T')[0];
      const uid = user ? user.uid : 'guest';

      // 1. Load from local cache instantly
      let localLogs = [];
      try {
        const historyKey = `pacepulse_history_${uid}`;
        const savedHistory = localStorage.getItem(historyKey);
        if (savedHistory) {
          localLogs = JSON.parse(savedHistory);
        }
      } catch (e) {}

      // Also grab today's local hourly if available
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
              displayDate: 'Today',
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

      // 2. Fetch all daily logs from Cloud Firestore
      if (user && user.uid && user.uid !== 'guest') {
        try {
          const remoteLogs = await getDailyLogsFromDb(user.uid);
          if (Array.isArray(remoteLogs) && remoteLogs.length > 0 && isMounted) {
            const formatted = remoteLogs.map(log => {
              const d = new Date(log.date + 'T00:00:00');
              const isToday = log.date === todayStr;
              const displayDate = isToday 
                ? 'Today (' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ')'
                : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

              return {
                date: log.date,
                displayDate: isNaN(d.getTime()) ? log.date : displayDate,
                steps: log.steps || 0,
                goal: log.goal || profile?.dailyGoal || 10000,
                activeKcal: log.activeKcal || Math.round((log.steps || 0) * 0.04),
                distanceKm: log.distanceKm || parseFloat((((log.steps || 0) * 0.72) / 1000).toFixed(2)),
                durationMins: Math.round((log.steps || 0) / 100),
                hourlyData: log.hourlyData || null
              };
            }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

            setHistoryLogs(formatted);
          }
        } catch (e) {
          console.error("Firestore history fetch error:", e);
        }
      }
    }

    loadPastHistory();

    return () => {
      isMounted = false;
    };
  }, [user, profile]);

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '620px',
        width: '100%',
        maxHeight: '85vh',
        padding: '24px',
        borderRadius: '24px',
        background: 'rgba(10, 15, 26, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Main History Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-bright)' }}>
              📜 Daily Activity History
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim)' }}>
              Tap any date to view detailed 24-hour step breakdown & metrics
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: 'var(--text-dim)',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Logs List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
              Loading your activity history... ⏳
            </div>
          ) : historyLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>👟</span>
              No past activity logs recorded yet. Take a walk today to start your history!
            </div>
          ) : (
            historyLogs.map((log) => (
              <div 
                key={log.date} 
                onClick={() => setSelectedLog(log)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                }}
                className="hover-card-bright"
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#60a5fa', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅 {log.displayDate || log.date}</span>
                    <span style={{ fontSize: '11px', color: '#00F2FE', background: 'rgba(0, 242, 254, 0.12)', padding: '2px 8px', borderRadius: '8px' }}>
                      🔍 Tap to View 24h
                    </span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-bright)' }}>
                    🚶 {log.steps.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>/ {(log.goal || 10000).toLocaleString()} goal</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Calories</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>🔥 {log.activeKcal} <span style={{ fontSize: '11px' }}>kcal</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Distance</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>📏 {log.distanceKm} <span style={{ fontSize: '11px' }}>km</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Walk Time</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>⏱️ {log.durationMins} <span style={{ fontSize: '11px' }}>mins</span></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selected Date Hourly Breakdown Popup Window */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            padding: '24px',
            borderRadius: '24px',
            background: 'rgba(10, 15, 26, 0.98)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            boxShadow: '0 0 40px rgba(0, 242, 254, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: 'auto'
          }}>
            {/* Popup Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#00F2FE', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Detailed Day Analysis
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 900, color: '#FFFFFF' }}>
                  📅 {selectedLog.displayDate || selectedLog.date}
                </h3>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '16px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Total Steps</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#00F2FE', marginTop: '4px' }}>
                  🚶 {selectedLog.steps.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                  Goal: {(selectedLog.goal || 10000).toLocaleString()} steps ({Math.round((selectedLog.steps / (selectedLog.goal || 10000)) * 100)}%)
                </div>
              </div>

              <div style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: '16px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Active Calories</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#F87171', marginTop: '4px' }}>
                  🔥 {selectedLog.activeKcal} kcal
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                  Distance: 📏 {selectedLog.distanceKm} km
                </div>
              </div>
            </div>

            {/* 24-Hour Step Progress Bar Chart */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-bright)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📊 24-Hour Hourly Step Progress</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>00:00 to 23:00</span>
              </div>

              {selectedLog.hourlyData && Array.isArray(selectedLog.hourlyData) && selectedLog.hourlyData.length === 24 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0, 0, 0, 0.4)', padding: '14px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  {(() => {
                    const maxHourlySteps = Math.max(...selectedLog.hourlyData.map(h => h.steps || 0), 10);
                    return selectedLog.hourlyData.map((h, i) => {
                      const pct = Math.min(Math.round(((h.steps || 0) / maxHourlySteps) * 100), 100);
                      const hourLabel = `${i.toString().padStart(2, '0')}:00`;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                          <span style={{ width: '42px', color: '#9CA3AF', fontWeight: 600 }}>{hourLabel}</span>
                          <div style={{ flex: 1, height: '14px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
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
                  No hourly breakdown recorded for this past date.
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Close Detail View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
