// Chrome storage utilities

// Get all extension data from storage
export async function getAllData() {
  try {
    const result = await chrome.storage.sync.get([
      'blockedSites',
      'unlockedUntil',
      'focusStreak',
      'timeLimits',
      'timeTracking',
      'darkMode'
    ]);
    return {
      blockedSites: result.blockedSites || [],
      unlockedUntil: result.unlockedUntil || {},
      focusStreak: result.focusStreak || 0,
      timeLimits: result.timeLimits || [],
      timeTracking: result.timeTracking || {},
      darkMode: result.darkMode || false
    };
  } catch (error) {
    // Extension context invalidated or other error
    if (error.message && error.message.includes('Extension context invalidated')) {
      return {
        blockedSites: [],
        unlockedUntil: {},
        focusStreak: 0,
        timeLimits: [],
        timeTracking: {},
        darkMode: false
      };
    }
    throw error;
  }
}

// Get specific data from storage
export async function getStorageData(keys) {
  try {
    return await chrome.storage.sync.get(keys);
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      // Return empty defaults
      const defaults = {};
      keys.forEach(key => {
        if (key === 'blockedSites' || key === 'timeLimits') {
          defaults[key] = [];
        } else if (key === 'unlockedUntil' || key === 'timeTracking') {
          defaults[key] = {};
        } else if (key === 'focusStreak') {
          defaults[key] = 0;
        } else if (key === 'darkMode') {
          defaults[key] = false;
        } else {
          defaults[key] = null;
        }
      });
      return defaults;
    }
    throw error;
  }
}

// Set data in storage
export async function setStorageData(data) {
  try {
    await chrome.storage.sync.set(data);
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      // Silently fail if extension context is invalidated
      return;
    }
    throw error;
  }
}

