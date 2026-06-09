// Main content script entry point - modular version
// Replaces the old monolithic content.js with a clean modular structure

// Initialize on page load
(async function() {
  'use strict';
  
  // Use dynamic imports with chrome.runtime.getURL() for proper extension URL resolution
  const { checkAndBlockSite, stopUnlockExpirationCheck } = await import(chrome.runtime.getURL('dist/content/blocking.js'));
  const { setupUrlChangeDetection } = await import(chrome.runtime.getURL('dist/content/url-change-detection.js'));
  const { stopTimeTracking } = await import(chrome.runtime.getURL('dist/content/time-tracking.js'));
  const { initElementBlocking, stopElementObserver } = await import(chrome.runtime.getURL('dist/content/element-blocking.js'));
  const { initScreenTimeTracking, stopScreenTimeTracking } = await import(chrome.runtime.getURL('dist/content/screen-time-tracking.js'));
  const { initTimeToast, stopTimeToast } = await import(chrome.runtime.getURL('dist/content/time-toast.js'));

  // Run initial check
  await checkAndBlockSite();

  // Initialize element blocking
  await initElementBlocking();

  // Start screen time tracking (independent of blocking/limits)
  await initScreenTimeTracking();

  // Set up the hold-to-show time-remaining toast
  await initTimeToast();

  // Set up URL change detection
  setupUrlChangeDetection();

  // Stop unlock expiration check, time tracking, and element observer when page unloads
  window.addEventListener('beforeunload', () => {
    stopUnlockExpirationCheck();
    stopTimeTracking();
    stopScreenTimeTracking();
    stopElementObserver();
    stopTimeToast();
  });
})();

