// Main content script entry point - modular version
// Replaces the old monolithic content.js with a clean modular structure

import { checkAndBlockSite, stopUnlockExpirationCheck } from '../content/blocking.js';
import { setupUrlChangeDetection } from '../content/url-change-detection.js';
import { stopTimeTracking } from '../content/time-tracking.js';

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
