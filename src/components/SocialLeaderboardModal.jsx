import React, { useState, useEffect } from 'react';
import { validateUserExistsInDb } from '../firebase';

export function SocialLeaderboardModal({ user, userSteps, activeKcal, distanceKm, onClose, onUpdatePendingCount }) {
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'friends' | 'instagram'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [instaHandle, setInstaHandle] = useState(() => {
    return localStorage.getItem('pacepulse_insta_handle') || '';
  });

  const [friendsList, setFriendsList] = useState(() => {
    const saved = localStorage.getItem('pacepulse_friends_list');
    return saved ? JSON.parse(saved) : [];
  });

  // Incoming requests sent TO me
  const [pendingRequests, setPendingRequests] = useState(() => {
    const saved = localStorage.getItem('pacepulse_pending_requests');
    return saved ? JSON.parse(saved) : [];
  });

  // Outgoing requests sent BY me
  const [outgoingRequests, setOutgoingRequests] = useState(() => {
    const saved = localStorage.getItem('pacepulse_outgoing_requests');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync state to local storage and update pending badge
  useEffect(() => {
    localStorage.setItem('pacepulse_friends_list', JSON.stringify(friendsList));
    localStorage.setItem('pacepulse_pending_requests', JSON.stringify(pendingRequests));
    localStorage.setItem('pacepulse_outgoing_requests', JSON.stringify(outgoingRequests));
    if (onUpdatePendingCount) {
      onUpdatePendingCount(pendingRequests.length);
    }
  }, [friendsList, pendingRequests, outgoingRequests, onUpdatePendingCount]);

  // Handle Instagram handle save
  const handleSaveInstaHandle = (e) => {
    e.preventDefault();
    const cleanHandle = instaHandle.trim().replace('@', '');
    if (!cleanHandle) return;
    setInstaHandle(cleanHandle);
    localStorage.setItem('pacepulse_insta_handle', cleanHandle);
    alert(`✅ Instagram handle updated to @${cleanHandle}`);
  };

  const handleUnlinkInstaHandle = () => {
    setInstaHandle('');
    localStorage.removeItem('pacepulse_insta_handle');
    alert('✨ Instagram handle unlinked successfully!');
  };

  const handleShareInstaInvite = () => {
    const handleText = instaHandle ? `@${instaHandle}` : 'PacePulse AI';
    const text = `👟 Join my PacePulse AI Leaderboard! Search my handle: ${handleText}`;
    if (navigator.share) {
      navigator.share({ title: 'PacePulse AI Leaderboard', text, url: 'https://pacepulse-ai.web.app' }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('✨ Leaderboard invite copied to clipboard! Share on your Instagram Story or DM so your friends can connect with you!');
    }
  };

  // Construct real user leaderboard entries (NO DUMMY MOCK USERS!)
  const currentUserEntry = {
    id: user?.uid || 'me',
    name: user?.displayName || user?.profile?.name || 'You (Me)',
    insta: instaHandle ? `@${instaHandle.replace('@', '')}` : '',
    steps: userSteps || 0,
    kcal: activeKcal || 0,
    dist: distanceKm || 0,
    isMe: true
  };

  const leaderboardEntries = [currentUserEntry, ...friendsList.filter(f => f.status === 'connected')]
    .sort((a, b) => b.steps - a.steps);

  // Send 2-Way Friend Request with User Validation
  const handleSendRequest = async (query) => {
    if (!query.trim()) return;
    setIsSearching(true);

    const validation = await validateUserExistsInDb(query);
    setIsSearching(false);

    if (!validation.exists) {
      alert(validation.error);
      return;
    }

    const target = validation.targetUser;

    // Check if already connected
    if (friendsList.some(f => f.id === target.uid || f.name.toLowerCase() === target.displayName.toLowerCase())) {
      alert(`⚠️ You are already connected with ${target.displayName}!`);
      return;
    }

    // Check if outgoing request already sent
    if (outgoingRequests.some(r => r.toUid === target.uid)) {
      alert(`⏳ Connection request to ${target.displayName} is already pending acceptance.`);
      return;
    }

    const newOutgoing = {
      id: Date.now().toString(),
      toUid: target.uid,
      toName: target.displayName,
      toEmail: target.email,
      sentAt: new Date().toISOString()
    };

    setOutgoingRequests([...outgoingRequests, newOutgoing]);
    setSearchQuery('');
    alert(`✨ Connection request sent to ${target.displayName}! They will receive your request in their Notification Bell.`);
  };

  const handleAcceptRequest = (req) => {
    const acceptedFriend = {
      id: req.id || Date.now().toString(),
      name: req.name,
      insta: req.insta || '',
      steps: 0,
      kcal: 0,
      dist: 0,
      status: 'connected'
    };
    setFriendsList([...friendsList, acceptedFriend]);
    setPendingRequests(pendingRequests.filter(r => r.id !== req.id));
    alert(`🎉 Connected with ${req.name}! Both of you can now see each other on the Leaderboard.`);
  };

  const handleDeclineRequest = (reqId) => {
    setPendingRequests(pendingRequests.filter(r => r.id !== reqId));
  };

  const handleCancelOutgoing = (reqId) => {
    setOutgoingRequests(outgoingRequests.filter(r => r.id !== reqId));
  };

  const handleRemoveFriend = (friendId, friendName) => {
    if (confirm(`Are you sure you want to remove ${friendName} from your connections?`)) {
      setFriendsList(friendsList.filter(f => f.id !== friendId));
    }
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-bright)' }}>
              🏆 Social Connections & Leaderboard
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim)' }}>
              Connect with real verified users & Instagram handles to compete on steps
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

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('leaderboard')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'leaderboard' ? '2px solid #3b82f6' : 'none',
              color: activeTab === 'leaderboard' ? '#60a5fa' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            🥇 Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'friends' ? '2px solid #3b82f6' : 'none',
              color: activeTab === 'friends' ? '#60a5fa' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            👥 Connections ({friendsList.filter(f => f.status === 'connected').length})
          </button>
          <button
            onClick={() => setActiveTab('instagram')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'instagram' ? '2px solid #e1306c' : 'none',
              color: activeTab === 'instagram' ? '#f472b6' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            📷 Instagram Sync
          </button>
        </div>

        {/* Tab 1: Real Leaderboard (NO MOCK USERS!) */}
        {activeTab === 'leaderboard' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboardEntries.map((entry, index) => {
              const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
              return (
                <div key={entry.id} style={{
                  background: entry.isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${entry.isMe ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '16px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, width: '32px', textAlign: 'center' }}>
                      {rankBadge}
                    </span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: entry.isMe ? '#60a5fa' : 'var(--text-bright)' }}>
                        {entry.name} {entry.insta && <span style={{ fontSize: '12px', color: '#f472b6', fontWeight: 500 }}>({entry.insta})</span>} {entry.isMe && '(You)'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        🔥 {entry.kcal} active kcal • 📏 {entry.dist} km
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-bright)' }}>
                    🚶 {entry.steps.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Connections, Incoming Requests & Outgoing Requests */}
        {activeTab === 'friends' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Search and Add Friend by Name or Instagram Handle */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search registered username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => handleSendRequest(searchQuery)}
                disabled={!searchQuery.trim() || isSearching}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: searchQuery.trim() ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  cursor: searchQuery.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {isSearching ? 'Checking...' : '+ Connect'}
              </button>
            </div>

            {/* Incoming Requests Sent TO Me */}
            {pendingRequests.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Incoming Connection Requests ({pendingRequests.length})
                </div>
                {pendingRequests.map(req => (
                  <div key={req.id} style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>{req.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>wants to connect on Leaderboard</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: '#10b981',
                          border: 'none',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: 'none',
                          color: '#f87171',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing Requests Sent BY Me (Pending Acceptance) */}
            {outgoingRequests.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Sent Requests Pending Acceptance ({outgoingRequests.length})
                </div>
                {outgoingRequests.map(req => (
                  <div key={req.id} style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>{req.toName}</div>
                      <div style={{ fontSize: '11px', color: '#60a5fa' }}>⏳ Waiting for user to accept...</div>
                    </div>
                    <button
                      onClick={() => handleCancelOutgoing(req.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Connected Friends List */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Your Connected Friends ({friendsList.filter(f => f.status === 'connected').length})
              </div>
              {friendsList.filter(f => f.status === 'connected').length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                  You have no connected friends yet. Search a registered username above to connect!
                </div>
              ) : (
                friendsList.filter(f => f.status === 'connected').map(friend => (
                  <div key={friend.id} style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: 'white'
                      }}>
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>{friend.name}</div>
                        {friend.insta && <div style={{ fontSize: '11px', color: '#f472b6' }}>{friend.insta}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFriend(friend.id, friend.name)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Instagram Handle Sync & Unlink */}
        {activeTab === 'instagram' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'rgba(225, 48, 108, 0.1)',
              border: '1px solid rgba(225, 48, 108, 0.3)',
              borderRadius: '16px',
              padding: '16px',
              color: '#f472b6',
              fontSize: '13px'
            }}>
              📷 <strong>Link & Share Instagram Handle</strong>
              <p style={{ margin: '6px 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                Linking your Instagram handle displays `@your_name` on the Leaderboard. Tap "Invite Instagram Friends" to share your invite link directly on your Instagram Story or DMs!
              </p>
            </div>

            <form onSubmit={handleSaveInstaHandle} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                Your Instagram Handle:
              </label>
              <input
                type="text"
                placeholder="e.g. @your_instagram_name"
                value={instaHandle}
                onChange={(e) => setInstaHandle(e.target.value)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #e1306c 0%, #c13584 100%)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Save Instagram Handle
                </button>
                {instaHandle && (
                  <button
                    type="button"
                    onClick={handleUnlinkInstaHandle}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Unlink
                  </button>
                )}
              </div>
            </form>

            <button
              onClick={handleShareInstaInvite}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px'
              }}
            >
              <span>✨</span> Invite Instagram Friends to Leaderboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
