// Time tracking for daily time limits

import { getTimeLimitSiteKey } from '../utils/url-utils.js';
import { getCurrentDateString } from '../utils/time-utils.js';
import { getStorageData, setStorageData } from '../utils/storage-utils.js';
import type { TimeLimit, TimeTracking, TimeTrackingData } from '../types/index.js';

// Global variables for time tracking
let timeTrackingInterval: number | null = null;
let currentSiteKey: string | null = null;
let timeTrackingStartTime: number | null = null;

// Start time tracking for a site
export function startTimeTracking(siteKey: string, timeTracking: TimeTracking): void {
  // If already tracking this site, don't restart
  if (currentSiteKey === siteKey && timeTrackingInterval !== null) {
    return;
  }
  
  // Stop any existing tracking
  stopTimeTracking();
  
  // Update current site
  currentSiteKey = siteKey;
  timeTrackingStartTime = Date.now();
  
  // Update lastActive
  if (timeTracking[siteKey]) {
    timeTracking[siteKey].lastActive = timeTrackingStartTime;
  }
  
  // Start periodic update (every 2 seconds)
  timeTrackingInterval = window.setInterval(async () => {
    try {
      // Check if tracking was stopped (timeTrackingStartTime would be null)
      if (!timeTrackingStartTime || !currentSiteKey) {
        return;
      }
      
      // Check if we're still on the same site and not on blocked page
      const currentUrl = window.location.href;
      const { normalizeUrl } = await import('../utils/url-utils.js');
      const normalizedUrl = normalizeUrl(currentUrl);
      const existingOverlay = document.getElementById('keep-focus-overlay');
      
      if (existingOverlay) {
        // On blocked page - stop tracking
        stopTimeTracking();
        return;
      }
      
      // Get current tracking data
      const result = await getStorageData(['timeTracking', 'timeLimits']);
      const currentTimeTracking = (result.timeTracking as TimeTracking) || {};
      const timeLimits = (result.timeLimits as TimeLimit[]) || [];
      
      // Check if site still has time limit
      const limitSiteKey = getTimeLimitSiteKey(normalizedUrl, timeLimits);
      if (limitSiteKey !== siteKey) {
        // Different site or no longer has limit - stop tracking
        stopTimeTracking();
        return;
      }
      
      // Update time spent
      const now = Date.now();
      const elapsed = now - (timeTrackingStartTime || 0);
      
      // Safety check: if elapsed is unreasonably large, tracking was likely stopped
      if (elapsed < 0 || elapsed > 10000) {
        stopTimeTracking();
        return;
      }
      
      timeTrackingStartTime = now;
      
      if (currentTimeTracking[siteKey]) {
        const oldTimeSpent = currentTimeTracking[siteKey].timeSpent || 0;
        // Reset daily tracking if needed
        const currentDate = getCurrentDateString();
        if (currentTimeTracking[siteKey].date !== currentDate) {
          currentTimeTracking[siteKey] = {
            date: currentDate,
            timeSpent: elapsed,
            lastActive: now
          };
        } else {
          currentTimeTracking[siteKey].timeSpent = (oldTimeSpent || 0) + elapsed;
          currentTimeTracking[siteKey].lastActive = now;
        }
        
        // Check if limit exceeded
        const limitObj = timeLimits.find(l => l.url === siteKey);
        if (limitObj) {
          const limitMs = limitObj.limitMinutes * 60 * 1000;
          if (currentTimeTracking[siteKey].timeSpent >= limitMs) {
            // Limit exceeded - stop tracking and show blocking page
            stopTimeTracking();
            await setStorageData({ timeTracking: currentTimeTracking });
            // Import dynamically to avoid circular dependency
            const { showTimeLimitOverlay } = await import('./overlay-time-limit.js');
            showTimeLimitOverlay(normalizedUrl, siteKey, limitObj.limitMinutes);
            return;
          }
        }
        
        // Save updated tracking
        await setStorageData({ timeTracking: currentTimeTracking });
      }
    } catch (error) {
      // Extension context invalidated or other error - stop tracking
      const err = error as Error;
      if (err.message && err.message.includes('Extension context invalidated')) {
        stopTimeTracking();
        return;
      }
      // Other errors - continue tracking
    }
  }, 2000); // Update every 2 seconds
}

// Stop time tracking
export function stopTimeTracking(): void {
  if (timeTrackingInterval !== null) {
    clearInterval(timeTrackingInterval);
    timeTrackingInterval = null;
  }
  
  // Save final time if we were tracking
  if (currentSiteKey && timeTrackingStartTime) {
    const elapsed = Date.now() - timeTrackingStartTime;
    getStorageData(['timeTracking']).then(result => {
      const timeTracking = (result.timeTracking as TimeTracking) || {};
      if (timeTracking[currentSiteKey!]) {
        const currentDate = getCurrentDateString();
        if (timeTracking[currentSiteKey!].date !== currentDate) {
          timeTracking[currentSiteKey!] = {
            date: currentDate,
            timeSpent: elapsed,
            lastActive: Date.now()
          };
        } else {
          timeTracking[currentSiteKey!].timeSpent = (timeTracking[currentSiteKey!].timeSpent || 0) + elapsed;
          timeTracking[currentSiteKey!].lastActive = Date.now();
        }
        setStorageData({ timeTracking }).catch(() => {
          // Ignore errors
        });
      }
    }).catch(() => {
      // Ignore errors
    });
  }
  
  currentSiteKey = null;
  timeTrackingStartTime = null;
}

// Check time limit and block if exceeded
export async function checkTimeLimit(normalizedUrl: string, timeLimits: TimeLimit[], timeTracking: TimeTracking): Promise<void> {
  // Check if site has a time limit
  const siteKey = getTimeLimitSiteKey(normalizedUrl, timeLimits);
  if (!siteKey) {
    // No time limit for this site, stop tracking if active
    stopTimeTracking();
    return;
  }
  
  // Find the time limit object
  const limitObj = timeLimits.find(l => l.url === siteKey);
  if (!limitObj) {
    stopTimeTracking();
    return;
  }
  
  // Reset daily tracking if needed
  const { resetDailyTrackingIfNeeded } = await import('../utils/time-utils.js');
  const trackingUpdated = resetDailyTrackingIfNeeded(timeTracking);
  if (trackingUpdated) {
    try {
      await setStorageData({ timeTracking });
    } catch (error) {
      // Extension context invalidated - continue anyway
      const err = error as Error;
      if (err.message && err.message.includes('Extension context invalidated')) {
        return;
      }
    }
  }
  
  // Initialize tracking if it doesn't exist
  if (!timeTracking[siteKey]) {
    timeTracking[siteKey] = {
      date: getCurrentDateString(),
      timeSpent: 0,
      lastActive: 0
    };
    try {
      await setStorageData({ timeTracking });
    } catch (error) {
      // Extension context invalidated - continue anyway
      const err = error as Error;
      if (err.message && err.message.includes('Extension context invalidated')) {
        return;
      }
    }
  }
  
  // Re-read from storage to get latest data (fixes race condition with stopTimeTracking)
  try {
    const latestResult = await getStorageData(['timeTracking']);
    const latestTimeTracking = (latestResult.timeTracking as TimeTracking) || {};
    if (latestTimeTracking[siteKey]) {
      // Use latest data from storage instead of parameter
      timeTracking[siteKey] = latestTimeTracking[siteKey];
    }
  } catch (error) {
    // Extension context invalidated - use parameter data
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      // Continue with parameter data
    }
  }
  
  // Check if time limit is exceeded
  const limitMs = limitObj.limitMinutes * 60 * 1000;
  const tracking = timeTracking[siteKey];
  const timeSpent = tracking.timeSpent || 0;
  
  // Check if overlay already exists (don't show duplicate)
  const existingOverlay = document.getElementById('keep-focus-overlay');
  if (existingOverlay) {
    // Overlay exists - stop tracking (user is on blocked page)
    stopTimeTracking();
    return;
  }
  
  if (timeSpent >= limitMs) {
    // Time limit exceeded - show blocking page
    stopTimeTracking();
    const { showTimeLimitOverlay } = await import('./overlay-time-limit.js');
    showTimeLimitOverlay(normalizedUrl, siteKey, limitObj.limitMinutes);
    return;
  }
  
  // Time limit not exceeded - start/continue tracking
  startTimeTracking(siteKey, timeTracking);
}

