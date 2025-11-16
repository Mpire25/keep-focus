// Show the blocking overlay

import { getStorageData, setStorageData } from '../utils/storage-utils.js';
import { hideBodyContent } from './overlay-utils.js';
import { generateOverlayStyles, getOverlayInlineStyles } from './overlay-styles.js';
import { startMediaObserver } from './media-control.js';
import { getRandomQuote } from './overlay-quotes.js';

const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes

export async function showBlockOverlay(normalizedUrl: string, siteKey: string, currentStreak: number): Promise<void> {
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
  let result: Record<string, unknown>;
  try {
    result = await getStorageData(['darkMode']);
  } catch (error) {
    // Extension context invalidated - use default dark mode
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      result = { darkMode: false };
    } else {
      throw error; // Re-throw other errors
    }
  }
  const darkMode = (result.darkMode as boolean) || false;
  
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
  
  // Create and inject styles
  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  // Only add style once
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
  h2.textContent = 'You said you wanted to focus.';
  focusCard.appendChild(h2);
  
  // Add subtitle
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'Why are you visiting this site?';
  focusCard.appendChild(subtitle);
  
  // Add reason input (visible initially for normal blocking)
  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.id = 'reasonInput';
  reasonInput.className = 'reason-input visible';
  reasonInput.placeholder = "";
  reasonInput.autocomplete = 'off';
  focusCard.appendChild(reasonInput);
  
  // Create close tab button in card (will be added after simplified view)
  const closeTabBtnCard = document.createElement('button');
  closeTabBtnCard.id = 'closeTabBtnCard';
  closeTabBtnCard.className = 'close-tab-btn-card';
  closeTabBtnCard.textContent = 'Close Tab';
  
  // Create small submit reason link (visible initially for normal blocking)
  const submitReasonLink = document.createElement('button');
  submitReasonLink.id = 'submitReasonLink';
  submitReasonLink.className = 'submit-reason-link visible';
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
  const body = document.body;
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
  
  let timeRemaining = TIMER_DURATION;
  let timerInterval: number | undefined;
  let timerStarted = false;
  
  // Check if submit reason link can be enabled
  function checkSubmitReasonButton(): void {
    const reason = reasonInput.value.trim();
    submitReasonLink.disabled = reason.length === 0;
  }
  
  // Start timer
  function startTimer(): void {
    if (timerStarted) return;
    timerStarted = true;
    
    // Set initial timer display to the actual duration
    timeRemaining = TIMER_DURATION;
    timerDisplay.textContent = String(timeRemaining);
    
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
    timerInterval = window.setInterval(() => {
      timeRemaining--;
      timerDisplay.textContent = String(timeRemaining);
      
      if (timeRemaining <= 0) {
        if (timerInterval !== undefined) {
          clearInterval(timerInterval);
        }
        timerDisplay.textContent = '0';
        checkIfCanUnlock();
      }
    }, 1000);
  }
  
  // Check if continue button can be enabled
  function checkIfCanUnlock(): void {
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
        const result = await getStorageData(['unlockedUntil', 'focusStreak']);
        const unlockedUntil = (result.unlockedUntil as Record<string, number>) || {};
        unlockedUntil[siteKey] = Date.now() + UNLOCK_DURATION;
        
        // Reset streak when user unlocks (they chose to visit)
        await setStorageData({ 
          unlockedUntil,
          focusStreak: 0
        });
        
        // Reload the page
        window.location.reload();
      } catch (error) {
        // Extension context invalidated - just reload the page anyway
        const err = error as Error;
        if (err.message && err.message.includes('Extension context invalidated')) {
          window.location.reload();
        }
        // Other errors - ignore
      }
    }
  });
  
  // Initialize submit reason button state
  checkSubmitReasonButton();
}

