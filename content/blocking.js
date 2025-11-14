// Main blocking logic for content script

import { normalizeUrl, isSiteBlocked, getSiteKey } from '../utils/url-utils.js';
import { getAllData, setStorageData } from '../utils/storage-utils.js';
import { checkTimeLimit } from './time-tracking.js';
import { removeOverlayAndRestoreBody } from './overlay-utils.js';
import { stopTimeTracking } from './time-tracking.js';

// Global variable to track unlock expiration check interval
let unlockExpirationCheckInterval = null;

// Start periodic check for unlock expiration
export function startUnlockExpirationCheck() {
  // Clear any existing interval
  stopUnlockExpirationCheck();
  
  // Check every 30 seconds if unlock period has expired
  unlockExpirationCheckInterval = setInterval(async () => {
    try {
      const currentUrl = window.location.href;
      const normalizedUrl = normalizeUrl(currentUrl);
      
      const result = await getAllData();
      const blockedSites = result.blockedSites || [];
      const unlockedUntil = result.unlockedUntil || {};
      
      // Check if current site is blocked
      const isBlocked = isSiteBlocked(normalizedUrl, blockedSites);
      
      if (!isBlocked) {
        // Site is no longer blocked, stop checking
        stopUnlockExpirationCheck();
        return;
      }
      
      // Get site key and check unlock status
      const siteKey = getSiteKey(normalizedUrl, blockedSites);
      const unlockTimestamp = unlockedUntil[siteKey];
      const now = Date.now();
      
      // If unlock period has expired, re-check and block
      if (!unlockTimestamp || now >= unlockTimestamp) {
        stopUnlockExpirationCheck();
        checkAndBlockSite();
      }
    } catch (error) {
      // Extension context invalidated or other error - stop checking
      if (error.message && error.message.includes('Extension context invalidated')) {
        stopUnlockExpirationCheck();
        return;
      }
      // Other errors - continue checking
    }
  }, 30000); // Check every 30 seconds
}

// Stop periodic check for unlock expiration
export function stopUnlockExpirationCheck() {
  if (unlockExpirationCheckInterval !== null) {
    clearInterval(unlockExpirationCheckInterval);
    unlockExpirationCheckInterval = null;
  }
}

// Main function to check and block sites
export async function checkAndBlockSite() {
  'use strict';
  
  // Get current URL and normalize it
  const currentUrl = window.location.href;
  const normalizedUrl = normalizeUrl(currentUrl);
  
  // Get blocked sites and unlock status from storage
  let result;
  try {
    result = await getAllData();
  } catch (error) {
    // Extension context invalidated - can't check, exit silently
    if (error.message && error.message.includes('Extension context invalidated')) {
      return;
    }
    throw error; // Re-throw other errors
  }
  const blockedSites = result.blockedSites || [];
  const unlockedUntil = result.unlockedUntil || {};
  const focusStreak = result.focusStreak || 0;
  const timeLimits = result.timeLimits || [];
  const timeTracking = result.timeTracking || {};

  // Check if current site is blocked (regular blocking takes priority)
  const isBlocked = isSiteBlocked(normalizedUrl, blockedSites);

  if (isBlocked) {
    // Check if site is currently unlocked
    const siteKey = getSiteKey(normalizedUrl, blockedSites);
    
    const unlockTimestamp = unlockedUntil[siteKey];
    const now = Date.now();

    if (unlockTimestamp && now < unlockTimestamp) {
      // Site is still unlocked - check time limits and track time
      // Remove overlay if it exists (in case URL changed and site is now unlocked)
      removeOverlayAndRestoreBody();
      // Start periodic check for unlock expiration
      startUnlockExpirationCheck();
      // Check time limits for unlocked blocked sites
      await checkTimeLimit(normalizedUrl, timeLimits, timeTracking);
      return;
    }
    
    // Site is blocked and not unlocked - stop time tracking
    stopTimeTracking();

    // Check if overlay already exists (don't show duplicate)
    const existingOverlay = document.getElementById('keep-focus-overlay');
    if (existingOverlay) {
      return;
    }

    // Site is blocked - stop unlock expiration check and show overlay
    stopUnlockExpirationCheck();
    // Increment streak if they closed the tab last time instead of unlocking
    // We track this by checking if there's no recent unlock for this site
    // Only increment if it's been a while since last unlock (they likely closed tab)
    const lastUnlockTime = unlockTimestamp || 0;
    const timeSinceLastUnlock = now - lastUnlockTime;
    const STREAK_INCREMENT_THRESHOLD = 60 * 60 * 1000; // 1 hour - if they come back after this, they likely closed tab
    const UNLOCK_WINDOW = 10 * 60 * 1000; // 10 minutes - unlock window
    
    let newStreak = focusStreak;
    // Only increment streak if they haven't unlocked recently (outside unlock window + threshold)
    if (!unlockTimestamp || timeSinceLastUnlock > (UNLOCK_WINDOW + STREAK_INCREMENT_THRESHOLD)) {
      // They likely closed the tab last time - increment streak
      newStreak = focusStreak + 1;
      try {
        await setStorageData({ focusStreak: newStreak });
      } catch (error) {
        // Extension context invalidated - ignore, continue with current streak
        if (error.message && error.message.includes('Extension context invalidated')) {
          newStreak = focusStreak;
        }
      }
    }
    
    // Import overlay dynamically to avoid circular dependency
    const { showBlockOverlay } = await import('./overlay-block.js');
    await showBlockOverlay(normalizedUrl, siteKey, newStreak);
    return;
  }

  // Site is not blocked - check time limits
  // Remove overlay if it exists (in case URL changed from blocked to unblocked)
  removeOverlayAndRestoreBody();
  // Stop unlock expiration check since site is not blocked
  stopUnlockExpirationCheck();
  
  // Check time limits
  await checkTimeLimit(normalizedUrl, timeLimits, timeTracking);
}

