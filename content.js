// Content script that runs on all pages to block sites

// Global variable to track unlock expiration check interval
let unlockExpirationCheckInterval = null;

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
    result = await chrome.storage.sync.get(['blockedSites', 'unlockedUntil', 'focusStreak']);
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

  // Check if current site is blocked
  const isBlocked = isSiteBlocked(normalizedUrl, blockedSites);

  if (!isBlocked) {
    // Remove overlay if it exists (in case URL changed from blocked to unblocked)
    removeOverlayAndRestoreBody();
    // Stop unlock expiration check since site is not blocked
    stopUnlockExpirationCheck();
    return; // Site is not blocked, do nothing
  }

  // Check if site is currently unlocked
  const siteKey = getSiteKey(normalizedUrl, blockedSites);
  
  const unlockTimestamp = unlockedUntil[siteKey];
  const now = Date.now();

  if (unlockTimestamp && now < unlockTimestamp) {
    // Site is still unlocked, do nothing
    // Remove overlay if it exists (in case URL changed and site is now unlocked)
    removeOverlayAndRestoreBody();
    // Start periodic check for unlock expiration
    startUnlockExpirationCheck();
    return;
  }

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
      // Stop unlock expiration check when URL changes
      stopUnlockExpirationCheck();
      checkAndBlockSite();
    }
  }, 500); // Check every 500ms
  
  // Listen for popstate (back/forward button)
  window.addEventListener('popstate', () => {
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    checkAndBlockSite();
  });

  // Intercept pushState and replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    // Use setTimeout to allow the page to update
    setTimeout(() => checkAndBlockSite(), 100);
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    // Use setTimeout to allow the page to update
    setTimeout(() => checkAndBlockSite(), 100);
  };

  // Also listen for hash changes
  window.addEventListener('hashchange', () => {
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
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
  
  // Stop unlock expiration check when page unloads
  window.addEventListener('beforeunload', () => {
    stopUnlockExpirationCheck();
  });
})();

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
      max-width: 500px !important;
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
    
    #keep-focus-overlay .streak-display {
      margin-bottom: 24px !important;
      padding: 12px !important;
      background: ${darkMode ? '#252525' : '#f5f7fa'} !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      color: ${darkMode ? '#c0c0c0' : '#495057'} !important;
      display: block !important;
    }
    
    #keep-focus-overlay .streak-display strong {
      color: #d4b896 !important;
      font-weight: 600 !important;
    }
    
    #keep-focus-overlay .streak-icon {
      font-size: 18px !important;
      margin-right: 4px !important;
      display: inline !important;
    }
    
    #keep-focus-overlay h2 {
      font-size: 28px !important;
      font-weight: 700 !important;
      margin-bottom: 12px !important;
      color: ${darkMode ? '#e0e0e0' : '#212529'} !important;
      letter-spacing: -0.5px !important;
      display: block !important;
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
      border: 2px solid ${darkMode ? '#404040' : '#e9ecef'} !important;
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
      border-color: #d4b896 !important;
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
  
  // Add streak display if applicable
  if (currentStreak > 0) {
    const streakDisplay = document.createElement('div');
    streakDisplay.className = 'streak-display';
    streakDisplay.innerHTML = `
      <span class="streak-icon">🔥</span>
      Focus streak: <strong>${currentStreak}</strong> sessions strong!
    `;
    focusCard.appendChild(streakDisplay);
  }
  
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
  reasonInput.placeholder = "Type your reason (e.g., 'Checking DMs for work')";
  reasonInput.autocomplete = 'off';
  focusCard.appendChild(reasonInput);
  
  // Create close tab button in card (will be added after simplified view)
  const closeTabBtnCard = document.createElement('button');
  closeTabBtnCard.id = 'closeTabBtnCard';
  closeTabBtnCard.className = 'close-tab-btn-card';
  closeTabBtnCard.textContent = 'Stay Focused - Close Tab';
  
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
  closeTabBtn.textContent = 'Stay Focused - Close Tab';
  overlay.appendChild(closeTabBtn);
  
  // Append overlay to body (only if not already present)
  if (!document.getElementById('keep-focus-overlay')) {
    body.appendChild(overlay);
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
  const TIMER_DURATION = 15; // seconds
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
    
    // Hide initial elements (use setProperty with 'important' to override CSS !important rules)
    if (currentStreak > 0) {
      const streakEl = focusCard.querySelector('.streak-display');
      if (streakEl) streakEl.style.setProperty('display', 'none', 'important');
    }
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

