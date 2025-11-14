// Show the time limit blocking overlay

import { getStorageData, setStorageData } from '../utils/storage-utils.js';
import { getCurrentDateString } from '../utils/time-utils.js';
import { hideBodyContent } from './overlay-utils.js';
import { generateOverlayStyles, getOverlayInlineStyles } from './overlay-styles.js';
import { startMediaObserver } from './media-control.js';
import { getRandomQuote } from './overlay-quotes.js';

export async function showTimeLimitOverlay(normalizedUrl, siteKey, limitMinutes) {
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
    result = await getStorageData(['darkMode']);
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
  hideBodyContent();
  
  // Create overlay container
  overlay = document.createElement('div');
  overlay.id = 'keep-focus-overlay';
  
  // Set dark mode class if enabled
  if (darkMode) {
    overlay.classList.add('dark-mode');
  }
  
  // Apply inline styles directly to overlay element to prevent inheritance
  overlay.style.cssText = getOverlayInlineStyles(darkMode);
  
  // Create and inject styles (reuse existing styles from showBlockOverlay)
  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  // Check if styles already exist
  if (!document.getElementById('keep-focus-styles')) {
    style.textContent = generateOverlayStyles(darkMode);
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
  const body = document.body;
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
  
  let timeRemaining = TIMER_DURATION;
  let timerInterval;
  let timerStarted = false;
  
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
        const result = await getStorageData(['timeTracking', 'timeLimits']);
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
          
          await setStorageData({ timeTracking });
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

