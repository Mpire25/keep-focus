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
  
  // Create and inject styles
  const style = document.createElement('style');
  style.textContent = `
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
      padding-bottom: 90px;
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
    
    .reason-input:disabled {
      background: #f5f7fa;
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    .timer-section {
      margin-bottom: 24px;
      display: none;
    }
    
    .timer-section.visible {
      display: block;
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
    
    .submit-reason-btn {
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
      margin-bottom: 20px;
    }
    
    .submit-reason-btn:hover:not(:disabled) {
      background: #c9a883;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(212, 184, 150, 0.3);
    }
    
    .submit-reason-btn:disabled {
      background: #adb5bd;
      cursor: not-allowed;
      opacity: 0.6;
    }
    
    .submit-reason-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    
    .submit-reason-btn.hidden {
      display: none;
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
      display: none;
    }
    
    .unlock-btn.visible {
      display: block;
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
    
    .close-tab-btn {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      padding: 18px 28px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 0;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      z-index: 1000;
      box-shadow: 0 -4px 12px rgba(40, 167, 69, 0.3);
    }
    
    .close-tab-btn:hover {
      background: #218838;
      transform: translateY(-2px);
      box-shadow: 0 -6px 16px rgba(40, 167, 69, 0.4);
    }
    
    .close-tab-btn:active {
      transform: translateY(0);
      box-shadow: 0 -2px 8px rgba(40, 167, 69, 0.3);
    }
  `;
  document.head.appendChild(style);
  
  // Set document title
  document.title = 'Stay Focused';
  
  // Create body structure
  const body = document.body;
  
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
  
  // Add submit reason button
  const submitReasonBtn = document.createElement('button');
  submitReasonBtn.id = 'submitReasonBtn';
  submitReasonBtn.className = 'submit-reason-btn';
  submitReasonBtn.disabled = true;
  submitReasonBtn.textContent = 'Submit Reason';
  focusCard.appendChild(submitReasonBtn);
  
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
  
  // Add unlock button (hidden initially)
  const unlockBtn = document.createElement('button');
  unlockBtn.id = 'unlockBtn';
  unlockBtn.className = 'unlock-btn';
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Continue';
  focusCard.appendChild(unlockBtn);
  
  // Add quote section
  const quoteSection = document.createElement('div');
  quoteSection.className = 'quote-section';
  
  const quote = document.createElement('p');
  quote.className = 'quote';
  quote.textContent = '"Every action you take is a vote for the type of person you wish to become."';
  
  const quoteAuthor = document.createElement('p');
  quoteAuthor.className = 'quote-author';
  quoteAuthor.textContent = '— James Clear, Atomic Habits';
  
  quoteSection.appendChild(quote);
  quoteSection.appendChild(quoteAuthor);
  focusCard.appendChild(quoteSection);
  
  // Assemble structure
  focusBlocker.appendChild(focusCard);
  body.appendChild(focusBlocker);
  
  // Add sticky close tab button at the bottom
  const closeTabBtn = document.createElement('button');
  closeTabBtn.id = 'closeTabBtn';
  closeTabBtn.className = 'close-tab-btn';
  closeTabBtn.textContent = 'Stay Focused - Close Tab';
  body.appendChild(closeTabBtn);
  
  // Close tab button handler
  closeTabBtn.addEventListener('click', () => {
    // Try to close the tab, if that doesn't work, redirect to Google
    window.close();
    
    // If window.close() doesn't work (e.g., tab wasn't opened by script),
    // redirect to Google homepage after a short delay
    setTimeout(() => {
      window.location.href = 'https://www.google.com';
    }, 100);
  });
  
  // Timer functionality
  const TIMER_DURATION = 15; // seconds
  const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes
  
  let timeRemaining = TIMER_DURATION;
  let timerInterval;
  let timerStarted = false;
  
  // Check if submit reason button can be enabled
  function checkSubmitReasonButton() {
    const reason = reasonInput.value.trim();
    submitReasonBtn.disabled = reason.length === 0;
  }
  
  // Start timer
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    
    // Show timer section
    timerSection.classList.add('visible');
    
    // Hide submit reason button
    submitReasonBtn.classList.add('hidden');
    
    // Disable reason input
    reasonInput.disabled = true;
    
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
      unlockBtn.classList.add('visible');
    }
  }
  
  // Reason input handler
  reasonInput.addEventListener('input', () => {
    checkSubmitReasonButton();
  });
  
  // Submit reason button handler
  submitReasonBtn.addEventListener('click', () => {
    const reason = reasonInput.value.trim();
    if (reason.length > 0) {
      startTimer();
    }
  });
  
  // Unlock button handler
  unlockBtn.addEventListener('click', async () => {
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
        console.error('Error unlocking site:', error);
      }
    }
  });
  
  // Initialize submit reason button state
  checkSubmitReasonButton();
}

