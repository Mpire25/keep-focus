// Shared interactive overlay flow for blocking and time-limit states

import { getStorageData } from '../utils/storage-utils.js';
import { hideBodyContent } from './overlay-utils.js';
import { generateOverlayStyles, getOverlayInlineStyles } from './overlay-styles.js';
import { startMediaObserver } from './media-control.js';
import { getRandomQuote } from './overlay-quotes.js';

const TIMER_MIN_SECONDS = 15;
const TIMER_MAX_SECONDS = 30;
const CLOSE_REDIRECT_URL = 'https://www.google.com';

export interface OverlayFlowConfig {
  heading: string;
  subtitle: string;
  continueButtonLabel: string;
  reasonVisibleInitially: boolean;
  showMoreTimeButton: boolean;
  moreTimeButtonLabel?: string;
  onContinue: (reason: string) => Promise<void>;
}

async function ensureDomReady(): Promise<void> {
  if (document.readyState !== 'loading') {
    return;
  }

  await new Promise<void>(resolve => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

async function getDarkModePreference(): Promise<boolean> {
  try {
    const result = await getStorageData(['darkMode']);
    return (result.darkMode as boolean) || false;
  } catch (error) {
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      return false;
    }
    throw error;
  }
}

function injectOverlayStyles(darkMode: boolean): void {
  if (document.getElementById('keep-focus-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  style.textContent = generateOverlayStyles(darkMode);
  document.head.appendChild(style);
}

export async function showInteractiveOverlay(config: OverlayFlowConfig): Promise<void> {
  await ensureDomReady();

  if (document.getElementById('keep-focus-overlay')) {
    return;
  }

  const darkMode = await getDarkModePreference();
  hideBodyContent();
  injectOverlayStyles(darkMode);

  const overlay = document.createElement('div');
  overlay.id = 'keep-focus-overlay';
  overlay.style.cssText = getOverlayInlineStyles(darkMode);
  if (darkMode) {
    overlay.classList.add('dark-mode');
  }

  document.title = 'Stay Focused';

  const focusBlocker = document.createElement('div');
  focusBlocker.className = 'focus-blocker';

  const focusCard = document.createElement('div');
  focusCard.className = 'focus-card';

  const heading = document.createElement('h2');
  heading.textContent = config.heading;
  focusCard.appendChild(heading);

  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = config.subtitle;
  focusCard.appendChild(subtitle);

  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.id = 'reasonInput';
  reasonInput.className = config.reasonVisibleInitially ? 'reason-input visible' : 'reason-input';
  reasonInput.placeholder = '';
  reasonInput.autocomplete = 'off';
  focusCard.appendChild(reasonInput);

  const closeTabBtnCard = document.createElement('button');
  closeTabBtnCard.id = 'closeTabBtnCard';
  closeTabBtnCard.className = 'close-tab-btn-card';
  closeTabBtnCard.textContent = 'Close Tab';

  const moreTimeBtn = config.showMoreTimeButton ? document.createElement('button') : null;
  if (moreTimeBtn) {
    moreTimeBtn.id = 'moreTimeBtn';
    moreTimeBtn.className = 'more-time-btn';
    moreTimeBtn.textContent = config.moreTimeButtonLabel || 'More Time';
  }

  const submitReasonLink = document.createElement('button');
  submitReasonLink.id = 'submitReasonLink';
  submitReasonLink.className = config.reasonVisibleInitially ? 'submit-reason-link visible' : 'submit-reason-link';
  submitReasonLink.disabled = true;
  submitReasonLink.textContent = 'Submit Reason';

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

  const continueBtn = document.createElement('button');
  continueBtn.id = 'continueBtn';
  continueBtn.className = 'continue-btn';
  continueBtn.disabled = true;
  continueBtn.textContent = config.continueButtonLabel;

  focusCard.appendChild(simplifiedView);
  focusCard.appendChild(closeTabBtnCard);
  if (moreTimeBtn) {
    focusCard.appendChild(moreTimeBtn);
  }
  focusCard.appendChild(submitReasonLink);
  focusCard.appendChild(continueBtn);

  focusBlocker.appendChild(focusCard);
  overlay.appendChild(focusBlocker);

  const closeTabBtn = document.createElement('button');
  closeTabBtn.id = 'closeTabBtn';
  closeTabBtn.className = 'close-tab-btn';
  closeTabBtn.textContent = 'Close Tab';
  overlay.appendChild(closeTabBtn);

  if (!document.getElementById('keep-focus-overlay')) {
    document.body.appendChild(overlay);
    startMediaObserver();
  }

  closeTabBtn.addEventListener('click', () => {
    window.location.href = CLOSE_REDIRECT_URL;
  });

  closeTabBtnCard.addEventListener('click', () => {
    window.location.href = CLOSE_REDIRECT_URL;
  });

  const timerDuration = Math.floor(Math.random() * (TIMER_MAX_SECONDS - TIMER_MIN_SECONDS + 1)) + TIMER_MIN_SECONDS;
  let timeRemaining = timerDuration;
  let timerInterval: number | undefined;
  let timerStarted = false;

  function checkSubmitReasonButton(): void {
    const reason = reasonInput.value.trim();
    submitReasonLink.disabled = reason.length === 0;
  }

  function checkIfCanContinue(): void {
    const reason = reasonInput.value.trim();
    if (timeRemaining <= 0 && reason.length > 0) {
      continueBtn.disabled = false;
      continueBtn.classList.add('visible');
    }
  }

  function startTimer(): void {
    if (timerStarted) {
      return;
    }
    timerStarted = true;
    timeRemaining = timerDuration;
    timerDisplay.textContent = String(timeRemaining);

    heading.style.setProperty('display', 'none', 'important');
    subtitle.style.setProperty('display', 'none', 'important');
    reasonInput.style.setProperty('display', 'none', 'important');
    submitReasonLink.style.setProperty('display', 'none', 'important');
    if (moreTimeBtn) {
      moreTimeBtn.style.setProperty('display', 'none', 'important');
    }

    const randomQuote = getRandomQuote();
    simplifiedQuote.textContent = randomQuote.text;
    simplifiedQuoteAuthor.textContent = `— ${randomQuote.author}`;
    simplifiedView.style.setProperty('display', 'block', 'important');
    simplifiedView.classList.add('visible');

    timerInterval = window.setInterval(() => {
      timeRemaining--;
      timerDisplay.textContent = String(timeRemaining);

      if (timeRemaining <= 0) {
        if (timerInterval !== undefined) {
          clearInterval(timerInterval);
        }
        timerDisplay.textContent = '0';
        checkIfCanContinue();
      }
    }, 1000);
  }

  if (moreTimeBtn) {
    moreTimeBtn.addEventListener('click', () => {
      moreTimeBtn.classList.add('hidden');
      reasonInput.classList.add('visible');
      submitReasonLink.classList.add('visible');
      reasonInput.focus();
    });
  }

  reasonInput.addEventListener('input', () => {
    checkSubmitReasonButton();
  });

  submitReasonLink.addEventListener('click', () => {
    if (reasonInput.value.trim().length > 0) {
      startTimer();
    }
  });

  continueBtn.addEventListener('click', async () => {
    const reason = reasonInput.value.trim();
    if (timeRemaining <= 0 && reason.length > 0) {
      await config.onContinue(reason);
    }
  });

  checkSubmitReasonButton();
}
