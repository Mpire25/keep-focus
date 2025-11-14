// Main content script entry point - modular version
// Replaces the old monolithic content.js with a clean modular structure

// Initialize on page load
(async function() {
  'use strict';
  
  // Use dynamic imports with chrome.runtime.getURL() for proper extension URL resolution
  const { checkAndBlockSite, stopUnlockExpirationCheck } = await import(chrome.runtime.getURL('content/blocking.js'));
  const { setupUrlChangeDetection } = await import(chrome.runtime.getURL('content/url-change-detection.js'));
  const { stopTimeTracking } = await import(chrome.runtime.getURL('content/time-tracking.js'));
  
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
