import React, { useState, useEffect } from 'react';
import { getDailyLogsFromDb } from '../firebase';

export function HistoryModal({ user, profile, onClose }) {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPastHistory() {
      const today = new Date();
      const localLogs = [];
      const userKey = user ? (user.uid || user.email) : 'guest';

      // 1. Build instant synchronous local logs
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const localHourlyKey = `pacepulse_hourly_${userKey}`;
        const localHourly = localStorage.getItem(localHourlyKey);

        if (i === 0 && localHourly) {
          try {
            const parsed = JSON.parse(localHourly);
            const totalSteps = parsed.reduce((sum, h) => sum + h.steps, 0);
            if (totalSteps > 0) {
              const strideMeters = (profile?.heightCm || 175) * 0.415 / 100;
              const distKm = (totalSteps * strideMeters) / 1000;
              const activeKcal = Math.round(totalSteps * 0.04);
              const durationMins = Math.round(totalSteps / 100);
              localLogs.push({
                dateStr,
                displayDate: 'Today (' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ')',
                steps: totalSteps,
                activeKcal,
                distanceKm: parseFloat(distKm.toFixed(2)),
                durationMins
              });
            }
          } catch (e) {}
        }
      }

      if (isMounted) {
        setHistoryLogs(localLogs);
        setLoading(false);
      }

      // 2. Query Firestore asynchronously in parallel with a 2-second timeout guard
      if (user && user.uid && user.uid !== 'guest') {
        try {
          const dates = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            return {
              dateStr: d.toISOString().split('T')[0],
              displayDate: i === 0 ? 'Today (' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ')' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            };
          });

          const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 2000));
          const fetchPromise = Promise.all(dates.map(d => getDailyLogsFromDb(user.uid, d.dateStr)));

          const cloudResults = await Promise.race([fetchPromise, timeoutPromise]);

          if (Array.isArray(cloudResults) && cloudResults.length > 0 && isMounted) {
            const merged = [];
            dates.forEach((d, idx) => {
              const cloudLog = cloudResults[idx];
              if (cloudLog && cloudLog.totalSteps > 0) {
                merged.push({
                  dateStr: d.dateStr,
                  displayDate: d.displayDate,
                  steps: cloudLog.totalSteps || 0,
                  activeKcal: cloudLog.activeKcal || cloudLog.totalKcal || Math.round(cloudLog.totalSteps * 0.04),
                  distanceKm: cloudLog.distanceKm || parseFloat(((cloudLog.totalSteps * 0.72) / 1000).toFixed(2)),
                  durationMins: cloudLog.durationMins || Math.round(cloudLog.totalSteps / 100)
                });
              }
            });

            if (merged.length > 0) {
              setHistoryLogs(merged);
            }
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
