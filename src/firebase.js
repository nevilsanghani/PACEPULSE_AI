/**
 * PacePulse AI - Pure Firebase Cloud Firestore Database Auth Service
 */

const FIRESTORE_PROJECT_ID = 'pacepulse-ai';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Local Account Cache Purge Helper
 */
export function getLocalDbAccounts() {
  try {
    return JSON.parse(localStorage.getItem('pacepulse_accounts') || '{}');
  } catch (e) {
    return {};
  }
}

export function saveLocalDbAccounts(accounts) {
  try {
    localStorage.setItem('pacepulse_accounts', JSON.stringify(accounts));
  } catch (e) {}
}

export function purgeLocalDbAccount(email) {
  try {
    const accounts = getLocalDbAccounts();
    delete accounts[email.trim().toLowerCase()];
    saveLocalDbAccounts(accounts);
  } catch (e) {}
}

/**
 * Save Daily Step Log to Firestore Database (Includes 24 Hourly Buckets!)
 */
export async function saveDailyLogsToDb(uid, dateStr, totalSteps, goal, caloriesData, hourlyData) {
  if (!uid || uid === 'guest') return;

  try {
    const hourlyValues = (hourlyData || []).map(h => ({
      mapValue: {
        fields: {
          hour: { integerValue: String(h.hour || 0) },
          label: { stringValue: h.label || `${String(h.hour || 0).padStart(2, '0')}:00` },
          steps: { integerValue: String(h.steps || 0) }
        }
      }
    }));

    const firestoreBody = {
      fields: {
        date: { stringValue: dateStr },
        steps: { integerValue: String(totalSteps) },
        goal: { integerValue: String(goal) },
        activeKcal: { integerValue: String(caloriesData ? caloriesData.activeKcal : 0) },
        distanceKm: { doubleValue: Number(caloriesData ? caloriesData.distanceKm : 0) },
        updatedAt: { stringValue: new Date().toISOString() },
        hourly: {
          arrayValue: {
            values: hourlyValues
          }
        }
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs/${dateStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      console.log(`✅ Daily Log for ${dateStr} saved to Firestore 'users/${uid}/daily_logs'!`);
    }
  } catch (e) {}
}

/**
 * Register User EXCLUSIVELY in Firebase Cloud Firestore Database ('users' collection)
 */
export async function registerUserInDb(email, password, displayName, profile) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  const uid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Always check Cloud Firestore Database first for existing email
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const checkRes = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (checkRes && checkRes.ok) {
      throw new Error('An account with this email address already exists in the Cloud Database. Please sign in instead.');
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
    password: cleanPassword,
    createdAt: new Date().toISOString(),
    profile: fullProfile
  };

  // 2. Direct Cloud Firestore User Document Creation
  const firestoreBody = {
    fields: {
      uid: { stringValue: uid },
      displayName: { stringValue: displayName.trim() },
      email: { stringValue: cleanEmail },
      username: { stringValue: username },
      password: { stringValue: cleanPassword },
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const createRes = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firestoreBody),
    signal: controller.signal
  }).catch(() => null);

  clearTimeout(timeoutId);

  if (!createRes || !createRes.ok) {
    throw new Error('Cloud Database registration failed. Please check your internet connection and try again.');
  }

  // Cache locally for offline convenience
  const localAccounts = getLocalDbAccounts();
  localAccounts[cleanEmail] = userData;
  saveLocalDbAccounts(localAccounts);

  const emptyHourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, '0')}:00`,
    steps: 0
  }));

  await saveDailyLogsToDb(uid, todayStr, 0, profile.dailyGoal || 10000, null, emptyHourly);

  return userData;
}

/**
 * Sign In User EXCLUSIVELY with Cloud Firestore Database Lookup
 */
export async function loginUserInDb(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  const uid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  // Direct Cloud Firestore Database Lookup
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    // If 404: Account DOES NOT EXIST in Database! Purge local storage cache.
    if (res && res.status === 404) {
      purgeLocalDbAccount(cleanEmail);
      return { 
        success: false, 
        error: 'No account found with this email in Cloud Database. Account may have been removed or does not exist.' 
      };
    }

    if (res && res.ok) {
      const docData = await res.json();
      if (docData && docData.fields) {
        const f = docData.fields;
        const pFields = f.profile && f.profile.mapValue ? f.profile.mapValue.fields : {};
        const rawTag = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');

        const dbPassword = f.password ? f.password.stringValue : '';

        if (dbPassword && dbPassword !== cleanPassword) {
          return { success: false, error: 'Incorrect password. Please try again.' };
        }

        const fetchedUser = {
          uid: f.uid ? f.uid.stringValue : uid,
          displayName: f.displayName ? f.displayName.stringValue : cleanEmail.split('@')[0],
          email: f.email ? f.email.stringValue : cleanEmail,
          username: f.username ? f.username.stringValue : `@${rawTag}`,
          password: dbPassword,
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

        // Sync fresh database user to local storage
        const localAccounts = getLocalDbAccounts();
        localAccounts[cleanEmail] = fetchedUser;
        saveLocalDbAccounts(localAccounts);

        return { success: true, user: fetchedUser };
      }
    }
  } catch (e) {
    return { success: false, error: 'Database network error. Please check your internet connection and try again.' };
  }

  return { 
    success: false, 
    error: 'No account found with this email in Cloud Database. Please click "Create New Account" to register.' 
  };
}

/**
 * Validate if a target user exists in Firebase Database
 */
export async function validateUserExistsInDb(searchQuery) {
  const clean = searchQuery.trim().toLowerCase().replace('@', '');
  if (!clean) return { exists: false, error: 'Please enter a valid User ID / Tag (e.g. @Nevil3), email, or name.' };

  const uid = `usr_${clean.replace(/[^a-z0-9]/g, '_')}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (res && res.ok) {
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

  return { exists: false, error: `No user found with Tag/ID "${searchQuery}" in Cloud Database. Please check the spelling.` };
}

/**
 * 2-Way Friend Request Cloud Firestore Sync
 */
export async function sendFriendRequestInDb(senderUser, targetUser) {
  const senderUid = senderUser.uid || `usr_${senderUser.email.replace(/[^a-z0-9]/g, '_')}`;
  const senderName = senderUser.displayName || senderUser.profile?.name || senderUser.email.split('@')[0];
  const senderEmail = senderUser.email;
  const senderTag = senderUser.username || senderUser.profile?.username || `@${senderEmail.split('@')[0]}`;

  const targetUid = targetUser.uid;
  const reqId = `req_${Date.now()}`;

  const outgoingObj = {
    id: reqId,
    toUid: targetUid,
    toName: targetUser.displayName,
    toEmail: targetUser.email,
    sentAt: new Date().toISOString()
  };

  const pendingObj = {
    id: reqId,
    fromUid: senderUid,
    name: senderName,
    email: senderEmail,
    username: senderTag,
    sentAt: new Date().toISOString()
  };

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

  try {
    const firestoreBody = {
      fields: {
        id: { stringValue: reqId },
        fromUid: { stringValue: senderUid },
        name: { stringValue: senderName },
        email: { stringValue: senderEmail },
        username: { stringValue: senderTag },
        sentAt: { stringValue: new Date().toISOString() }
      }
    };

    fetch(`${FIRESTORE_REST_BASE}/users/${targetUid}/pending_requests/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody)
    }).catch(() => {});
  } catch (e) {}

  return outgoingObj;
}

export async function getPendingRequestsFromDb(uid) {
  if (!uid || uid === 'guest') return [];

  const pendingKey = `pacepulse_pending_${uid}`;
  const localSaved = JSON.parse(localStorage.getItem(pendingKey) || '[]');

  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/pending_requests`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        const remoteList = data.documents.map(doc => {
          const f = doc.fields;
          return {
            id: f.id ? f.id.stringValue : doc.name.split('/').pop(),
            fromUid: f.fromUid ? f.fromUid.stringValue : '',
            name: f.name ? f.name.stringValue : 'Friend',
            email: f.email ? f.email.stringValue : '',
            username: f.username ? f.username.stringValue : '@user',
            sentAt: f.sentAt ? f.sentAt.stringValue : new Date().toISOString()
          };
        });

        const mergedMap = new Map();
        [...localSaved, ...remoteList].forEach(item => mergedMap.set(item.id, item));
        const mergedList = Array.from(mergedMap.values());

        localStorage.setItem(pendingKey, JSON.stringify(mergedList));
        return mergedList;
      }
    }
  } catch (e) {}

  return localSaved;
}

export function getOutgoingRequestsFromDb(uid) {
  if (!uid || uid === 'guest') return [];
  const outKey = `pacepulse_outgoing_${uid}`;
  try {
    return JSON.parse(localStorage.getItem(outKey) || '[]');
  } catch (e) {
    return [];
  }
}

export async function acceptFriendRequestInDb(currentUser, reqItem) {
  const myUid = currentUser.uid || `usr_${currentUser.email.replace(/[^a-z0-9]/g, '_')}`;
  const myName = currentUser.displayName || currentUser.profile?.name || currentUser.email.split('@')[0];
  const myEmail = currentUser.email;

  const friendObjForMe = {
    id: reqItem.fromUid,
    name: reqItem.name,
    email: reqItem.email,
    username: reqItem.username,
    status: 'connected',
    connectedAt: new Date().toISOString()
  };

  const friendObjForTarget = {
    id: myUid,
    name: myName,
    email: myEmail,
    username: currentUser.username || `@${myEmail.split('@')[0]}`,
    status: 'connected',
    connectedAt: new Date().toISOString()
  };

  const myFriendsKey = `pacepulse_friends_${myUid}`;
  const myFriends = JSON.parse(localStorage.getItem(myFriendsKey) || '[]');
  if (!myFriends.some(f => f.id === reqItem.fromUid)) {
    myFriends.push(friendObjForMe);
    localStorage.setItem(myFriendsKey, JSON.stringify(myFriends));
  }

  const friendUid = reqItem.fromUid;
  if (friendUid) {
    const friendKey = `pacepulse_friends_${friendUid}`;
    const friendList = JSON.parse(localStorage.getItem(friendKey) || '[]');
    if (!friendList.some(f => f.id === myUid)) {
      friendList.push(friendObjForTarget);
      localStorage.setItem(friendKey, JSON.stringify(friendList));
    }
  }

  declineFriendRequestInDb(myUid, reqItem.id);

  try {
    fetch(`${FIRESTORE_REST_BASE}/users/${myUid}/friends/${reqItem.fromUid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { id: { stringValue: reqItem.fromUid }, name: { stringValue: reqItem.name }, email: { stringValue: reqItem.email } } })
    }).catch(() => {});

    fetch(`${FIRESTORE_REST_BASE}/users/${reqItem.fromUid}/friends/${myUid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { id: { stringValue: myUid }, name: { stringValue: myName }, email: { stringValue: myEmail } } })
    }).catch(() => {});
  } catch (e) {}

  try {
    await fetch(`${FIRESTORE_REST_BASE}/users/${myUid}/pending_requests/${reqItem.id}`, {
      method: 'DELETE'
    });
  } catch (e) {}

  return myFriends;
}

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

export function cancelOutgoingRequestInDb(uid, reqId) {
  const outKey = `pacepulse_outgoing_${uid}`;
  const saved = JSON.parse(localStorage.getItem(outKey) || '[]');
  const updated = saved.filter(r => r.id !== reqId);
  localStorage.setItem(outKey, JSON.stringify(updated));
  return updated;
}

export function getFriendsListFromDb(uid) {
  if (!uid || uid === 'guest') return [];
  const friendsKey = `pacepulse_friends_${uid}`;
  try {
    return JSON.parse(localStorage.getItem(friendsKey) || '[]');
  } catch (e) {
    return [];
  }
}

export function removeFriendInDb(uid, friendId) {
  const friendsKey = `pacepulse_friends_${uid}`;
  const saved = JSON.parse(localStorage.getItem(friendsKey) || '[]');
  const updated = saved.filter(f => f.id !== friendId);
  localStorage.setItem(friendsKey, JSON.stringify(updated));

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

export async function getDailyLogsFromDb(uid) {
  if (!uid || uid === 'guest') return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        return data.documents.map(doc => {
          const f = doc.fields;
          const hourlyArr = f.hourly && f.hourly.arrayValue && f.hourly.arrayValue.values
            ? f.hourly.arrayValue.values.map(item => ({
                hour: Number(item.mapValue?.fields?.hour?.integerValue || 0),
                label: item.mapValue?.fields?.label?.stringValue || '00:00',
                steps: Number(item.mapValue?.fields?.steps?.integerValue || 0)
              }))
            : null;

          return {
            date: f.date ? f.date.stringValue : '',
            steps: f.steps ? Number(f.steps.integerValue) : 0,
            goal: f.goal ? Number(f.goal.integerValue) : 10000,
            activeKcal: f.activeKcal ? Number(f.activeKcal.integerValue) : 0,
            distanceKm: f.distanceKm ? Number(f.distanceKm.doubleValue) : 0,
            completed: (f.steps ? Number(f.steps.integerValue) : 0) >= (f.goal ? Number(f.goal.integerValue) : 10000),
            hourlyData: hourlyArr
          };
        });
      }
    }
  } catch (e) {}

  return [];
}

export const auth = { currentUser: null };
export async function signOut() { return true; }
