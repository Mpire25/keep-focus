// Content script that runs on all pages to block sites

(async function() {
  'use strict';

  // Get current URL and normalize it
  const currentUrl = window.location.href;
  const normalizedUrl = normalizeUrl(currentUrl);
  
  // Get blocked sites and unlock status from storage
  const result = await chrome.storage.sync.get(['blockedSites', 'unlockedUntil', 'focusStreak']);
  const blockedSites = result.blockedSites || [];
  const unlockedUntil = result.unlockedUntil || {};
  const focusStreak = result.focusStreak || 0;

  // Check if current site is blocked
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const isBlocked = blockedSites.some(blockedSite => {
    // Match if the normalized URL contains the blocked site pattern
    // or if the hostnames match
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    
    return normalizedUrl.includes(blockedSite) || 
           blockedSite === normalizedUrl ||
           currentHostname === blockedHostname ||
           currentHostname.includes(blockedHostname) ||
           blockedHostname.includes(currentHostname);
  });

  if (!isBlocked) {
    return; // Site is not blocked, do nothing
  }

  // Check if site is currently unlocked
  const siteKey = getSiteKey(normalizedUrl, blockedSites);
  const unlockTimestamp = unlockedUntil[siteKey];
  const now = Date.now();
  const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

  if (unlockTimestamp && now < unlockTimestamp) {
    // Site is still unlocked, do nothing
    return;
  }

  // Site is blocked - show overlay
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
    chrome.storage.sync.set({ focusStreak: newStreak });
  }
  
  showBlockOverlay(normalizedUrl, siteKey, newStreak);
})();

// Normalize URL for consistent matching
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    let normalized = urlObj.hostname + urlObj.pathname;
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    return normalized;
  } catch (e) {
    return url;
  }
}

// Get site key for storage
function getSiteKey(normalizedUrl, blockedSites) {
  // Find the matching blocked site pattern
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  
  for (const blockedSite of blockedSites) {
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    
    if (normalizedUrl.includes(blockedSite) || 
        blockedSite === normalizedUrl ||
        currentHostname === blockedHostname ||
        currentHostname.includes(blockedHostname) ||
        blockedHostname.includes(currentHostname)) {
      return blockedSite;
    }
  }
  return currentHostname; // Return domain as fallback
}

// Show the blocking overlay
function showBlockOverlay(normalizedUrl, siteKey, currentStreak) {
  // Prevent page content from loading
  document.documentElement.innerHTML = '';
  
  // Create overlay HTML
  const overlayHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Stay Focused</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #fefdf7;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: #333;
        }
        
        .focus-blocker {
          width: 100%;
          max-width: 500px;
        }
        
        .focus-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(212, 184, 150, 0.15);
          text-align: center;
        }
        
        .streak-display {
          margin-bottom: 24px;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 8px;
          font-size: 14px;
          color: #495057;
        }
        
        .streak-display strong {
          color: #d4b896;
          font-weight: 600;
        }
        
        .streak-icon {
          font-size: 18px;
          margin-right: 4px;
        }
        
        h2 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #212529;
          letter-spacing: -0.5px;
        }
        
        .subtitle {
          font-size: 16px;
          color: #6c757d;
          margin-bottom: 32px;
          line-height: 1.5;
        }
        
        .reason-input {
          width: 100%;
          padding: 14px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          transition: border-color 0.2s;
          font-family: inherit;
        }
        
        .reason-input:focus {
          outline: none;
          border-color: #d4b896;
        }
        
        .timer-section {
          margin-bottom: 24px;
        }
        
        .timer-display {
          font-size: 48px;
          font-weight: 700;
          color: #d4b896;
          margin-bottom: 8px;
        }
        
        .timer-label {
          font-size: 14px;
          color: #6c757d;
        }
        
        .unlock-btn {
          width: 100%;
          padding: 14px 28px;
          background: #d4b896;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        
        .unlock-btn:hover:not(:disabled) {
          background: #c9a883;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(212, 184, 150, 0.3);
        }
        
        .unlock-btn:disabled {
          background: #adb5bd;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .unlock-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .quote-section {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e9ecef;
        }
        
        .quote {
          font-size: 14px;
          font-style: italic;
          color: #6c757d;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        
        .quote-author {
          font-size: 12px;
          color: #adb5bd;
        }
        
        .close-tab-hint {
          margin-top: 20px;
          font-size: 13px;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <div class="focus-blocker">
        <div class="focus-card">
          ${currentStreak > 0 ? `
            <div class="streak-display">
              <span class="streak-icon">🔥</span>
              Focus streak: <strong>${currentStreak}</strong> sessions strong!
            </div>
          ` : ''}
          
          <h2>You said you wanted to focus.</h2>
          <p class="subtitle">Why are you visiting this site?</p>
          
          <input 
            type="text" 
            id="reasonInput" 
            class="reason-input" 
            placeholder="Type your reason (e.g., 'Checking DMs for work')"
            autocomplete="off"
          />
          
          <div class="timer-section">
            <div class="timer-display" id="timerDisplay">15</div>
            <div class="timer-label">seconds remaining</div>
          </div>
          
          <button id="unlockBtn" class="unlock-btn" disabled>
            Continue (15s)
          </button>
          
          <div class="close-tab-hint">
            Close this tab to increase your focus streak
          </div>
          
          <div class="quote-section">
            <p class="quote">"Every action you take is a vote for the type of person you wish to become."</p>
            <p class="quote-author">— James Clear, Atomic Habits</p>
          </div>
        </div>
      </div>
      
      <script>
        (function() {
          const TIMER_DURATION = 15; // seconds
          const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes
          
          let timeRemaining = TIMER_DURATION;
          let timerInterval;
          let hasTypedReason = false;
          
          const reasonInput = document.getElementById('reasonInput');
          const unlockBtn = document.getElementById('unlockBtn');
          const timerDisplay = document.getElementById('timerDisplay');
          
          // Start timer
          function startTimer() {
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
          
          // Check if unlock button can be enabled
          function checkIfCanUnlock() {
            const reason = reasonInput.value.trim();
            if (timeRemaining <= 0 && reason.length > 0) {
              unlockBtn.disabled = false;
              unlockBtn.textContent = 'Continue';
            }
          }
          
          // Reason input handler
          reasonInput.addEventListener('input', (e) => {
            hasTypedReason = e.target.value.trim().length > 0;
            checkIfCanUnlock();
          });
          
          // Unlock button handler
          unlockBtn.addEventListener('click', async () => {
            const reason = reasonInput.value.trim();
            if (timeRemaining <= 0 && reason.length > 0) {
              // Save unlock timestamp
              const siteKey = '${siteKey}';
              const unlockTimestamp = Date.now() + UNLOCK_DURATION;
              
              try {
                const result = await chrome.storage.sync.get(['unlockedUntil', 'focusStreak']);
                const unlockedUntil = result.unlockedUntil || {};
                unlockedUntil[siteKey] = unlockTimestamp;
                
                // Reset streak when user unlocks (they chose to visit)
                await chrome.storage.sync.set({ 
                  unlockedUntil,
                  focusStreak: 0
                });
                
                // Reload the page
                window.location.reload();
              } catch (error) {
                console.error('Error unlocking site:', error);
              }
            }
          });
          
          // Start the timer
          startTimer();
        })();
      </script>
    </body>
    </html>
  `;
  
  // Write the overlay HTML
  document.open();
  document.write(overlayHTML);
  document.close();
}

