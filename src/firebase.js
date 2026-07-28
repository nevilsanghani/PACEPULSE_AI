/**
 * PacePulse AI - Live Production Firebase Cloud Firestore Service
 * Project ID: pacepulse-ai
 */

export const firebaseConfig = {
  apiKey: "AIzaSyCyw8ntKlVJyrR_22SxaE0jVdaI5nGcI2Y",
  authDomain: "pacepulse-ai.firebaseapp.com",
  projectId: "pacepulse-ai",
  storageBucket: "pacepulse-ai.firebasestorage.app",
  messagingSenderId: "930426837446",
  appId: "1:930426837446:web:190493214d1f226ae87ac7",
  measurementId: "G-6XJ9P3VRM6"
};

const STORAGE_ACCOUNTS_KEY = 'pacepulse_prod_accounts_db_v2';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

/**
 * Local Device Cache Backup Helper
 */
function getLocalDbAccounts() {
  try {
    const saved = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalDbAccounts(accounts) {
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {}
}

export const auth = {
  currentUser: null
};

/**
 * Save Daily Steps, Calories, & Distance Logs in Firebase Cloud Firestore
 * Creates document: users/{uid}/daily_logs/{dateStr}
 */
export async function saveDailyLogsToDb(uid, dateStr, totalSteps, goal, caloriesData, hourlyData) {
  if (!uid || uid === 'guest') return;

  try {
    const firestoreBody = {
      fields: {
        dateStr: { stringValue: dateStr },
        totalSteps: { integerValue: String(totalSteps || 0) },
        dailyGoal: { integerValue: String(goal || 10000) },
        totalKcal: { integerValue: String(caloriesData ? caloriesData.totalKcal : 0) },
        activeKcal: { integerValue: String(caloriesData ? caloriesData.activeKcal : 0) },
        distanceKm: { doubleValue: Number(caloriesData ? caloriesData.distanceKm : 0) },
        durationMins: { integerValue: String(caloriesData ? caloriesData.durationMins : 0) },
        bmrDaily: { integerValue: String(caloriesData ? caloriesData.bmrDaily : 1669) },
        hourlyJson: { stringValue: JSON.stringify(hourlyData || []) },
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
 * Register User in Firebase Cloud Firestore Database ('users' collection & initial 'daily_logs')
 */
export async function registerUserInDb(email, password, displayName, profile) {
  const cleanEmail = email.trim().toLowerCase();
  const uid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const userData = {
    uid,
    displayName: displayName.trim(),
    email: cleanEmail,
    password: password.trim(),
    createdAt: new Date().toISOString(),
    profile
  };

  // 1. Save to Local Device Cache
  const accounts = getLocalDbAccounts();
  accounts[cleanEmail] = userData;
  saveLocalDbAccounts(accounts);

  // 2. Push Document directly to Firebase Cloud Firestore 'users' collection
  try {
    const firestoreBody = {
      fields: {
        uid: { stringValue: uid },
        displayName: { stringValue: displayName.trim() },
        email: { stringValue: cleanEmail },
        password: { stringValue: password.trim() },
        createdAt: { stringValue: userData.createdAt },
        profile: {
          mapValue: {
            fields: {
              name: { stringValue: profile.name || displayName.trim() },
              email: { stringValue: cleanEmail },
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

    // 3. Immediately Create Initial Today's Daily Log in Firestore!
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

  const accounts = getLocalDbAccounts();
  const localUser = accounts[cleanEmail];

  if (localUser) {
    if (localUser.password === cleanPassword) {
      return { success: true, user: localUser };
    } else {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }
  }

  // Query Firebase Cloud Firestore Document
  try {
    const uid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}`).catch(() => null);

    if (res && res.ok) {
      const docData = await res.json();
      if (docData && docData.fields) {
        const f = docData.fields;
        const pFields = f.profile && f.profile.mapValue ? f.profile.mapValue.fields : {};

        const fetchedUser = {
          uid: f.uid ? f.uid.stringValue : uid,
          displayName: f.displayName ? f.displayName.stringValue : cleanEmail.split('@')[0],
          email: f.email ? f.email.stringValue : cleanEmail,
          password: f.password ? f.password.stringValue : '',
          createdAt: f.createdAt ? f.createdAt.stringValue : new Date().toISOString(),
          profile: {
            name: pFields.name ? pFields.name.stringValue : cleanEmail.split('@')[0],
            email: cleanEmail,
            gender: pFields.gender ? pFields.gender.stringValue : 'male',
            birthDate: pFields.birthDate ? pFields.birthDate.stringValue : '2000-01-01',
            age: pFields.age ? Number(pFields.age.integerValue || 25) : 25,
            heightCm: pFields.heightCm ? Number(pFields.heightCm.doubleValue || 175) : 175,
            weightKg: pFields.weightKg ? Number(pFields.weightKg.doubleValue || 70) : 70,
            dailyGoal: pFields.dailyGoal ? Number(pFields.dailyGoal.integerValue || 10000) : 10000
          }
        };

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

  return { 
    success: false, 
    error: 'No account found with this email. Please check your credentials or click "Create New Account".' 
  };
}

/**
 * Fetch Daily Steps, Calories & Distance Logs from Firebase Cloud Firestore
 */
export async function getDailyLogsFromDb(uid, dateStr) {
  if (!uid || uid === 'guest') return null;

  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/users/${uid}/daily_logs/${dateStr}`).catch(() => null);
    if (res && res.ok) {
      const docData = await res.json();
      if (docData && docData.fields) {
        const f = docData.fields;
        return {
          dateStr: f.dateStr ? f.dateStr.stringValue : dateStr,
          totalSteps: f.totalSteps ? Number(f.totalSteps.integerValue || 0) : 0,
          dailyGoal: f.dailyGoal ? Number(f.dailyGoal.integerValue || 10000) : 10000,
          totalKcal: f.totalKcal ? Number(f.totalKcal.integerValue || 0) : 0,
          activeKcal: f.activeKcal ? Number(f.activeKcal.integerValue || 0) : 0,
          distanceKm: f.distanceKm ? Number(f.distanceKm.doubleValue || 0) : 0,
          durationMins: f.durationMins ? Number(f.durationMins.integerValue || 0) : 0,
          bmrDaily: f.bmrDaily ? Number(f.bmrDaily.integerValue || 1669) : 1669,
          hourlyData: f.hourlyJson ? JSON.parse(f.hourlyJson.stringValue) : null
        };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Update User Profile in Firebase Cloud Firestore
 */
export async function updateUserProfileInDb(uid, updatedProfile) {
  const accounts = getLocalDbAccounts();
  Object.keys(accounts).forEach(async (emailKey) => {
    if (accounts[emailKey].uid === uid) {
      accounts[emailKey].profile = updatedProfile;

      try {
        const firestoreBody = {
          fields: {
            profile: {
              mapValue: {
                fields: {
                  name: { stringValue: updatedProfile.name || '' },
                  email: { stringValue: emailKey },
                  gender: { stringValue: updatedProfile.gender || 'male' },
                  birthDate: { stringValue: updatedProfile.birthDate || '2000-01-01' },
                  age: { integerValue: String(updatedProfile.age || 25) },
                  heightCm: { doubleValue: Number(updatedProfile.heightCm || 175) },
                  weightKg: { doubleValue: Number(updatedProfile.weightKg || 70) },
                  dailyGoal: { integerValue: String(updatedProfile.dailyGoal || 10000) }
                }
              }
            }
          }
        };

        fetch(`${FIRESTORE_REST_BASE}/users/${uid}?updateMask.fieldPaths=profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(firestoreBody)
        }).catch(() => {});
      } catch (e) {}
    }
  });
  saveLocalDbAccounts(accounts);
}

export const signInWithEmailAndPassword = async (authObj, email, password) => {
  const res = await loginUserInDb(email, password);
  if (res.success) return { user: res.user };
  throw new Error(res.error);
};

export const createUserWithEmailAndPassword = async (authObj, email, password) => {
  return {
    user: {
      uid: `usr_${email.replace(/[^a-z0-9]/g, '_')}`,
      email,
      displayName: email.split('@')[0]
    }
  };
};

export const signOut = async () => {
  return true;
};

export const onAuthStateChanged = (authObj, callback) => {
  const savedUser = localStorage.getItem('pacepulse_user');
  if (savedUser) {
    try {
      callback(JSON.parse(savedUser));
    } catch (e) {}
  }
  return () => {};
};
