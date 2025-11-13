// Content script that runs on all pages to block sites

// Global variable to track unlock expiration check interval
let unlockExpirationCheckInterval = null;

// Global variables for time tracking
let timeTrackingInterval = null;
let currentSiteKey = null;
let timeTrackingStartTime = null;

// Start periodic check for unlock expiration
function startUnlockExpirationCheck() {
  // Clear any existing interval
  stopUnlockExpirationCheck();
  
  // Check every 30 seconds if unlock period has expired
  unlockExpirationCheckInterval = setInterval(async () => {
    try {
      const currentUrl = window.location.href;
      const normalizedUrl = normalizeUrl(currentUrl);
      
      const result = await chrome.storage.sync.get(['blockedSites', 'unlockedUntil']);
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
function stopUnlockExpirationCheck() {
  if (unlockExpirationCheckInterval !== null) {
    clearInterval(unlockExpirationCheckInterval);
    unlockExpirationCheckInterval = null;
  }
}

// Main function to check and block sites
async function checkAndBlockSite() {
  'use strict';
  
  // Get current URL and normalize it
  const currentUrl = window.location.href;
  
  const normalizedUrl = normalizeUrl(currentUrl);
  
  // Get blocked sites and unlock status from storage
  let result;
  try {
    result = await chrome.storage.sync.get(['blockedSites', 'unlockedUntil', 'focusStreak', 'timeLimits', 'timeTracking']);
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
        await chrome.storage.sync.set({ focusStreak: newStreak });
      } catch (error) {
        // Extension context invalidated - ignore, continue with current streak
        if (error.message && error.message.includes('Extension context invalidated')) {
          newStreak = focusStreak;
        }
      }
    }
    
    showBlockOverlay(normalizedUrl, siteKey, newStreak);
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

// Get current date string (YYYY-MM-DD)
function getCurrentDateString() {
  const now = new Date();
  // Use local date instead of UTC so reset happens at local midnight
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Reset daily tracking if date has changed
function resetDailyTrackingIfNeeded(timeTracking) {
  const currentDate = getCurrentDateString();
  let updated = false;
  
  for (const siteKey in timeTracking) {
    if (timeTracking[siteKey].date !== currentDate) {
      timeTracking[siteKey] = {
        date: currentDate,
        timeSpent: 0,
        lastActive: 0
      };
      updated = true;
    }
  }
  
  return updated;
}

// Get site key for time limits (similar to getSiteKey but for time limits)
function getTimeLimitSiteKey(normalizedUrl, timeLimits) {
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/');
  
  const normalizedCurrentHostname = normalizeHostname(currentHostname);
  
  for (const limitObj of timeLimits) {
    const limitUrl = limitObj.url;
    const limitParts = limitUrl.split('/');
    const limitHostname = limitParts[0];
    const limitPath = limitParts.slice(1).join('/');
    
    const normalizedLimitHostname = normalizeHostname(limitHostname);
    
    // Check if hostnames match
    if (normalizedCurrentHostname !== normalizedLimitHostname) {
      continue;
    }
    
    // If limit has no path, match all paths
    if (!limitPath) {
      return limitUrl;
    }
    
    // Check path match
    if (normalizedUrl === limitUrl || 
        normalizedUrl.startsWith(limitUrl + '/') ||
        currentPath === limitPath ||
        currentPath.startsWith(limitPath + '/')) {
      return limitUrl;
    }
  }
  
  return null;
}

// Check if site has a time limit
function hasTimeLimit(normalizedUrl, timeLimits) {
  return getTimeLimitSiteKey(normalizedUrl, timeLimits) !== null;
}

// Check time limit and block if exceeded
async function checkTimeLimit(normalizedUrl, timeLimits, timeTracking) {
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
  const trackingUpdated = resetDailyTrackingIfNeeded(timeTracking);
  if (trackingUpdated) {
    try {
      await chrome.storage.sync.set({ timeTracking });
    } catch (error) {
      // Extension context invalidated - continue anyway
      if (error.message && error.message.includes('Extension context invalidated')) {
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
      await chrome.storage.sync.set({ timeTracking });
    } catch (error) {
      // Extension context invalidated - continue anyway
      if (error.message && error.message.includes('Extension context invalidated')) {
        return;
      }
    }
  }
  
  // Re-read from storage to get latest data (fixes race condition with stopTimeTracking)
  try {
    const latestResult = await chrome.storage.sync.get(['timeTracking']);
    const latestTimeTracking = latestResult.timeTracking || {};
    if (latestTimeTracking[siteKey]) {
      // Use latest data from storage instead of parameter
      timeTracking[siteKey] = latestTimeTracking[siteKey];
    }
  } catch (error) {
    // Extension context invalidated - use parameter data
    if (error.message && error.message.includes('Extension context invalidated')) {
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
    showTimeLimitOverlay(normalizedUrl, siteKey, limitObj.limitMinutes);
    return;
  }
  
  // Time limit not exceeded - start/continue tracking
  startTimeTracking(siteKey, timeTracking);
}

// Start time tracking for a site
function startTimeTracking(siteKey, timeTracking) {
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
  timeTrackingInterval = setInterval(async () => {
    try {
      // Check if tracking was stopped (timeTrackingStartTime would be null)
      if (!timeTrackingStartTime || !currentSiteKey) {
        return;
      }
      
      // Check if we're still on the same site and not on blocked page
      const currentUrl = window.location.href;
      const normalizedUrl = normalizeUrl(currentUrl);
      const existingOverlay = document.getElementById('keep-focus-overlay');
      
      if (existingOverlay) {
        // On blocked page - stop tracking
        stopTimeTracking();
        return;
      }
      
      // Get current tracking data
      const result = await chrome.storage.sync.get(['timeTracking', 'timeLimits']);
      const currentTimeTracking = result.timeTracking || {};
      const timeLimits = result.timeLimits || [];
      
      // Check if site still has time limit
      const limitSiteKey = getTimeLimitSiteKey(normalizedUrl, timeLimits);
      if (limitSiteKey !== siteKey) {
        // Different site or no longer has limit - stop tracking
        stopTimeTracking();
        return;
      }
      
      // Update time spent
      const now = Date.now();
      const elapsed = now - timeTrackingStartTime;
      
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
            await chrome.storage.sync.set({ timeTracking: currentTimeTracking });
            showTimeLimitOverlay(normalizedUrl, siteKey, limitObj.limitMinutes);
            return;
          }
        }
        
        // Save updated tracking
        await chrome.storage.sync.set({ timeTracking: currentTimeTracking });
      }
    } catch (error) {
      // Extension context invalidated or other error - stop tracking
      if (error.message && error.message.includes('Extension context invalidated')) {
        stopTimeTracking();
        return;
      }
      // Other errors - continue tracking
    }
  }, 2000); // Update every 2 seconds
}

// Stop time tracking
function stopTimeTracking() {
  if (timeTrackingInterval !== null) {
    clearInterval(timeTrackingInterval);
    timeTrackingInterval = null;
  }
  
  // Save final time if we were tracking
  if (currentSiteKey && timeTrackingStartTime) {
    const elapsed = Date.now() - timeTrackingStartTime;
    chrome.storage.sync.get(['timeTracking']).then(result => {
      const timeTracking = result.timeTracking || {};
      if (timeTracking[currentSiteKey]) {
        const currentDate = getCurrentDateString();
        if (timeTracking[currentSiteKey].date !== currentDate) {
          timeTracking[currentSiteKey] = {
            date: currentDate,
            timeSpent: elapsed,
            lastActive: Date.now()
          };
        } else {
          timeTracking[currentSiteKey].timeSpent = (timeTracking[currentSiteKey].timeSpent || 0) + elapsed;
          timeTracking[currentSiteKey].lastActive = Date.now();
        }
        chrome.storage.sync.set({ timeTracking }).catch(() => {
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

// Set up URL change detection for SPAs
function setupUrlChangeDetection() {
  // Prevent duplicate setup
  if (window._keepFocusUrlDetectionSetup) {
    return;
  }
  window._keepFocusUrlDetectionSetup = true;
  
  let lastUrl = window.location.href;
  
  // Check URL periodically (for SPAs that don't trigger events)
  const urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Stop unlock expiration check and time tracking when URL changes
      stopUnlockExpirationCheck();
      stopTimeTracking();
      checkAndBlockSite();
    }
  }, 500); // Check every 500ms
  
  // Listen for popstate (back/forward button)
  window.addEventListener('popstate', () => {
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    checkAndBlockSite();
  });

  // Intercept pushState and replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    // Use setTimeout to allow the page to update
    setTimeout(() => checkAndBlockSite(), 100);
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    // Use setTimeout to allow the page to update
    setTimeout(() => checkAndBlockSite(), 100);
  };

  // Also listen for hash changes
  window.addEventListener('hashchange', () => {
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    checkAndBlockSite();
  });
}

// Initialize on page load
(async function() {
  'use strict';
  
  // Run initial check
  await checkAndBlockSite();
  
  // Set up URL change detection
  setupUrlChangeDetection();
  
  // Stop unlock expiration check and time tracking when page unloads
  window.addEventListener('beforeunload', () => {
    stopUnlockExpirationCheck();
    stopTimeTracking();
  });
})();

// Global variable to track media observer
let mediaObserver = null;

// Pause all video and audio elements on the page
function pauseAllMedia() {
  // Pause all video elements
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.paused) {
      video.pause();
    }
    // Prevent autoplay by removing autoplay attribute
    video.removeAttribute('autoplay');
    video.autoplay = false;
  });
  
  // Pause all audio elements
  const audios = document.querySelectorAll('audio');
  audios.forEach(audio => {
    if (!audio.paused) {
      audio.pause();
    }
    // Prevent autoplay by removing autoplay attribute
    audio.removeAttribute('autoplay');
    audio.autoplay = false;
  });
  
  // Also try to pause any media elements in iframes (if accessible)
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      // Only access iframe content if same-origin
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const iframeVideos = iframeDoc.querySelectorAll('video');
        iframeVideos.forEach(video => {
          if (!video.paused) {
            video.pause();
          }
          video.removeAttribute('autoplay');
          video.autoplay = false;
        });
        
        const iframeAudios = iframeDoc.querySelectorAll('audio');
        iframeAudios.forEach(audio => {
          if (!audio.paused) {
            audio.pause();
          }
          audio.removeAttribute('autoplay');
          audio.autoplay = false;
        });
      }
    } catch (e) {
      // Cross-origin iframe, can't access - that's okay
    }
  });
}

// Start observing for new media elements and pause them
function startMediaObserver() {
  // Stop any existing observer
  stopMediaObserver();
  
  // Pause existing media immediately
  pauseAllMedia();
  
  // Create observer to watch for new media elements
  mediaObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Check if the added node is a media element
          if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
            if (!node.paused) {
              node.pause();
            }
            node.removeAttribute('autoplay');
            node.autoplay = false;
          }
          
          // Check for media elements within the added node
          const videos = node.querySelectorAll?.('video');
          if (videos) {
            videos.forEach(video => {
              if (!video.paused) {
                video.pause();
              }
              video.removeAttribute('autoplay');
              video.autoplay = false;
            });
          }
          
          const audios = node.querySelectorAll?.('audio');
          if (audios) {
            audios.forEach(audio => {
              if (!audio.paused) {
                audio.pause();
              }
              audio.removeAttribute('autoplay');
              audio.autoplay = false;
            });
          }
        }
      });
    });
  });
  
  // Start observing the document body for new elements
  if (document.body) {
    mediaObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Also periodically pause media as a backup (in case observer misses something)
  const pauseInterval = setInterval(() => {
    const overlay = document.getElementById('keep-focus-overlay');
    if (!overlay) {
      // Overlay removed, stop the interval
      clearInterval(pauseInterval);
      return;
    }
    pauseAllMedia();
  }, 1000); // Check every second
  
  // Store interval ID so we can clear it if needed
  if (!window._keepFocusPauseInterval) {
    window._keepFocusPauseInterval = pauseInterval;
  }
}

// Stop observing for new media elements
function stopMediaObserver() {
  if (mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }
  
  // Clear the periodic pause interval
  if (window._keepFocusPauseInterval) {
    clearInterval(window._keepFocusPauseInterval);
    window._keepFocusPauseInterval = null;
  }
}

// Remove overlay and restore body content
function removeOverlayAndRestoreBody() {
  const existingOverlay = document.getElementById('keep-focus-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
    // Restore body content
    Array.from(document.body.children).forEach(child => {
      if (child.id !== 'keep-focus-overlay') {
        child.style.display = '';
      }
    });
    document.body.style.overflow = '';
    // Stop media observer when overlay is removed
    stopMediaObserver();
  }
}

// Check if a site is blocked
function isSiteBlocked(normalizedUrl, blockedSites) {
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/');
  
  return blockedSites.some(blockedSiteObj => {
    const blockedSite = blockedSiteObj.url;
    const blockChildren = blockedSiteObj.blockChildren !== false;
    
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    const blockedPath = blockedParts.slice(1).join('/');
    
    const normalizedCurrentHostname = normalizeHostname(currentHostname);
    const normalizedBlockedHostname = normalizeHostname(blockedHostname);
    
    const hostnameMatch = normalizedCurrentHostname === normalizedBlockedHostname;
    
    if (!hostnameMatch) {
      return false;
    }
    
    if (!blockedPath) {
      if (blockChildren) {
        return true;
      } else {
        const isExactDomain = !currentPath || currentPath === '';
        return isExactDomain;
      }
    }
    
    const normalizedBlockedSite = normalizedBlockedHostname + (blockedPath ? '/' + blockedPath : '');
    
    let pathMatch = false;
    if (blockChildren) {
      pathMatch = normalizedUrl === normalizedBlockedSite || 
             normalizedUrl.startsWith(normalizedBlockedSite + '/') ||
             currentPath === blockedPath ||
             currentPath.startsWith(blockedPath + '/');
    } else {
      pathMatch = normalizedUrl === normalizedBlockedSite || currentPath === blockedPath;
    }
    return pathMatch;
  });
}

// Normalize hostname by removing www. prefix for consistent matching
function normalizeHostname(hostname) {
  if (!hostname) return hostname;
  // Remove www. prefix if present (case-insensitive)
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return normalized;
}

// Normalize URL for consistent matching
function normalizeUrl(url) {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove protocol (http://, https://)
  normalized = normalized.replace(/^https?:\/\//i, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Remove fragment and query parameters for the base URL
  // But keep the path if it exists
  try {
    // Try to parse as URL to handle paths properly
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    const urlObj = new URL(normalized);
    // Use normalizeHostname helper for consistency
    const hostname = normalizeHostname(urlObj.hostname);
    const pathname = urlObj.pathname.replace(/\/$/, '');
    normalized = hostname.toLowerCase() + pathname.toLowerCase();
  } catch (e) {
    // If parsing fails, just clean up what we can
    // Split by / to separate domain from path
    const parts = normalized.split('/');
    const domain = normalizeHostname(parts[0]);
    const path = parts.slice(1).join('/').toLowerCase();
    normalized = domain.toLowerCase() + (path ? '/' + path : '');
  }
  
  return normalized;
}

// Get site key for storage
function getSiteKey(normalizedUrl, blockedSites) {
  // Find the matching blocked site pattern
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/'); // Get path after hostname
  
  // Normalize current hostname (should already be normalized, but just in case)
  const normalizedCurrentHostname = normalizeHostname(currentHostname);
  
  for (const blockedSiteObj of blockedSites) {
    const blockedSite = blockedSiteObj.url;
    const blockChildren = blockedSiteObj.blockChildren !== false; // Default to true if undefined
    
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    const blockedPath = blockedParts.slice(1).join('/'); // Get path after hostname
    
    // Normalize both hostnames for comparison (remove www. prefix)
    const normalizedBlockedHostname = normalizeHostname(blockedHostname);
    
    // Check if normalized hostnames match
    const hostnameMatch = normalizedCurrentHostname === normalizedBlockedHostname;
    
    if (!hostnameMatch) {
      continue; // Different domain, skip
    }
    
    // If blocked site has no path (domain-only block), match
    if (!blockedPath) {
      return blockedSite;
    }
    
    // Normalize blocked site for comparison
    const normalizedBlockedSite = normalizedBlockedHostname + (blockedPath ? '/' + blockedPath : '');
    
    // If blockChildren is true, match exact and subpaths
    // If blockChildren is false, only match exact
    if (blockChildren) {
      if (normalizedUrl === normalizedBlockedSite || 
          normalizedUrl.startsWith(normalizedBlockedSite + '/') ||
          currentPath === blockedPath ||
          currentPath.startsWith(blockedPath + '/')) {
        return blockedSite;
      }
    } else {
      // Only exact match
      if (normalizedUrl === normalizedBlockedSite || currentPath === blockedPath) {
        return blockedSite;
      }
    }
  }
  return normalizedCurrentHostname; // Return normalized domain as fallback
}

// Show the blocking overlay
async function showBlockOverlay(normalizedUrl, siteKey, currentStreak) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      showBlockOverlay(normalizedUrl, siteKey, currentStreak);
    });
    return;
  }
  
  // Check if overlay already exists
  let overlay = document.getElementById('keep-focus-overlay');
  if (overlay) {
    return; // Overlay already shown
  }
  
  // Get dark mode preference
  let result;
  try {
    result = await chrome.storage.sync.get(['darkMode']);
  } catch (error) {
    // Extension context invalidated - use default dark mode
    if (error.message && error.message.includes('Extension context invalidated')) {
      result = { darkMode: false };
    } else {
      throw error; // Re-throw other errors
    }
  }
  const darkMode = result.darkMode || false;
  
  // Hide all existing body content without destroying it
  const body = document.body;
  if (body) {
    // Hide all body children
    Array.from(body.children).forEach(child => {
      if (child.id !== 'keep-focus-overlay') {
        child.style.display = 'none';
      }
    });
    // Also hide any direct text nodes by wrapping content
    body.style.overflow = 'hidden';
  }
  
  // Create overlay container
  overlay = document.createElement('div');
  overlay.id = 'keep-focus-overlay';
  
  // Set dark mode class if enabled
  if (darkMode) {
    overlay.classList.add('dark-mode');
  }
  
  // Apply inline styles directly to overlay element to prevent inheritance
  const bgColor = darkMode ? '#1a1a1a' : '#fefdf7';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  
  overlay.style.cssText = `
    all: unset !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
    font-size: 16px !important;
    font-weight: normal !important;
    font-style: normal !important;
    line-height: normal !important;
    letter-spacing: normal !important;
    text-align: initial !important;
    text-decoration: none !important;
    text-transform: none !important;
    text-indent: 0 !important;
    text-shadow: none !important;
    color: ${textColor} !important;
    background: ${bgColor} !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    min-height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    padding-bottom: 90px !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 999999 !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    direction: ltr !important;
    unicode-bidi: normal !important;
    writing-mode: horizontal-tb !important;
  `;
  
  // Create and inject styles
  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  style.textContent = `
    /* Reset all inherited styles on the overlay root */
    #keep-focus-overlay {
      all: unset !important;
      /* Explicitly set all needed properties with !important to override page styles */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      font-size: 16px !important;
      font-weight: normal !important;
      font-style: normal !important;
      line-height: normal !important;
      letter-spacing: normal !important;
      text-align: initial !important;
      text-decoration: none !important;
      text-transform: none !important;
      text-indent: 0 !important;
      text-shadow: none !important;
      color: ${textColor} !important;
      background: ${bgColor} !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      min-height: 100vh !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px !important;
      padding-bottom: 90px !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 999999 !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      direction: ltr !important;
      unicode-bidi: normal !important;
      writing-mode: horizontal-tb !important;
    }
    
    /* Reset inherited properties for all child elements - prevent inheritance from page */
    #keep-focus-overlay *,
    #keep-focus-overlay *::before,
    #keep-focus-overlay *::after {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      font-style: inherit !important;
      line-height: inherit !important;
      color: inherit !important;
      text-align: inherit !important;
      text-decoration: inherit !important;
      text-transform: inherit !important;
      text-indent: 0 !important;
      text-shadow: none !important;
      letter-spacing: inherit !important;
      direction: inherit !important;
      unicode-bidi: inherit !important;
      writing-mode: inherit !important;
    }
    
    #keep-focus-overlay .focus-blocker {
      width: 100% !important;
      max-width: 600px !important;
      display: block !important;
    }
    
    #keep-focus-overlay .focus-card {
      background: ${darkMode ? '#2d2d2d' : 'white'} !important;
      border-radius: 16px !important;
      padding: 40px !important;
      box-shadow: 0 20px 60px ${darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(212, 184, 150, 0.15)'} !important;
      text-align: center !important;
      display: block !important;
    }
    
    #keep-focus-overlay h2 {
      font-size: 40px !important;
      font-weight: 700 !important;
      margin-bottom: 12px !important;
      color: ${darkMode ? '#e0e0e0' : '#212529'} !important;
      letter-spacing: -0.5px !important;
      display: block !important;
      white-space: nowrap !important;
    }
    
    #keep-focus-overlay .subtitle {
      font-size: 16px !important;
      color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
      margin-bottom: 32px !important;
      line-height: 1.5 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .reason-input {
      width: 100% !important;
      padding: 14px !important;
      border: 2px solid ${darkMode ? 'rgba(64, 64, 64, 0.3)' : 'rgba(233, 236, 239, 0.3)'} !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      margin-bottom: 20px !important;
      transition: border-color 0.2s !important;
      font-family: inherit !important;
      display: block !important;
      background: ${darkMode ? '#2d2d2d' : 'white'} !important;
      color: ${darkMode ? '#e0e0e0' : '#333'} !important;
    }
    
    #keep-focus-overlay .reason-input:focus {
      outline: none !important;
      border-color: ${darkMode ? 'rgba(64, 64, 64, 0.3)' : 'rgba(233, 236, 239, 0.3)'} !important;
    }
    
    #keep-focus-overlay .reason-input:disabled {
      background: ${darkMode ? '#252525' : '#f5f7fa'} !important;
      cursor: not-allowed !important;
      opacity: 0.7 !important;
    }
    
    #keep-focus-overlay .timer-section {
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: none !important;
    }
    
    #keep-focus-overlay .timer-section.visible {
      display: block !important;
    }
    
    #keep-focus-overlay .timer-display {
      font-size: 48px !important;
      font-weight: 700 !important;
      color: #d4b896 !important;
      margin-bottom: 8px !important;
      display: block !important;
    }
    
    #keep-focus-overlay .timer-label {
      font-size: 14px !important;
      color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card {
      width: 100% !important;
      padding: 14px 28px !important;
      background: #28a745 !important;
      color: white !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      margin-bottom: 12px !important;
      margin-top: 0 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card:hover {
      background: #218838 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3) !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card:active {
      transform: translateY(0) !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card.hidden {
      display: none !important;
    }
    
    #keep-focus-overlay .submit-reason-link {
      width: 100% !important;
      padding: 0 !important;
      background: transparent !important;
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: block !important;
      text-align: center !important;
      text-decoration: none !important;
      opacity: 0.6 !important;
    }
    
    #keep-focus-overlay .submit-reason-link:hover:not(:disabled) {
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
    }
    
    #keep-focus-overlay .submit-reason-link:disabled {
      cursor: not-allowed !important;
    }
    
    #keep-focus-overlay .submit-reason-link.hidden {
      display: none !important;
    }
    
    #keep-focus-overlay .continue-btn {
      width: 100% !important;
      padding: 0 !important;
      background: transparent !important;
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      display: none !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      text-align: center !important;
      text-decoration: none !important;
      opacity: 0.6 !important;
    }
    
    #keep-focus-overlay .continue-btn.visible {
      display: block !important;
    }
    
    #keep-focus-overlay .continue-btn:hover:not(:disabled) {
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
    }
    
    #keep-focus-overlay .continue-btn:disabled {
      cursor: not-allowed !important;
    }
    
    #keep-focus-overlay .quote-section {
      margin-top: 32px !important;
      padding-top: 24px !important;
      border-top: 1px solid ${darkMode ? '#404040' : '#e9ecef'} !important;
      display: block !important;
    }
    
    #keep-focus-overlay .simplified-view {
      text-align: center !important;
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .simplified-view.visible {
      margin-bottom: 32px !important;
      margin-top: 40px !important;
    }
    
    #keep-focus-overlay .quote {
      font-size: 20px !important;
      font-style: italic !important;
      color: ${darkMode ? '#c0c0c0' : '#495057'} !important;
      line-height: 1.8 !important;
      margin-bottom: 16px !important;
      max-width: 600px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      font-weight: 400 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .quote-author {
      font-size: 14px !important;
      color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
      font-weight: 500 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      padding: 18px 28px !important;
      background: #28a745 !important;
      color: white !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      z-index: 1000000 !important;
      box-shadow: 0 -4px 12px rgba(40, 167, 69, 0.3) !important;
      text-align: center !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn:hover {
      background: #218838 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 -6px 16px rgba(40, 167, 69, 0.4) !important;
    }
    
    #keep-focus-overlay .close-tab-btn:active {
      transform: translateY(0) !important;
      box-shadow: 0 -2px 8px rgba(40, 167, 69, 0.3) !important;
    }
  `;
  // Only add style once
  if (!document.getElementById('keep-focus-styles')) {
    document.head.appendChild(style);
  }
  
  // Set document title
  document.title = 'Stay Focused';
  
  // Create body structure within overlay
  const focusBlocker = document.createElement('div');
  focusBlocker.className = 'focus-blocker';
  
  const focusCard = document.createElement('div');
  focusCard.className = 'focus-card';
  
  // Add heading
  const h2 = document.createElement('h2');
  h2.textContent = 'You said you wanted to focus.';
  focusCard.appendChild(h2);
  
  // Add subtitle
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'Why are you visiting this site?';
  focusCard.appendChild(subtitle);
  
  // Add reason input
  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.id = 'reasonInput';
  reasonInput.className = 'reason-input';
  reasonInput.placeholder = "";
  reasonInput.autocomplete = 'off';
  focusCard.appendChild(reasonInput);
  
  // Create close tab button in card (will be added after simplified view)
  const closeTabBtnCard = document.createElement('button');
  closeTabBtnCard.id = 'closeTabBtnCard';
  closeTabBtnCard.className = 'close-tab-btn-card';
  closeTabBtnCard.textContent = 'Close Tab';
  
  // Create small submit reason link (will be added after close tab button)
  const submitReasonLink = document.createElement('button');
  submitReasonLink.id = 'submitReasonLink';
  submitReasonLink.className = 'submit-reason-link';
  submitReasonLink.disabled = true;
  submitReasonLink.textContent = 'Submit Reason';
  
  // Add timer section (hidden initially)
  const timerSection = document.createElement('div');
  timerSection.className = 'timer-section';
  
  const timerDisplay = document.createElement('div');
  timerDisplay.id = 'timerDisplay';
  timerDisplay.className = 'timer-display';
  // Will be set to actual timer duration when timer starts
  timerDisplay.textContent = '15';
  
  const timerLabel = document.createElement('div');
  timerLabel.className = 'timer-label';
  timerLabel.textContent = 'seconds remaining';
  
  timerSection.appendChild(timerDisplay);
  timerSection.appendChild(timerLabel);
  focusCard.appendChild(timerSection);
  
  // Add simplified view section (hidden initially, shown after reason is submitted)
  const simplifiedView = document.createElement('div');
  simplifiedView.id = 'simplifiedView';
  simplifiedView.className = 'simplified-view';
  simplifiedView.style.display = 'none';
  
  const simplifiedQuote = document.createElement('p');
  simplifiedQuote.id = 'simplifiedQuote';
  simplifiedQuote.className = 'quote';
  
  const simplifiedQuoteAuthor = document.createElement('p');
  simplifiedQuoteAuthor.id = 'simplifiedQuoteAuthor';
  simplifiedQuoteAuthor.className = 'quote-author';
  
  simplifiedView.appendChild(simplifiedQuote);
  simplifiedView.appendChild(simplifiedQuoteAuthor);
  
  // Add small continue button (replaces unlock button)
  const continueBtn = document.createElement('button');
  continueBtn.id = 'continueBtn';
  continueBtn.className = 'continue-btn';
  continueBtn.disabled = true;
  continueBtn.textContent = 'Continue';
  
  // Structure: simplified view -> close tab button -> submit reason link -> continue button
  focusCard.appendChild(simplifiedView);
  focusCard.appendChild(closeTabBtnCard);
  focusCard.appendChild(submitReasonLink);
  focusCard.appendChild(continueBtn);
  
  // Assemble structure within overlay
  focusBlocker.appendChild(focusCard);
  overlay.appendChild(focusBlocker);
  
  // Add sticky close tab button at the bottom
  const closeTabBtn = document.createElement('button');
  closeTabBtn.id = 'closeTabBtn';
  closeTabBtn.className = 'close-tab-btn';
  closeTabBtn.textContent = 'Close Tab';
  overlay.appendChild(closeTabBtn);
  
  // Append overlay to body (only if not already present)
  if (!document.getElementById('keep-focus-overlay')) {
    body.appendChild(overlay);
    // Start media observer to pause all videos/audio
    startMediaObserver();
  }
  
  // Close tab button handler (fixed bottom button)
  closeTabBtn.addEventListener('click', () => {
    // Redirect to Google homepage
    window.location.href = 'https://www.google.com';
  });
  
  // Close tab button in card handler
  closeTabBtnCard.addEventListener('click', () => {
    // Redirect to Google homepage
    window.location.href = 'https://www.google.com';
  });
  
  // Timer functionality
  const TIMER_DURATION = Math.floor(Math.random() * (30 - 15 + 1)) + 15; // Random between 15-30 seconds
  const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes
  
  // Focus and productivity quotes
  const focusQuotes = [
    { text: '"The secret of getting ahead is getting started."', author: 'Mark Twain' },
    { text: '"Concentrate all your thoughts upon the work at hand. The sun\'s rays do not burn until brought to a focus."', author: 'Alexander Graham Bell' },
    { text: '"Focus is saying no to a thousand things."', author: 'Steve Jobs' },
    { text: '"The ability to concentrate and to use your time well is everything if you want to succeed in business—or almost anywhere else for that matter."', author: 'Lee Iacocca' },
    { text: '"What you focus on expands, and when you focus on the goodness in your life, you create more of it."', author: 'Oprah Winfrey' },
    { text: '"You can\'t depend on your eyes when your imagination is out of focus."', author: 'Mark Twain' },
    { text: '"The shorter way to do many things is to only do one thing at a time."', author: 'Mozart' },
    { text: '"The successful warrior is the average man, with laser-like focus."', author: 'Bruce Lee' },
    { text: '"Where focus goes, energy flows."', author: 'Tony Robbins' },
    { text: '"The way to get started is to quit talking and begin doing."', author: 'Walt Disney' },
    { text: '"Your attention is one of your most valuable resources. Guard it like a treasure."', author: 'Unknown' },
    { text: '"Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort."', author: 'Paul J. Meyer' },
    { text: '"The successful person has the habit of doing the things failures don\'t like to do."', author: 'Thomas Edison' },
    { text: '"Distraction is the enemy of vision."', author: 'Unknown' },
    { text: '"The more you say no to the things that don\'t matter, the more you can say yes to the things that do."', author: 'Unknown' },
    { text: '"Focus on being productive instead of busy."', author: 'Tim Ferriss' },
    { text: '"The ability to focus attention on important things is a defining characteristic of intelligence."', author: 'Robert J. Shiller' },
    { text: '"Success is the sum of small efforts repeated day in and day out."', author: 'Robert Collier' },
    { text: '"The most precious resource we all have is time."', author: 'Steve Jobs' },
    { text: '"Stay focused, go after your dreams and keep moving toward your goals."', author: 'LL Cool J' }
  ];
  
  let timeRemaining = TIMER_DURATION;
  let timerInterval;
  let timerStarted = false;
  
  // Get random focus quote
  function getRandomQuote() {
    return focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
  }
  
  // Check if submit reason link can be enabled
  function checkSubmitReasonButton() {
    const reason = reasonInput.value.trim();
    submitReasonLink.disabled = reason.length === 0;
  }
  
  // Start timer
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    
    // Set initial timer display to the actual duration
    timeRemaining = TIMER_DURATION;
    timerDisplay.textContent = timeRemaining;
    
    // Hide initial elements (use setProperty with 'important' to override CSS !important rules)
    h2.style.setProperty('display', 'none', 'important');
    subtitle.style.setProperty('display', 'none', 'important');
    reasonInput.style.setProperty('display', 'none', 'important');
    submitReasonLink.style.setProperty('display', 'none', 'important');
    
    // Show simplified view with random quote (timer runs in background, not visible)
    const randomQuote = getRandomQuote();
    simplifiedQuote.textContent = randomQuote.text;
    simplifiedQuoteAuthor.textContent = `— ${randomQuote.author}`;
    simplifiedView.style.setProperty('display', 'block', 'important');
    simplifiedView.classList.add('visible');
    
    // Timer runs in background (not visible)
    timerInterval = setInterval(() => {
      timeRemaining--;
      timerDisplay.textContent = timeRemaining;
      
      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = '0';
        checkIfCanUnlock();
      }
    }, 1000);
  }
  
  // Check if continue button can be enabled
  function checkIfCanUnlock() {
    const reason = reasonInput.value.trim();
    if (timeRemaining <= 0 && reason.length > 0) {
      continueBtn.disabled = false;
      continueBtn.classList.add('visible');
    }
  }
  
  // Reason input handler
  reasonInput.addEventListener('input', () => {
    checkSubmitReasonButton();
  });
  
  // Submit reason link handler
  submitReasonLink.addEventListener('click', () => {
    const reason = reasonInput.value.trim();
    if (reason.length > 0) {
      startTimer();
    }
  });
  
  // Continue button handler
  continueBtn.addEventListener('click', async () => {
    const reason = reasonInput.value.trim();
    if (timeRemaining <= 0 && reason.length > 0) {
      try {
        const result = await chrome.storage.sync.get(['unlockedUntil', 'focusStreak']);
        const unlockedUntil = result.unlockedUntil || {};
        unlockedUntil[siteKey] = Date.now() + UNLOCK_DURATION;
        
        // Reset streak when user unlocks (they chose to visit)
        await chrome.storage.sync.set({ 
          unlockedUntil,
          focusStreak: 0
        });
        
        // Reload the page
        window.location.reload();
      } catch (error) {
        // Extension context invalidated - just reload the page anyway
        if (error.message && error.message.includes('Extension context invalidated')) {
          window.location.reload();
        }
        // Other errors - ignore
      }
    }
  });
  
  // Initialize submit reason button state
  checkSubmitReasonButton();
}

// Show the time limit blocking overlay
async function showTimeLimitOverlay(normalizedUrl, siteKey, limitMinutes) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      showTimeLimitOverlay(normalizedUrl, siteKey, limitMinutes);
    });
    return;
  }
  
  // Check if overlay already exists
  let overlay = document.getElementById('keep-focus-overlay');
  if (overlay) {
    return; // Overlay already shown
  }
  
  // Get dark mode preference
  let result;
  try {
    result = await chrome.storage.sync.get(['darkMode']);
  } catch (error) {
    // Extension context invalidated - use default dark mode
    if (error.message && error.message.includes('Extension context invalidated')) {
      result = { darkMode: false };
    } else {
      throw error; // Re-throw other errors
    }
  }
  const darkMode = result.darkMode || false;
  
  // Hide all existing body content without destroying it
  const body = document.body;
  if (body) {
    // Hide all body children
    Array.from(body.children).forEach(child => {
      if (child.id !== 'keep-focus-overlay') {
        child.style.display = 'none';
      }
    });
    // Also hide any direct text nodes by wrapping content
    body.style.overflow = 'hidden';
  }
  
  // Create overlay container
  overlay = document.createElement('div');
  overlay.id = 'keep-focus-overlay';
  
  // Set dark mode class if enabled
  if (darkMode) {
    overlay.classList.add('dark-mode');
  }
  
  // Apply inline styles directly to overlay element to prevent inheritance
  const bgColor = darkMode ? '#1a1a1a' : '#fefdf7';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  
  overlay.style.cssText = `
    all: unset !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
    font-size: 16px !important;
    font-weight: normal !important;
    font-style: normal !important;
    line-height: normal !important;
    letter-spacing: normal !important;
    text-align: initial !important;
    text-decoration: none !important;
    text-transform: none !important;
    text-indent: 0 !important;
    text-shadow: none !important;
    color: ${textColor} !important;
    background: ${bgColor} !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    min-height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    padding-bottom: 90px !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 999999 !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    direction: ltr !important;
    unicode-bidi: normal !important;
    writing-mode: horizontal-tb !important;
  `;
  
  // Create and inject styles (reuse existing styles from showBlockOverlay)
  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  // Check if styles already exist
  if (!document.getElementById('keep-focus-styles')) {
    style.textContent = `
      /* Reset all inherited styles on the overlay root */
      #keep-focus-overlay {
        all: unset !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
        font-size: 16px !important;
        font-weight: normal !important;
        font-style: normal !important;
        line-height: normal !important;
        letter-spacing: normal !important;
        text-align: initial !important;
        text-decoration: none !important;
        text-transform: none !important;
        text-indent: 0 !important;
        text-shadow: none !important;
        color: ${textColor} !important;
        background: ${bgColor} !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        min-height: 100vh !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 20px !important;
        padding-bottom: 90px !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 999999 !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        direction: ltr !important;
        unicode-bidi: normal !important;
        writing-mode: horizontal-tb !important;
      }
      
      #keep-focus-overlay *,
      #keep-focus-overlay *::before,
      #keep-focus-overlay *::after {
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        font-style: inherit !important;
        line-height: inherit !important;
        color: inherit !important;
        text-align: inherit !important;
        text-decoration: inherit !important;
        text-transform: inherit !important;
        text-indent: 0 !important;
        text-shadow: none !important;
        letter-spacing: inherit !important;
        direction: inherit !important;
        unicode-bidi: inherit !important;
        writing-mode: inherit !important;
      }
      
      #keep-focus-overlay .focus-blocker {
        width: 100% !important;
        max-width: 600px !important;
        display: block !important;
      }
      
      #keep-focus-overlay .focus-card {
        background: ${darkMode ? '#2d2d2d' : 'white'} !important;
        border-radius: 16px !important;
        padding: 40px !important;
        box-shadow: 0 20px 60px ${darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(212, 184, 150, 0.15)'} !important;
        text-align: center !important;
        display: block !important;
      }
      
      #keep-focus-overlay h2 {
        font-size: 40px !important;
        font-weight: 700 !important;
        margin-bottom: 12px !important;
        color: ${darkMode ? '#e0e0e0' : '#212529'} !important;
        letter-spacing: -0.5px !important;
        display: block !important;
        white-space: nowrap !important;
      }
      
      #keep-focus-overlay .subtitle {
        font-size: 16px !important;
        color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
        margin-bottom: 32px !important;
        line-height: 1.5 !important;
        display: block !important;
      }
      
      #keep-focus-overlay .reason-input {
        width: 100% !important;
        padding: 14px !important;
        border: 2px solid ${darkMode ? 'rgba(64, 64, 64, 0.3)' : 'rgba(233, 236, 239, 0.3)'} !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        margin-bottom: 20px !important;
        transition: border-color 0.2s !important;
        font-family: inherit !important;
        display: none !important;
        background: ${darkMode ? '#2d2d2d' : 'white'} !important;
        color: ${darkMode ? '#e0e0e0' : '#333'} !important;
      }
      
      #keep-focus-overlay .reason-input.visible {
        display: block !important;
      }
      
      #keep-focus-overlay .reason-input:focus {
        outline: none !important;
        border-color: ${darkMode ? 'rgba(64, 64, 64, 0.3)' : 'rgba(233, 236, 239, 0.3)'} !important;
      }
      
      #keep-focus-overlay .reason-input:disabled {
        background: ${darkMode ? '#252525' : '#f5f7fa'} !important;
        cursor: not-allowed !important;
        opacity: 0.7 !important;
      }
      
      #keep-focus-overlay .timer-section {
        margin-bottom: 0 !important;
        margin-top: 0 !important;
        display: none !important;
      }
      
      #keep-focus-overlay .timer-section.visible {
        display: block !important;
      }
      
      #keep-focus-overlay .timer-display {
        font-size: 48px !important;
        font-weight: 700 !important;
        color: #d4b896 !important;
        margin-bottom: 8px !important;
        display: block !important;
      }
      
      #keep-focus-overlay .timer-label {
        font-size: 14px !important;
        color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
        display: block !important;
      }
      
      #keep-focus-overlay .close-tab-btn-card {
        width: 100% !important;
        padding: 14px 28px !important;
        background: #28a745 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-family: inherit !important;
        margin-bottom: 12px !important;
        margin-top: 0 !important;
        display: block !important;
      }
      
      #keep-focus-overlay .close-tab-btn-card:hover {
        background: #218838 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3) !important;
      }
      
      #keep-focus-overlay .close-tab-btn-card:active {
        transform: translateY(0) !important;
      }
      
      #keep-focus-overlay .close-tab-btn-card.hidden {
        display: none !important;
      }
      
      #keep-focus-overlay .more-time-btn {
        width: 100% !important;
        padding: 0 !important;
        background: transparent !important;
        color: ${darkMode ? '#606060' : '#adb5bd'} !important;
        border: none !important;
        border-radius: 0 !important;
        font-size: 12px !important;
        font-weight: 400 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-family: inherit !important;
        margin-bottom: 0 !important;
        margin-top: 0 !important;
        display: block !important;
        text-align: center !important;
        text-decoration: none !important;
        opacity: 0.6 !important;
      }
      
      #keep-focus-overlay .more-time-btn:hover:not(:disabled) {
        color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      }
      
      #keep-focus-overlay .more-time-btn:disabled {
        cursor: not-allowed !important;
      }
      
      #keep-focus-overlay .more-time-btn.hidden {
        display: none !important;
      }
      
      #keep-focus-overlay .submit-reason-link {
        width: 100% !important;
        padding: 0 !important;
        background: transparent !important;
        color: ${darkMode ? '#606060' : '#adb5bd'} !important;
        border: none !important;
        border-radius: 0 !important;
        font-size: 12px !important;
        font-weight: 400 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-family: inherit !important;
        margin-bottom: 0 !important;
        margin-top: 0 !important;
        display: none !important;
        text-align: center !important;
        text-decoration: none !important;
        opacity: 0.6 !important;
      }
      
      #keep-focus-overlay .submit-reason-link.visible {
        display: block !important;
      }
      
      #keep-focus-overlay .submit-reason-link:hover:not(:disabled) {
        color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      }
      
      #keep-focus-overlay .submit-reason-link:disabled {
        cursor: not-allowed !important;
      }
      
      #keep-focus-overlay .submit-reason-link.hidden {
        display: none !important;
      }
      
      #keep-focus-overlay .continue-btn {
        width: 100% !important;
        padding: 0 !important;
        background: transparent !important;
        color: ${darkMode ? '#606060' : '#adb5bd'} !important;
        border: none !important;
        border-radius: 0 !important;
        font-size: 12px !important;
        font-weight: 400 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-family: inherit !important;
        display: none !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        text-align: center !important;
        text-decoration: none !important;
        opacity: 0.6 !important;
      }
      
      #keep-focus-overlay .continue-btn.visible {
        display: block !important;
      }
      
      #keep-focus-overlay .continue-btn:hover:not(:disabled) {
        color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      }
      
      #keep-focus-overlay .continue-btn:disabled {
        cursor: not-allowed !important;
      }
      
      #keep-focus-overlay .quote-section {
        margin-top: 32px !important;
        padding-top: 24px !important;
        border-top: 1px solid ${darkMode ? '#404040' : '#e9ecef'} !important;
        display: block !important;
      }
      
      #keep-focus-overlay .simplified-view {
        text-align: center !important;
        margin-bottom: 0 !important;
        margin-top: 0 !important;
        display: block !important;
      }
      
      #keep-focus-overlay .simplified-view.visible {
        margin-bottom: 32px !important;
        margin-top: 40px !important;
      }
      
      #keep-focus-overlay .quote {
        font-size: 20px !important;
        font-style: italic !important;
        color: ${darkMode ? '#c0c0c0' : '#495057'} !important;
        line-height: 1.8 !important;
        margin-bottom: 16px !important;
        max-width: 600px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        font-weight: 400 !important;
        display: block !important;
      }
      
      #keep-focus-overlay .quote-author {
        font-size: 14px !important;
        color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
        font-weight: 500 !important;
        display: block !important;
      }
      
      #keep-focus-overlay .close-tab-btn {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        padding: 18px 28px !important;
        background: #28a745 !important;
        color: white !important;
        border: none !important;
        border-radius: 0 !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-family: inherit !important;
        z-index: 1000000 !important;
        box-shadow: 0 -4px 12px rgba(40, 167, 69, 0.3) !important;
        text-align: center !important;
        display: block !important;
      }
      
      #keep-focus-overlay .close-tab-btn:hover {
        background: #218838 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 -6px 16px rgba(40, 167, 69, 0.4) !important;
      }
      
      #keep-focus-overlay .close-tab-btn:active {
        transform: translateY(0) !important;
        box-shadow: 0 -2px 8px rgba(40, 167, 69, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Set document title
  document.title = 'Stay Focused';
  
  // Create body structure within overlay
  const focusBlocker = document.createElement('div');
  focusBlocker.className = 'focus-blocker';
  
  const focusCard = document.createElement('div');
  focusCard.className = 'focus-card';
  
  // Add heading
  const h2 = document.createElement('h2');
  h2.textContent = 'You\'ve reached your time limit';
  focusCard.appendChild(h2);
  
  // Add subtitle (doesn't suggest getting more time)
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'Time to step away and refocus.';
  focusCard.appendChild(subtitle);
  
  // Add reason input (hidden initially)
  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.id = 'reasonInput';
  reasonInput.className = 'reason-input';
  reasonInput.placeholder = "";
  reasonInput.autocomplete = 'off';
  focusCard.appendChild(reasonInput);
  
  // Create close tab button in card
  const closeTabBtnCard = document.createElement('button');
  closeTabBtnCard.id = 'closeTabBtnCard';
  closeTabBtnCard.className = 'close-tab-btn-card';
  closeTabBtnCard.textContent = 'Close Tab';
  
  // Create "More Time" button (shown initially)
  const moreTimeBtn = document.createElement('button');
  moreTimeBtn.id = 'moreTimeBtn';
  moreTimeBtn.className = 'more-time-btn';
  moreTimeBtn.textContent = 'More Time';
  
  // Create submit reason link (hidden initially, shown after "More Time" is clicked)
  const submitReasonLink = document.createElement('button');
  submitReasonLink.id = 'submitReasonLink';
  submitReasonLink.className = 'submit-reason-link';
  submitReasonLink.disabled = true;
  submitReasonLink.textContent = 'Submit Reason';
  
  // Add timer section (hidden initially)
  const timerSection = document.createElement('div');
  timerSection.className = 'timer-section';
  
  const timerDisplay = document.createElement('div');
  timerDisplay.id = 'timerDisplay';
  timerDisplay.className = 'timer-display';
  timerDisplay.textContent = '15';
  
  const timerLabel = document.createElement('div');
  timerLabel.className = 'timer-label';
  timerLabel.textContent = 'seconds remaining';
  
  timerSection.appendChild(timerDisplay);
  timerSection.appendChild(timerLabel);
  focusCard.appendChild(timerSection);
  
  // Add simplified view section (hidden initially, shown after reason is submitted)
  const simplifiedView = document.createElement('div');
  simplifiedView.id = 'simplifiedView';
  simplifiedView.className = 'simplified-view';
  simplifiedView.style.display = 'none';
  
  const simplifiedQuote = document.createElement('p');
  simplifiedQuote.id = 'simplifiedQuote';
  simplifiedQuote.className = 'quote';
  
  const simplifiedQuoteAuthor = document.createElement('p');
  simplifiedQuoteAuthor.id = 'simplifiedQuoteAuthor';
  simplifiedQuoteAuthor.className = 'quote-author';
  
  simplifiedView.appendChild(simplifiedQuote);
  simplifiedView.appendChild(simplifiedQuoteAuthor);
  
  // Add "Add 5 more mins" button (replaces continue button)
  const continueBtn = document.createElement('button');
  continueBtn.id = 'continueBtn';
  continueBtn.className = 'continue-btn';
  continueBtn.disabled = true;
  continueBtn.textContent = 'Add 5 more mins';
  
  // Structure: simplified view -> close tab button -> more time button -> submit reason link -> continue button
  focusCard.appendChild(simplifiedView);
  focusCard.appendChild(closeTabBtnCard);
  focusCard.appendChild(moreTimeBtn);
  focusCard.appendChild(submitReasonLink);
  focusCard.appendChild(continueBtn);
  
  // Assemble structure within overlay
  focusBlocker.appendChild(focusCard);
  overlay.appendChild(focusBlocker);
  
  // Add sticky close tab button at the bottom
  const closeTabBtn = document.createElement('button');
  closeTabBtn.id = 'closeTabBtn';
  closeTabBtn.className = 'close-tab-btn';
  closeTabBtn.textContent = 'Close Tab';
  overlay.appendChild(closeTabBtn);
  
  // Append overlay to body (only if not already present)
  if (!document.getElementById('keep-focus-overlay')) {
    body.appendChild(overlay);
    // Start media observer to pause all videos/audio
    startMediaObserver();
  }
  
  // Close tab button handler (fixed bottom button)
  closeTabBtn.addEventListener('click', () => {
    window.location.href = 'https://www.google.com';
  });
  
  // Close tab button in card handler
  closeTabBtnCard.addEventListener('click', () => {
    window.location.href = 'https://www.google.com';
  });
  
  // Timer functionality
  const TIMER_DURATION = Math.floor(Math.random() * (30 - 15 + 1)) + 15; // Random between 15-30 seconds
  
  // Focus and productivity quotes (same as regular blocking)
  const focusQuotes = [
    { text: '"The secret of getting ahead is getting started."', author: 'Mark Twain' },
    { text: '"Concentrate all your thoughts upon the work at hand. The sun\'s rays do not burn until brought to a focus."', author: 'Alexander Graham Bell' },
    { text: '"Focus is saying no to a thousand things."', author: 'Steve Jobs' },
    { text: '"The ability to concentrate and to use your time well is everything if you want to succeed in business—or almost anywhere else for that matter."', author: 'Lee Iacocca' },
    { text: '"What you focus on expands, and when you focus on the goodness in your life, you create more of it."', author: 'Oprah Winfrey' },
    { text: '"You can\'t depend on your eyes when your imagination is out of focus."', author: 'Mark Twain' },
    { text: '"The shorter way to do many things is to only do one thing at a time."', author: 'Mozart' },
    { text: '"The successful warrior is the average man, with laser-like focus."', author: 'Bruce Lee' },
    { text: '"Where focus goes, energy flows."', author: 'Tony Robbins' },
    { text: '"The way to get started is to quit talking and begin doing."', author: 'Walt Disney' },
    { text: '"Your attention is one of your most valuable resources. Guard it like a treasure."', author: 'Unknown' },
    { text: '"Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort."', author: 'Paul J. Meyer' },
    { text: '"The successful person has the habit of doing the things failures don\'t like to do."', author: 'Thomas Edison' },
    { text: '"Distraction is the enemy of vision."', author: 'Unknown' },
    { text: '"The more you say no to the things that don\'t matter, the more you can say yes to the things that do."', author: 'Unknown' },
    { text: '"Focus on being productive instead of busy."', author: 'Tim Ferriss' },
    { text: '"The ability to focus attention on important things is a defining characteristic of intelligence."', author: 'Robert J. Shiller' },
    { text: '"Success is the sum of small efforts repeated day in and day out."', author: 'Robert Collier' },
    { text: '"The most precious resource we all have is time."', author: 'Steve Jobs' },
    { text: '"Stay focused, go after your dreams and keep moving toward your goals."', author: 'LL Cool J' }
  ];
  
  let timeRemaining = TIMER_DURATION;
  let timerInterval;
  let timerStarted = false;
  
  // Get random focus quote
  function getRandomQuote() {
    return focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
  }
  
  // Check if submit reason link can be enabled
  function checkSubmitReasonButton() {
    const reason = reasonInput.value.trim();
    submitReasonLink.disabled = reason.length === 0;
  }
  
  // Start timer
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    
    // Set initial timer display to the actual duration
    timeRemaining = TIMER_DURATION;
    timerDisplay.textContent = timeRemaining;
    
    // Hide initial elements
    h2.style.setProperty('display', 'none', 'important');
    subtitle.style.setProperty('display', 'none', 'important');
    reasonInput.style.setProperty('display', 'none', 'important');
    submitReasonLink.style.setProperty('display', 'none', 'important');
    moreTimeBtn.style.setProperty('display', 'none', 'important');
    
    // Show simplified view with random quote
    const randomQuote = getRandomQuote();
    simplifiedQuote.textContent = randomQuote.text;
    simplifiedQuoteAuthor.textContent = `— ${randomQuote.author}`;
    simplifiedView.style.setProperty('display', 'block', 'important');
    simplifiedView.classList.add('visible');
    
    // Timer runs in background
    timerInterval = setInterval(() => {
      timeRemaining--;
      timerDisplay.textContent = timeRemaining;
      
      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = '0';
        checkIfCanAddTime();
      }
    }, 1000);
  }
  
  // Check if "Add 5 more mins" button can be enabled
  function checkIfCanAddTime() {
    const reason = reasonInput.value.trim();
    if (timeRemaining <= 0 && reason.length > 0) {
      continueBtn.disabled = false;
      continueBtn.classList.add('visible');
    }
  }
  
  // "More Time" button handler
  moreTimeBtn.addEventListener('click', () => {
    // Hide "More Time" button
    moreTimeBtn.classList.add('hidden');
    // Show reason input and submit button
    reasonInput.classList.add('visible');
    submitReasonLink.classList.add('visible');
    reasonInput.focus();
  });
  
  // Reason input handler
  reasonInput.addEventListener('input', () => {
    checkSubmitReasonButton();
  });
  
  // Submit reason link handler
  submitReasonLink.addEventListener('click', () => {
    const reason = reasonInput.value.trim();
    if (reason.length > 0) {
      startTimer();
    }
  });
  
  // "Add 5 more mins" button handler
  continueBtn.addEventListener('click', async () => {
    const reason = reasonInput.value.trim();
    if (timeRemaining <= 0 && reason.length > 0) {
      try {
        // Get current tracking data
        const result = await chrome.storage.sync.get(['timeTracking', 'timeLimits']);
        const timeTracking = result.timeTracking || {};
        const timeLimits = result.timeLimits || [];
        
        // Find the limit for this site
        const limitObj = timeLimits.find(l => l.url === siteKey);
        const limitMs = limitObj ? limitObj.limitMinutes * 60 * 1000 : 0;
        
        if (timeTracking[siteKey]) {
          // Give user 5 more minutes by setting timeSpent so they have 5 minutes available
          const currentDate = getCurrentDateString();
          const fiveMinutesMs = 5 * 60 * 1000;
          
          if (timeTracking[siteKey].date !== currentDate) {
            // Reset for new day - start with 0 time spent
            timeTracking[siteKey] = {
              date: currentDate,
              timeSpent: 0,
              lastActive: Date.now()
            };
          } else {
            // Set timeSpent to (limit - 5 minutes) to give them 5 minutes available
            // If limit is less than 5 minutes, set to 0 to give them the full limit
            const newTimeSpent = Math.max(0, limitMs - fiveMinutesMs);
            timeTracking[siteKey].timeSpent = newTimeSpent;
            timeTracking[siteKey].lastActive = Date.now();
          }
          
          await chrome.storage.sync.set({ timeTracking });
        }
        
        // Reload the page to resume tracking
        window.location.reload();
      } catch (error) {
        // Extension context invalidated - just reload the page anyway
        if (error.message && error.message.includes('Extension context invalidated')) {
          window.location.reload();
        }
        // Other errors - ignore
      }
    }
  });
  
  // Initialize submit reason button state (hidden initially)
  checkSubmitReasonButton();
}

