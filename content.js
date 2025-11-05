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
  const currentPath = urlParts.slice(1).join('/'); // Get path after hostname
  
  const isBlocked = blockedSites.some(blockedSite => {
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    const blockedPath = blockedParts.slice(1).join('/'); // Get path after hostname
    
    // Check if hostnames match (domain must match)
    const hostnameMatch = currentHostname === blockedHostname ||
                          currentHostname.includes(blockedHostname) ||
                          blockedHostname.includes(currentHostname);
    
    if (!hostnameMatch) {
      return false; // Different domain, not blocked
    }
    
    // If blocked site has no path (domain-only block), block everything on that domain
    if (!blockedPath) {
      return true;
    }
    
    // If blocked site has a path (path-specific block), only block if current URL matches that path
    // Block if current URL matches exactly or starts with the blocked path followed by '/'
    // e.g., "youtube.com/shorts" blocks "youtube.com/shorts" and "youtube.com/shorts/anything"
    // but NOT "youtube.com/shorts-videos" (must be exact match or subpath)
    return normalizedUrl === blockedSite || 
           normalizedUrl.startsWith(blockedSite + '/') ||
           currentPath === blockedPath ||
           currentPath.startsWith(blockedPath + '/');
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
    // Convert to lowercase for case-insensitive matching
    return normalized.toLowerCase();
  } catch (e) {
    // If URL parsing fails, try to lowercase the input
    return url.toLowerCase();
  }
}

// Get site key for storage
function getSiteKey(normalizedUrl, blockedSites) {
  // Find the matching blocked site pattern
  const urlParts = normalizedUrl.split('/');
  const currentHostname = urlParts[0];
  const currentPath = urlParts.slice(1).join('/'); // Get path after hostname
  
  for (const blockedSite of blockedSites) {
    const blockedParts = blockedSite.split('/');
    const blockedHostname = blockedParts[0];
    const blockedPath = blockedParts.slice(1).join('/'); // Get path after hostname
    
    // Check if hostnames match (domain must match)
    const hostnameMatch = currentHostname === blockedHostname ||
                          currentHostname.includes(blockedHostname) ||
                          blockedHostname.includes(currentHostname);
    
    if (!hostnameMatch) {
      continue; // Different domain, skip
    }
    
    // If blocked site has no path (domain-only block), match
    if (!blockedPath) {
      return blockedSite;
    }
    
    // If blocked site has a path (path-specific block), only match if current URL matches that path
    // Match if current URL matches exactly or starts with the blocked path followed by '/'
    if (normalizedUrl === blockedSite || 
        normalizedUrl.startsWith(blockedSite + '/') ||
        currentPath === blockedPath ||
        currentPath.startsWith(blockedPath + '/')) {
      return blockedSite;
    }
  }
  return currentHostname; // Return domain as fallback
}

// Show the blocking overlay
function showBlockOverlay(normalizedUrl, siteKey, currentStreak) {
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
  
  // Create and inject styles
  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  style.textContent = `
    #keep-focus-overlay * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    #keep-focus-overlay {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #fefdf7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      padding-bottom: 90px;
      color: #333;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      overflow-y: auto;
    }
    
    #keep-focus-overlay .focus-blocker {
      width: 100%;
      max-width: 500px;
    }
    
    #keep-focus-overlay .focus-card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(212, 184, 150, 0.15);
      text-align: center;
    }
    
    #keep-focus-overlay .streak-display {
      margin-bottom: 24px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 8px;
      font-size: 14px;
      color: #495057;
    }
    
    #keep-focus-overlay .streak-display strong {
      color: #d4b896;
      font-weight: 600;
    }
    
    #keep-focus-overlay .streak-icon {
      font-size: 18px;
      margin-right: 4px;
    }
    
    #keep-focus-overlay h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #212529;
      letter-spacing: -0.5px;
    }
    
    #keep-focus-overlay .subtitle {
      font-size: 16px;
      color: #6c757d;
      margin-bottom: 32px;
      line-height: 1.5;
    }
    
    #keep-focus-overlay .reason-input {
      width: 100%;
      padding: 14px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      transition: border-color 0.2s;
      font-family: inherit;
    }
    
    #keep-focus-overlay .reason-input:focus {
      outline: none;
      border-color: #d4b896;
    }
    
    #keep-focus-overlay .reason-input:disabled {
      background: #f5f7fa;
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    #keep-focus-overlay .timer-section {
      margin-bottom: 24px;
      display: none;
    }
    
    #keep-focus-overlay .timer-section.visible {
      display: block;
    }
    
    #keep-focus-overlay .timer-display {
      font-size: 48px;
      font-weight: 700;
      color: #d4b896;
      margin-bottom: 8px;
    }
    
    #keep-focus-overlay .timer-label {
      font-size: 14px;
      color: #6c757d;
    }
    
    #keep-focus-overlay .submit-reason-btn {
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
    
    #keep-focus-overlay .submit-reason-btn:hover:not(:disabled) {
      background: #c9a883;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(212, 184, 150, 0.3);
    }
    
    #keep-focus-overlay .submit-reason-btn:disabled {
      background: #adb5bd;
      cursor: not-allowed;
      opacity: 0.6;
    }
    
    #keep-focus-overlay .submit-reason-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    
    #keep-focus-overlay .submit-reason-btn.hidden {
      display: none;
    }
    
    #keep-focus-overlay .unlock-btn {
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
      margin-top: 0;
    }
    
    #keep-focus-overlay .unlock-btn.visible {
      display: block;
    }
    
    #keep-focus-overlay .unlock-btn:hover:not(:disabled) {
      background: #c9a883;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(212, 184, 150, 0.3);
    }
    
    #keep-focus-overlay .unlock-btn:disabled {
      background: #adb5bd;
      cursor: not-allowed;
      opacity: 0.6;
    }
    
    #keep-focus-overlay .unlock-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    
    #keep-focus-overlay .quote-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e9ecef;
    }
    
    #keep-focus-overlay .simplified-view {
      text-align: center;
      margin-bottom: 32px;
      margin-top: 40px;
    }
    
    #keep-focus-overlay .quote {
      font-size: 20px;
      font-style: italic;
      color: #495057;
      line-height: 1.8;
      margin-bottom: 16px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
      font-weight: 400;
    }
    
    #keep-focus-overlay .quote-author {
      font-size: 14px;
      color: #6c757d;
      font-weight: 500;
    }
    
    #keep-focus-overlay .close-tab-btn {
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
      z-index: 1000000;
      box-shadow: 0 -4px 12px rgba(40, 167, 69, 0.3);
    }
    
    #keep-focus-overlay .close-tab-btn:hover {
      background: #218838;
      transform: translateY(-2px);
      box-shadow: 0 -6px 16px rgba(40, 167, 69, 0.4);
    }
    
    #keep-focus-overlay .close-tab-btn:active {
      transform: translateY(0);
      box-shadow: 0 -2px 8px rgba(40, 167, 69, 0.3);
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
  
  // Add unlock button before simplified view so quote appears above it
  const unlockBtn = document.createElement('button');
  unlockBtn.id = 'unlockBtn';
  unlockBtn.className = 'unlock-btn';
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Continue';
  
  // Structure: simplified view -> unlock button
  focusCard.appendChild(simplifiedView);
  focusCard.appendChild(unlockBtn);
  
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
  
  // Check if submit reason button can be enabled
  function checkSubmitReasonButton() {
    const reason = reasonInput.value.trim();
    submitReasonBtn.disabled = reason.length === 0;
  }
  
  // Start timer
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    
    // Hide initial elements
    if (currentStreak > 0) {
      const streakEl = focusCard.querySelector('.streak-display');
      if (streakEl) streakEl.style.display = 'none';
    }
    h2.style.display = 'none';
    subtitle.style.display = 'none';
    reasonInput.style.display = 'none';
    submitReasonBtn.style.display = 'none';
    
    // Show simplified view with random quote (timer runs in background, not visible)
    const randomQuote = getRandomQuote();
    simplifiedQuote.textContent = randomQuote.text;
    simplifiedQuoteAuthor.textContent = `— ${randomQuote.author}`;
    simplifiedView.style.display = 'block';
    
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

