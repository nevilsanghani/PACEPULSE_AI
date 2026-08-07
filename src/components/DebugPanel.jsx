import React, { useState, useEffect } from 'react';
import { Bug, X } from 'lucide-react';
import { auth, debugLog } from '../firebase';

/**
 * Temporary on-device diagnostic panel for chasing the "steps stuck at 0" /
 * "always shows Offline" reports without needing a USB/adb connection - shows
 * live bridge/auth/sync state directly on the phone. Safe to rip out once
 * those are root-caused; it only reads existing state, never writes anything.
 */
export function DebugPanel({ hourlyDataReadyRef, nativeCallInfoRef, totalDailySteps, cloudSyncStatus, userUid }) {
  const [open, setOpen] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: '90px', right: '16px', zIndex: 500,
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.9)', border: 'none', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', cursor: 'pointer'
        }}
        title="Debug Panel"
      >
        <Bug size={20} />
      </button>
    );
  }

  const bridgePresent = !!(window.AndroidStepBridge);
  const nativeInfo = nativeCallInfoRef.current;
  const authUser = auth.currentUser;

  const row = (label, value, warn) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span style={{ color: warn ? '#FB923C' : '#E2E8F0', fontWeight: 700, textAlign: 'right', wordBreak: 'break-all' }}>{String(value)}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', bottom: '90px', right: '16px', left: '16px', zIndex: 500,
      maxHeight: '70vh', overflowY: 'auto',
      background: 'rgba(10, 15, 26, 0.97)', border: '1px solid rgba(239, 68, 68, 0.4)',
      borderRadius: '16px', padding: '14px', fontSize: '11px', fontFamily: 'monospace',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ color: '#EF4444', fontSize: '13px' }}>Debug Panel</strong>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}><X size={18} /></button>
      </div>

      <div style={{ marginBottom: '8px', color: '#38BDF8', fontWeight: 700 }}>Step Pipeline</div>
      {row('AndroidStepBridge present', bridgePresent, !bridgePresent)}
      {row('Native calls received', nativeInfo.count)}
      {row('Last value from native', nativeInfo.lastValue ?? '—')}
      {row('Last native call at', nativeInfo.lastTime ?? '—')}
      {row('hourlyDataReadyRef', hourlyDataReadyRef.current, !hourlyDataReadyRef.current)}
      {row('React totalDailySteps', totalDailySteps)}

      <div style={{ margin: '12px 0 8px', color: '#38BDF8', fontWeight: 700 }}>Auth / Sync</div>
      {row('App user.uid (React)', userUid || '(none)')}
      {row('auth.currentUser', authUser ? authUser.uid : 'NULL', !authUser)}
      {row('auth.currentUser.email', authUser ? authUser.email : '—')}
      {row('cloudSyncStatus', cloudSyncStatus, cloudSyncStatus === 'offline')}

      <div style={{ margin: '12px 0 8px', color: '#38BDF8', fontWeight: 700 }}>Last {debugLog.length} Firestore Calls</div>
      {debugLog.length === 0 && <div style={{ color: '#64748B' }}>No Firestore calls logged yet.</div>}
      {debugLog.map((entry, i) => (
        <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ color: entry.ok ? '#34D399' : '#EF4444', fontWeight: 700 }}>
            {entry.time} — {entry.method} {entry.path} → {entry.status ?? 'NO RESPONSE'} {entry.ok ? 'OK' : 'FAIL'}
          </div>
          <div style={{ color: '#64748B' }}>
            authUser: {entry.authUser || 'null'} | tokenAttached: {String(entry.authAttached)}
            {entry.tokenError ? ` | tokenError: ${entry.tokenError}` : ''}
            {entry.fetchError ? ` | fetchError: ${entry.fetchError}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
