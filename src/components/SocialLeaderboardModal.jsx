import React, { useState, useEffect } from 'react';
import { 
  validateUserExistsInDb, 
  sendFriendRequestInDb, 
  getPendingRequestsFromDb, 
  getOutgoingRequestsFromDb, 
  acceptFriendRequestInDb, 
  declineFriendRequestInDb, 
  cancelOutgoingRequestInDb, 
  getLocalFriendsList,
  getFriendsListFromDb, 
  removeFriendInDb,
  getTodayStepsForFriends
} from '../firebase';

export function SocialLeaderboardModal({ 
  currentUser, 
  currentProfile, 
  currentSteps = 0, 
  initialTab = 'leaderboard', 
  onClose, 
  onUpdatePendingCount 
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'leaderboard'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [instaHandle, setInstaHandle] = useState(() => {
    return localStorage.getItem('pacepulse_insta_handle') || '';
  });

  const myUid = currentUser?.uid || 'guest';

  // Connected Friends List for Current Active User (Synchronous init)
  const [friendsList, setFriendsList] = useState(() => {
    return getLocalFriendsList(myUid);
  });

  const [friendsWithLiveSteps, setFriendsWithLiveSteps] = useState([]);

  // Incoming Requests sent TO Current Active User
  const [pendingRequests, setPendingRequests] = useState([]);

  // Outgoing Requests sent BY Current Active User
  const [outgoingRequests, setOutgoingRequests] = useState(() => {
    return getOutgoingRequestsFromDb(myUid);
  });

  // Fetch fresh pending requests & friend steps from Cloud Firestore
  useEffect(() => {
    if (!myUid || myUid === 'guest') return;

    getPendingRequestsFromDb(myUid).then(reqs => {
      setPendingRequests(reqs);
      if (onUpdatePendingCount) {
        onUpdatePendingCount(reqs.length);
      }
    });

    setOutgoingRequests(getOutgoingRequestsFromDb(myUid));

    Promise.resolve(getFriendsListFromDb(myUid)).then(baseFriends => {
      const list = Array.isArray(baseFriends) ? baseFriends : [];
      setFriendsList(list);
      const todayStr = new Date().toISOString().split('T')[0];
      getTodayStepsForFriends(list, todayStr).then(liveFriends => {
        setFriendsWithLiveSteps(liveFriends);
      });
    });
  }, [myUid, onUpdatePendingCount]);

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
    const userTag = currentUser?.username || `@${(currentUser?.email || 'user').split('@')[0]}`;
    const text = `👟 Join my PacePulse AI Leaderboard! Add my unique user ID: ${userTag}`;
    if (navigator.share) {
      navigator.share({ title: 'PacePulse AI Leaderboard', text, url: 'https://pacepulse-ai.web.app' }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('✨ Leaderboard invite copied to clipboard! Share on your Instagram Story or DM so your friends can connect with you!');
    }
  };

  // Construct real user leaderboard entries (NO DUMMY MOCK USERS!)
  const currentUserEntry = {
    id: myUid,
    name: currentUser?.displayName || currentUser?.profile?.name || currentProfile?.name || 'You (Me)',
    insta: instaHandle ? `@${instaHandle.replace('@', '')}` : '',
    steps: currentSteps || 0,
    kcal: Math.round(currentSteps * 0.04),
    dist: Math.round((currentSteps * 0.72) / 10) / 100,
    isMe: true
  };

  const connectedFriends = (friendsWithLiveSteps.length > 0 ? friendsWithLiveSteps : friendsList)
    .filter(f => f && (f.status === 'connected' || f.id));

  const leaderboardEntries = [currentUserEntry, ...connectedFriends]
    .sort((a, b) => (b.steps || 0) - (a.steps || 0));

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

    // Check if sending to yourself
    if (target.uid === myUid || target.email.toLowerCase() === (currentUser?.email || '').toLowerCase()) {
      alert("⚠️ You cannot send a connection request to yourself!");
      return;
    }

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

    const newOutgoing = await sendFriendRequestInDb(currentUser || { uid: myUid, displayName: 'Me', email: 'me@app.com' }, target);
    setOutgoingRequests([...outgoingRequests, newOutgoing]);
    setSearchQuery('');
    alert(`✨ Connection request sent to ${target.displayName} (${target.username})! They will receive your request in their notification bell.`);
  };

  const handleCancelOutgoing = (reqId) => {
    const updatedOut = cancelOutgoingRequestInDb(myUid, reqId);
    setOutgoingRequests(updatedOut);
  };

  const handleRemoveFriend = (friendId, friendName) => {
    if (window.confirm(`Are you sure you want to remove ${friendName} from your active connections?`)) {
      const updatedFriends = removeFriendInDb(myUid, friendId);
      setFriendsList(updatedFriends);
      alert(`✨ Removed ${friendName} from your connections.`);
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
              Connect with real verified users via Unique ID (@tag) to compete on steps
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
            👥 Connections ({connectedFriends.length})
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
            📷 Instagram
          </button>
        </div>

        {/* Tab 1: Real Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboardEntries.map((entry, index) => {
              const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
              return (
                <div key={entry.id || index} style={{
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
                        🔥 {(entry.kcal || 0)} active kcal • 📏 {(entry.dist || 0)} km
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-bright)' }}>
                    🚶 {(entry.steps || 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Connections & Outgoing Requests */}
        {activeTab === 'friends' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Incoming Requests Received FROM Other Users */}
            {pendingRequests.length > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '16px',
                padding: '14px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', marginBottom: '10px' }}>
                  🔔 Connection Requests Received ({pendingRequests.length})
                </div>
                {pendingRequests.map(req => (
                  <div key={req.id} style={{
                    background: 'rgba(10, 15, 26, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>{req.name}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{req.username || req.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          await acceptFriendRequestInDb(currentUser || { uid: myUid }, req);
                          setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                          Promise.resolve(getFriendsListFromDb(myUid)).then(setFriendsList);
                          if (onUpdatePendingCount) onUpdatePendingCount();
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          border: 'none',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={async () => {
                          await declineFriendRequestInDb(myUid, req.id);
                          setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                          if (onUpdatePendingCount) onUpdatePendingCount();
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#EF4444',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search and Add Friend by Unique Tag (@username) or Email */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder={`Search by Unique Tag (e.g. ${currentUser?.username || `@${(currentUser?.email || 'user').split('@')[0]}`}) or Email...`}
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
                      Cancel Request
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active Connections List with Remove Option */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Your Active Connections ({connectedFriends.length})
              </div>
              {connectedFriends.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                  You have no connected friends yet. Search a unique user ID (@tag) above to send a request!
                </div>
              ) : (
                connectedFriends.map(friend => (
                  <div key={friend.id} style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00F2FE 0%, #8B5CF6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: '#040914',
                        fontSize: '16px'
                      }}>
                        {(friend.name || 'F').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>{friend.name}</div>
                        <div style={{ fontSize: '11px', color: '#00F2FE', fontWeight: '600' }}>
                          {friend.username || `@${(friend.email || 'user').split('@')[0]}`} • <span style={{ color: '#10B981' }}>🟢 Connected</span>
                        </div>
                      </div>
                    </div>
                    {/* Remove Connection Button */}
                    <button
                      onClick={() => handleRemoveFriend(friend.id, friend.name)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#F87171',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Remove Connection"
                    >
                      🗑️ Remove
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
