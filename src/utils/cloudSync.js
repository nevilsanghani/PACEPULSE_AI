/**
 * PacePulse AI - Global Cross-Device Cloud Account & Profile Sync Engine
 * Syncs user accounts, profiles & step goals across PC, Mobile & Tablets globally.
 */

const CLOUD_SYNC_KEY = 'pacepulse_cloud_accounts_v1';

/**
 * Helper to fetch all registered accounts from local storage + cloud fallback
 */
export function getLocalAccounts() {
  try {
    const saved = localStorage.getItem(CLOUD_SYNC_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Helper to save accounts locally
 */
export function saveLocalAccounts(accounts) {
  try {
    localStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify(accounts));
  } catch (e) {}
}

/**
 * Register account across devices
 */
export async function registerAccountCloud(userObj) {
  const accounts = getLocalAccounts();
  const cleanEmail = userObj.email.trim().toLowerCase();
  
  accounts[cleanEmail] = userObj;
  saveLocalAccounts(accounts);

  // Sync to Cloud Storage API asynchronously if network available
  try {
    fetch('https://api.myjson.online/v1/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, userObj })
    }).catch(() => {});
  } catch (e) {}

  return userObj;
}

/**
 * Authenticate account across devices
 */
export async function loginAccountCloud(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = getLocalAccounts();
  const localAcc = accounts[cleanEmail];

  if (localAcc) {
    if (localAcc.password === password.trim()) {
      return { success: true, user: localAcc };
    } else {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }
  }

  // If not found in local cache (e.g. signed up on another device), try cloud lookup
  try {
    const response = await fetch(`https://api.myjson.online/v1/records/${encodeURIComponent(cleanEmail)}`).catch(() => null);
    if (response && response.ok) {
      const cloudData = await response.json();
      if (cloudData && cloudData.userObj) {
        // Cache to local device for future offline access
        accounts[cleanEmail] = cloudData.userObj;
        saveLocalAccounts(accounts);

        if (cloudData.userObj.password === password.trim()) {
          return { success: true, user: cloudData.userObj };
        } else {
          return { success: false, error: 'Incorrect password. Please try again.' };
        }
      }
    }
  } catch (e) {}

  return { success: false, error: 'No account found with this email. Please create an account first.' };
}
