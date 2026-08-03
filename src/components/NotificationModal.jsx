import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Trophy, AlertTriangle, Sparkles, UserCheck } from 'lucide-react';
import { acceptFriendRequestInDb, declineFriendRequestInDb } from '../firebase';

export function NotificationModal({ 
  user, 
  currentSteps = 0, 
  dailyGoal = 10000, 
  pendingRequests = [], 
  onRefreshPendingRequests,
  onClose,
  onMarkNotificationsRead
}) {
  const currentHour = new Date().getHours();
  const myUid = user?.uid || 'guest';

  // Action status tracker for inline button feedback ({ [reqId]: 'approved' | 'rejected' })
  const [requestActionStatus, setRequestActionStatus] = useState({});

  // Mark notifications read & poll for fresh requests when user opens the modal
  useEffect(() => {
    if (onMarkNotificationsRead) {
      onMarkNotificationsRead();
    }
    if (onRefreshPendingRequests) {
      onRefreshPendingRequests();
      const intervalId = setInterval(() => {
        onRefreshPendingRequests();
      }, 2500);
      return () => clearInterval(intervalId);
    }
  }, [onMarkNotificationsRead, onRefreshPendingRequests]);

  const handleApproveRequest = async (req) => {
    setRequestActionStatus(prev => ({ ...prev, [req.id]: 'approved' }));
    await acceptFriendRequestInDb(user || { uid: myUid }, req);
    if (onRefreshPendingRequests) onRefreshPendingRequests();
  };

  const handleRejectRequest = async (reqId) => {
    setRequestActionStatus(prev => ({ ...prev, [reqId]: 'rejected' }));
    await declineFriendRequestInDb(myUid, reqId);
    if (onRefreshPendingRequests) onRefreshPendingRequests();
  };

  // Filter out any requests that have been acted upon (accepted or rejected)
  const validPendingRequests = pendingRequests.filter(req => {
    return !requestActionStatus[req.id];
  });

  const isGoalReached = currentSteps >= dailyGoal;
  const isEveningWarning = currentHour >= 20 && currentSteps < dailyGoal;
  const hasAnyNotification = validPendingRequests.length > 0 || isGoalReached || isEveningWarning;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 9, 20, 0.88)',
      backdropFilter: 'blur(14px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 300,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
        borderRadius: '24px',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Header (Clean, Dedicated Notifications Feed) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.4)'
            }}>
              <Bell size={20} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                Notifications
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Active notifications & alerts from the last 24 hours
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Notifications Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* 1. Connection Request Notifications with Inline Approved/Rejected Status */}
          {validPendingRequests.map(req => {
            const status = requestActionStatus[req.id];
            return (
              <div key={req.id} style={{
                background: status === 'approved' 
                  ? 'rgba(16, 185, 129, 0.1)' 
                  : status === 'rejected'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${
                  status === 'approved'
                    ? 'rgba(16, 185, 129, 0.35)'
                    : status === 'rejected'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : 'rgba(245, 158, 11, 0.3)'
                }`,
                borderRadius: '16px',
                padding: '16px',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: status === 'approved' ? '#34D399' : status === 'rejected' ? '#F87171' : '#FBBF24', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '📩'}</span>
                  Connection Request
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                      {req.name} <span style={{ fontSize: '12px', color: '#00F2FE' }}>({req.username || `@${(req.email || 'user').split('@')[0]}`})</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {status === 'approved'
                        ? 'Connection Approved! You are now connected on Leaderboard.'
                        : status === 'rejected'
                        ? 'Request declined.'
                        : 'wants to connect on your Step Leaderboard'}
                    </div>
                  </div>

                  {/* Show Approve/Reject Buttons or Marked Approved Badge */}
                  {!status ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleApproveRequest(req)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          border: 'none',
                          color: 'white',
                          fontWeight: '800',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.18)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#F87171',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  ) : status === 'approved' ? (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34D399',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <UserCheck size={13} /> Approved
                    </span>
                  ) : (
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#F87171',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '8px'
                    }}>
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* 2. Daily Goal Reached Notification (Kept within 24h) */}
          {isGoalReached && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              padding: '16px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#34D399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={16} color="#34D399" /> Daily Goal Achieved!
              </div>
              <div style={{ fontSize: '13px', color: '#E2E8F0', marginTop: '4px', lineHeight: '1.4' }}>
                🎉 Congratulations! You reached <strong>{currentSteps.toLocaleString()}</strong> / {dailyGoal.toLocaleString()} steps today!
              </div>
            </div>
          )}

          {/* 3. Evening Goal Warning Notification (after 8:00 PM and Goal Not Reached) */}
          {isEveningWarning && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '16px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#F87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} color="#F87171" /> Evening Reminder: Day End Nearing!
              </div>
              <div style={{ fontSize: '13px', color: '#E2E8F0', marginTop: '4px', lineHeight: '1.4' }}>
                ⏰ You are currently at <strong>{currentSteps.toLocaleString()}</strong> / {dailyGoal.toLocaleString()} steps. Walk <strong>{(dailyGoal - currentSteps).toLocaleString()}</strong> more steps before midnight to reach your daily goal!
              </div>
            </div>
          )}

          {/* Fallback if no notifications */}
          {!hasAnyNotification && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              <Sparkles size={32} color="#60A5FA" style={{ marginBottom: '8px' }} />
              <div>No active notifications right now. You are all caught up!</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
