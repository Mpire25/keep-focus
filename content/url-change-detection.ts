// URL change detection for SPAs

import { checkAndBlockSite, stopUnlockExpirationCheck } from './blocking.js';
import { stopTimeTracking } from './time-tracking.js';
import { initElementBlocking, stopElementObserver } from './element-blocking.js';

// Extend Window interface for our custom property
declare global {
  interface Window {
    _keepFocusUrlDetectionSetup?: boolean;
  }
}

// Set up URL change detection for SPAs
export function setupUrlChangeDetection(): void {
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
      // Stop unlock expiration check, time tracking, and element observer when URL changes
      stopUnlockExpirationCheck();
      stopTimeTracking();
      stopElementObserver();
      checkAndBlockSite();
      // Re-initialize element blocking for new page
      initElementBlocking();
    }
  }, 500); // Check every 500ms
  
  // Listen for popstate (back/forward button)
  window.addEventListener('popstate', () => {
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    stopElementObserver();
    checkAndBlockSite();
    // Re-initialize element blocking for new page
    initElementBlocking();
  });

  // Intercept pushState and replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args: Parameters<typeof history.pushState>) {
    originalPushState.apply(history, args);
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    stopElementObserver();
    // Use setTimeout to allow the page to update
    setTimeout(() => {
      checkAndBlockSite();
      initElementBlocking();
    }, 100);
  };

  history.replaceState = function(...args: Parameters<typeof history.replaceState>) {
    originalReplaceState.apply(history, args);
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    stopElementObserver();
    // Use setTimeout to allow the page to update
    setTimeout(() => {
      checkAndBlockSite();
      initElementBlocking();
    }, 100);
  };

  // Also listen for hash changes
  window.addEventListener('hashchange', () => {
    lastUrl = window.location.href;
    stopUnlockExpirationCheck();
    stopTimeTracking();
    stopElementObserver();
    checkAndBlockSite();
    // Re-initialize element blocking for new page
    initElementBlocking();
  });
}

