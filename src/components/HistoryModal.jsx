import React, { useState, useEffect } from 'react';
import { getDailyLogsFromDb } from '../firebase';

export function HistoryModal({ user, profile, onClose }) {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPastHistory() {
      setLoading(true);
      const logs = [];
      const today = new Date();

      // Load past 14 days of activity records
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        let dayLog = null;

        // Try reading from Cloud Firestore if user is authenticated
        if (user && user.uid && user.uid !== 'guest') {
          dayLog = await getDailyLogsFromDb(user.uid, dateStr);
        }

        // Fallback to local storage
        if (!dayLog) {
          const userKey = user ? (user.uid || user.email) : 'guest';
          const localHourly = localStorage.getItem(`pacepulse_hourly_${userKey}`);
          if (i === 0 && localHourly) {
            const parsed = JSON.parse(localHourly);
            const totalSteps = parsed.reduce((sum, h) => sum + h.steps, 0);
            if (totalSteps > 0) {
              const strideMeters = (profile?.heightCm || 175) * 0.415 / 100;
              const distKm = (totalSteps * strideMeters) / 1000;
              const activeKcal = Math.round(totalSteps * 0.04);
              const durationMins = Math.round(totalSteps / 100);
              dayLog = {
                dateStr,
                totalSteps,
                activeKcal,
                distanceKm: parseFloat(distKm.toFixed(2)),
                durationMins
              };
            }
          }
        }

        if (dayLog && dayLog.totalSteps > 0) {
          logs.push({
            dateStr,
            displayDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            steps: dayLog.totalSteps || 0,
            activeKcal: dayLog.activeKcal || dayLog.totalKcal || Math.round(dayLog.totalSteps * 0.04),
            distanceKm: dayLog.distanceKm || parseFloat(((dayLog.totalSteps * 0.72) / 1000).toFixed(2)),
            durationMins: dayLog.durationMins || Math.round(dayLog.totalSteps / 100)
          });
        }
      }

      setHistoryLogs(logs);
      setLoading(false);
    }

    loadPastHistory();
  }, [user, profile]);

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '560px',
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-bright)' }}>
              📜 Daily Activity History
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim)' }}>
              Past daily steps, active calories, distance & walking time
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
              <div key={log.dateStr} style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#60a5fa', marginBottom: '6px' }}>
                    📅 {log.displayDate}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-bright)' }}>
                    🚶 {log.steps.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>steps</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calories</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>🔥 {log.activeKcal} <span style={{ fontSize: '11px' }}>kcal</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>📏 {log.distanceKm} <span style={{ fontSize: '11px' }}>km</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Walk Time</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>⏱️ {log.durationMins} <span style={{ fontSize: '11px' }}>mins</span></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
