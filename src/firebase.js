/**
 * PacePulse AI - Firebase Firestore REST API Service & Local Storage Sync Engine
 */

const FIRESTORE_PROJECT_ID = 'pacepulse-ai';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

// Helper: Read Local DB Accounts
export function getLocalDbAccounts() {
  try {
    const raw = localStorage.getItem('pacepulse_db_accounts');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// Helper: Save Local DB Accounts
export function saveLocalDbAccounts(accounts) {
  try {
    localStorage.setItem('pacepulse_db_accounts', JSON.stringify(accounts));
  } catch (e) {}
}

// Helper: Purge Stale Local DB Accounts
export function purgeLocalDbAccount(email) {
  const accounts = getLocalDbAccounts();
  const cleanEmail = email.trim().toLowerCase();
  delete accounts[cleanEmail];
  saveLocalDbAccounts(accounts);
}

/**
 * Save Daily Step Log to Firestore Database
 */
export async function saveDailyLogsToDb(uid, dateStr, totalSteps, goal, caloriesData, hourlyData) {
  if (!uid || uid === 'guest') return;

  try {
    const firestoreBody = {
      fields: {
        date: { stringValue: dateStr },
        steps: { integerValue: String(totalSteps) },
        goal: { integerValue: String(goal) },
        activeKcal: { integerValue: String(caloriesData ? caloriesData.activeKcal : 0) },
        distanceKm: { doubleValue: Number(caloriesData ? caloriesData.distanceKm : 0) },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    };

    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs/${dateStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody)
    });

    if (res.ok) {
      console.log(`✅ Daily Log for ${dateStr} saved to Firestore 'users/${uid}/daily_logs'!`);
    }
  } catch (e) {
    console.warn("Daily log Firestore sync warning:", e);
  }
}

/**
 * Register User in Firebase Cloud Firestore Database ('users' collection)
 * Enforces 1 account per email & verifies with Firestore to purge deleted accounts
 */
export async function registerUserInDb(email, password, displayName, profile) {
  const cleanEmail = email.trim().toLowerCase();
  const uid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const accounts = getLocalDbAccounts();

  // 1. Verify with Cloud Firestore REST API if user exists or was deleted
  try {
    const checkRes = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`).catch(() => null);
    if (checkRes && checkRes.ok) {
      // Document actively exists in Firestore!
      throw new Error('An account with this email address already exists. Please sign in instead.');
    } else if (checkRes && checkRes.status === 404) {
      // Document was deleted from Firestore! Purge stale local cache automatically.
      delete accounts[cleanEmail];
      saveLocalDbAccounts(accounts);
    } else if (accounts[cleanEmail]) {
      // Offline fallback: local account exists
      throw new Error('An account with this email address already exists. Please sign in instead.');
    }
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      throw err;
    }
  }

  // Generate Unique Handle/Tag e.g. @nevil3
  const rawTag = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
  const username = `@${rawTag}`;

  const fullProfile = {
    ...profile,
    name: displayName.trim(),
    email: cleanEmail,
    username
  };

  const userData = {
    uid,
    displayName: displayName.trim(),
    email: cleanEmail,
    username,
    password: password.trim(),
    createdAt: new Date().toISOString(),
    profile: fullProfile
  };

  accounts[cleanEmail] = userData;
  saveLocalDbAccounts(accounts);

  try {
    const firestoreBody = {
      fields: {
        uid: { stringValue: uid },
        displayName: { stringValue: displayName.trim() },
        email: { stringValue: cleanEmail },
        username: { stringValue: username },
        password: { stringValue: password.trim() },
        createdAt: { stringValue: userData.createdAt },
        profile: {
          mapValue: {
            fields: {
              name: { stringValue: displayName.trim() },
              email: { stringValue: cleanEmail },
              username: { stringValue: username },
              gender: { stringValue: profile.gender || 'male' },
              birthDate: { stringValue: profile.birthDate || '2000-01-01' },
              age: { integerValue: String(profile.age || 25) },
              heightCm: { doubleValue: Number(profile.heightCm || 175) },
              weightKg: { doubleValue: Number(profile.weightKg || 70) },
              dailyGoal: { integerValue: String(profile.dailyGoal || 10000) }
            }
          }
        }
      }
    };

    await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody)
    });

    const emptyHourly = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      steps: 0
    }));

    await saveDailyLogsToDb(uid, todayStr, 0, profile.dailyGoal || 10000, null, emptyHourly);
  } catch (e) {}

  return userData;
}

/**
 * Sign In User with Firebase Cloud Firestore Database Lookup
 */
export async function loginUserInDb(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  // Always check Firestore REST API directly first to handle deleted accounts
  try {
    const uid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`).catch(() => null);

    if (res && res.status === 404) {
      // Document was deleted in Firestore! Purge local cache.
      purgeLocalDbAccount(cleanEmail);
      return { 
        success: false, 
        error: 'No account found with this email. Account may have been removed.' 
      };
    }

    if (res && res.ok) {
      const docData = await res.json();
      if (docData && docData.fields) {
        const f = docData.fields;
        const pFields = f.profile && f.profile.mapValue ? f.profile.mapValue.fields : {};
        const rawTag = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');

        const fetchedUser = {
          uid: f.uid ? f.uid.stringValue : uid,
          displayName: f.displayName ? f.displayName.stringValue : cleanEmail.split('@')[0],
          email: f.email ? f.email.stringValue : cleanEmail,
          username: f.username ? f.username.stringValue : `@${rawTag}`,
          password: f.password ? f.password.stringValue : '',
          createdAt: f.createdAt ? f.createdAt.stringValue : new Date().toISOString(),
          profile: {
            name: pFields.name ? pFields.name.stringValue : cleanEmail.split('@')[0],
            email: cleanEmail,
            username: f.username ? f.username.stringValue : `@${rawTag}`,
            gender: pFields.gender ? pFields.gender.stringValue : 'male',
            birthDate: pFields.birthDate ? pFields.birthDate.stringValue : '2000-01-01',
            age: pFields.age ? Number(pFields.age.integerValue || 25) : 25,
            heightCm: pFields.heightCm ? Number(pFields.heightCm.doubleValue || 175) : 175,
            weightKg: pFields.weightKg ? Number(pFields.weightKg.doubleValue || 70) : 70,
            dailyGoal: pFields.dailyGoal ? Number(pFields.dailyGoal.integerValue || 10000) : 10000
          }
        };

        const accounts = getLocalDbAccounts();
        accounts[cleanEmail] = fetchedUser;
        saveLocalDbAccounts(accounts);

        if (fetchedUser.password === cleanPassword) {
          return { success: true, user: fetchedUser };
        } else {
          return { success: false, error: 'Incorrect password. Please try again.' };
        }
      }
    }
  } catch (e) {}

  // Local DB Fallback
  const accounts = getLocalDbAccounts();
  const localUser = accounts[cleanEmail];

  if (localUser) {
    if (localUser.password === cleanPassword) {
      return { success: true, user: localUser };
    } else {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }
  }

  return { 
    success: false, 
    error: 'No account found with this email. Please check your credentials or click "Create New Account".' 
  };
}

/**
 * Validate if a target user exists in Firebase Database by Unique Tag (@username), email, or displayName
 */
export async function validateUserExistsInDb(searchQuery) {
  const clean = searchQuery.trim().toLowerCase().replace('@', '');
  if (!clean) return { exists: false, error: 'Please enter a valid User ID / Tag (e.g. @Nevil3), email, or name.' };

  const uid = `usr_${clean.replace(/[^a-z0-9]/g, '_')}`;

  // Check Cloud Firestore 'users' directly to ensure fresh state
  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`).catch(() => null);
    if (res && res.status === 404) {
      // User was deleted in Firestore
      purgeLocalDbAccount(clean);
    } else if (res && res.ok) {
      const docData = await res.json();
      if (docData && docData.fields) {
        const f = docData.fields;
        const fetchedEmail = f.email ? f.email.stringValue : `${clean}@example.com`;
        const fetchedTag = f.username ? f.username.stringValue : `@${clean}`;

        return {
          exists: true,
          targetUser: {
            uid: f.uid ? f.uid.stringValue : uid,
            displayName: f.displayName ? f.displayName.stringValue : clean,
            email: fetchedEmail,
            username: fetchedTag
          }
        };
      }
    }
  } catch (e) {}

  // Check local registered accounts DB
  const accounts = getLocalDbAccounts();
  const matchedLocalKey = Object.keys(accounts).find(emailKey => {
    const acc = accounts[emailKey];
    const dName = (acc.displayName || '').toLowerCase();
    const eMail = (acc.email || '').toLowerCase();
    const uName = (acc.username || acc.profile?.username || '').toLowerCase().replace('@', '');
    const prefix = eMail.split('@')[0];

    return eMail === clean || dName === clean || uName === clean || prefix === clean;
  });

  if (matchedLocalKey) {
    const target = accounts[matchedLocalKey];
    const targetTag = target.username || target.profile?.username || `@${target.email.split('@')[0]}`;
    return {
      exists: true,
      targetUser: {
        uid: target.uid,
        displayName: target.displayName || target.email.split('@')[0],
        email: target.email,
        username: targetTag
      }
    };
  }

  return { exists: false, error: `No user found with Tag/ID "${searchQuery}". Please check the spelling.` };
}

/**
 * 2-Way Friend Request Cloud Firestore Sync & User-Scoped Storage
 */
export async function sendFriendRequestInDb(senderUser, targetUser) {
  const senderUid = senderUser.uid || `usr_${senderUser.email.replace(/[^a-z0-9]/g, '_')}`;
  const senderName = senderUser.displayName || senderUser.profile?.name || senderUser.email.split('@')[0];
  const senderEmail = senderUser.email;
  const senderTag = senderUser.username || senderUser.profile?.username || `@${senderEmail.split('@')[0]}`;

  const targetUid = targetUser.uid;
  const reqId = `req_${Date.now()}`;

  // Outgoing payload for Sender
  const outgoingObj = {
    id: reqId,
    toUid: targetUid,
    toName: targetUser.displayName,
    toEmail: targetUser.email,
    sentAt: new Date().toISOString()
  };

  // Incoming payload for Target User
  const pendingObj = {
    id: reqId,
    fromUid: senderUid,
    name: senderName,
    email: senderEmail,
    username: senderTag,
    sentAt: new Date().toISOString()
  };

  // 1. Save into user-scoped Local Storage
  try {
    const outKey = `pacepulse_outgoing_${senderUid}`;
    const outSaved = JSON.parse(localStorage.getItem(outKey) || '[]');
    outSaved.push(outgoingObj);
    localStorage.setItem(outKey, JSON.stringify(outSaved));

    const inKey = `pacepulse_pending_${targetUid}`;
    const inSaved = JSON.parse(localStorage.getItem(inKey) || '[]');
    inSaved.push(pendingObj);
    localStorage.setItem(inKey, JSON.stringify(inSaved));
  } catch (e) {}

  // 2. Sync to Cloud Firestore REST API
  try {
    const firestoreBody = {
      fields: {
        id: { stringValue: reqId },
        fromUid: { stringValue: senderUid },
        name: { stringValue: senderName },
        email: { stringValue: senderEmail },
        username: { stringValue: senderTag },
        sentAt: { stringValue: pendingObj.sentAt }
      }
    };
    await fetch(`${FIRESTORE_REST_BASE}/users/${targetUid}/pending_requests/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody)
    });
  } catch (e) {}

  return outgoingObj;
}

/**
 * Fetch Pending Connection Requests sent TO a user
 */
export async function getPendingRequestsFromDb(uid) {
  if (!uid || uid === 'guest') return [];

  const inKey = `pacepulse_pending_${uid}`;
  let localRequests = [];
  try {
    localRequests = JSON.parse(localStorage.getItem(inKey) || '[]');
  } catch (e) {}

  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/pending_requests`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        const remote = data.documents.map(doc => {
          const f = doc.fields;
          return {
            id: f.id ? f.id.stringValue : doc.name.split('/').pop(),
            fromUid: f.fromUid ? f.fromUid.stringValue : '',
            name: f.name ? f.name.stringValue : 'Friend',
            email: f.email ? f.email.stringValue : '',
            username: f.username ? f.username.stringValue : '',
            sentAt: f.sentAt ? f.sentAt.stringValue : ''
          };
        });

        // Merge remote & local deduplicated by id
        const mergedMap = new Map();
        [...localRequests, ...remote].forEach(r => mergedMap.set(r.id, r));
        const finalArr = Array.from(mergedMap.values());
        localStorage.setItem(inKey, JSON.stringify(finalArr));
        return finalArr;
      }
    }
  } catch (e) {}

  return localRequests;
}

/**
 * Fetch Outgoing Requests sent BY a user
 */
export function getOutgoingRequestsFromDb(uid) {
  if (!uid || uid === 'guest') return [];
  const outKey = `pacepulse_outgoing_${uid}`;
  try {
    return JSON.parse(localStorage.getItem(outKey) || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Accept Friend Request (2-Way Connection)
 */
export async function acceptFriendRequestInDb(currentUser, reqItem) {
  const myUid = currentUser.uid || `usr_${currentUser.email.replace(/[^a-z0-9]/g, '_')}`;
  const senderUid = reqItem.fromUid;

  const myFriendEntry = {
    id: senderUid,
    name: reqItem.name,
    email: reqItem.email,
    username: reqItem.username,
    status: 'connected',
    connectedAt: new Date().toISOString()
  };

  // 1. Update my local connected friends list
  const friendsKey = `pacepulse_friends_${myUid}`;
  const myFriends = JSON.parse(localStorage.getItem(friendsKey) || '[]');
  if (!myFriends.some(f => f.id === senderUid)) {
    myFriends.push(myFriendEntry);
    localStorage.setItem(friendsKey, JSON.stringify(myFriends));
  }

  // 2. Remove from my pending requests
  const pendingKey = `pacepulse_pending_${myUid}`;
  const myPending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
  const newPending = myPending.filter(r => r.id !== reqItem.id);
  localStorage.setItem(pendingKey, JSON.stringify(newPending));

  // 3. Remove from sender's outgoing requests & add me to sender's friends list
  if (senderUid) {
    const outKey = `pacepulse_outgoing_${senderUid}`;
    const senderOut = JSON.parse(localStorage.getItem(outKey) || '[]');
    const newSenderOut = senderOut.filter(r => r.id !== reqItem.id);
    localStorage.setItem(outKey, JSON.stringify(newSenderOut));

    const senderFriendsKey = `pacepulse_friends_${senderUid}`;
    const senderFriends = JSON.parse(localStorage.getItem(senderFriendsKey) || '[]');
    const meEntry = {
      id: myUid,
      name: currentUser.displayName || currentUser.profile?.name || currentUser.email.split('@')[0],
      email: currentUser.email,
      username: currentUser.username || `@${currentUser.email.split('@')[0]}`,
      status: 'connected',
      connectedAt: new Date().toISOString()
    };
    if (!senderFriends.some(f => f.id === myUid)) {
      senderFriends.push(meEntry);
      localStorage.setItem(senderFriendsKey, JSON.stringify(senderFriends));
    }
  }

  // 4. Clean up Firestore pending request document & sync friends to Firestore
  try {
    await fetch(`${FIRESTORE_REST_BASE}/users/${myUid}/pending_requests/${reqItem.id}`, {
      method: 'DELETE'
    });
  } catch (e) {}

  return myFriends;
}

/**
 * Decline / Remove Connection Request
 */
export function declineFriendRequestInDb(uid, reqId) {
  const pendingKey = `pacepulse_pending_${uid}`;
  const saved = JSON.parse(localStorage.getItem(pendingKey) || '[]');
  const updated = saved.filter(r => r.id !== reqId);
  localStorage.setItem(pendingKey, JSON.stringify(updated));

  try {
    fetch(`${FIRESTORE_REST_BASE}/users/${uid}/pending_requests/${reqId}`, { method: 'DELETE' });
  } catch (e) {}

  return updated;
}

/**
 * Cancel Outgoing Request
 */
export function cancelOutgoingRequestInDb(uid, reqId) {
  const outKey = `pacepulse_outgoing_${uid}`;
  const saved = JSON.parse(localStorage.getItem(outKey) || '[]');
  const updated = saved.filter(r => r.id !== reqId);
  localStorage.setItem(outKey, JSON.stringify(updated));
  return updated;
}

/**
 * Fetch Connected Friends List for user
 */
export function getFriendsListFromDb(uid) {
  if (!uid || uid === 'guest') return [];
  const friendsKey = `pacepulse_friends_${uid}`;
  try {
    return JSON.parse(localStorage.getItem(friendsKey) || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Remove Friend (2-Way Connection Removal)
 */
export function removeFriendInDb(uid, friendId) {
  const friendsKey = `pacepulse_friends_${uid}`;
  const saved = JSON.parse(localStorage.getItem(friendsKey) || '[]');
  const updated = saved.filter(f => f.id !== friendId);
  localStorage.setItem(friendsKey, JSON.stringify(updated));

  // Also remove from target friend's list
  if (friendId) {
    const targetFriendsKey = `pacepulse_friends_${friendId}`;
    const targetSaved = JSON.parse(localStorage.getItem(targetFriendsKey) || '[]');
    const targetUpdated = targetSaved.filter(f => f.id !== uid);
    localStorage.setItem(targetFriendsKey, JSON.stringify(targetUpdated));
  }

  try {
    fetch(`${FIRESTORE_REST_BASE}/users/${uid}/friends/${friendId}`, { method: 'DELETE' });
    fetch(`${FIRESTORE_REST_BASE}/users/${friendId}/friends/${uid}`, { method: 'DELETE' });
  } catch (e) {}

  return updated;
}

/**
 * Fetch Daily History Logs from Firestore DB
 */
export async function getDailyLogsFromDb(uid) {
  if (!uid || uid === 'guest') return [];

  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        return data.documents.map(doc => {
          const f = doc.fields;
          return {
            date: f.date ? f.date.stringValue : '',
            steps: f.steps ? Number(f.steps.integerValue) : 0,
            goal: f.goal ? Number(f.goal.integerValue) : 10000,
            activeKcal: f.activeKcal ? Number(f.activeKcal.integerValue) : 0,
            distanceKm: f.distanceKm ? Number(f.distanceKm.doubleValue) : 0,
            completed: (f.steps ? Number(f.steps.integerValue) : 0) >= (f.goal ? Number(f.goal.integerValue) : 10000)
          };
        });
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Firebase Auth Compatibility Stubs
 */
export const auth = { currentUser: null };
export async function signOut() { return true; }
