// Popup UI for managing blocked sites

import { getAllData, setStorageData } from '../utils/storage-utils.js';
import { renderBlockedList, renderTimeLimitsList, updateFadeOverlays } from '../ui/list-renderer.js';
import { addSite, removeSiteByUrl, addTimeLimit, removeTimeLimit, showError, clearError, showTimeLimitError, clearTimeLimitError } from '../ui/form-handlers.js';

let blockedSites = [];
let focusStreak = 0;
let darkMode = false;
let timeLimits = [];
let timeTracking = {};

// Load data from storage
async function loadData() {
  try {
    const result = await getAllData();
    blockedSites = result.blockedSites || [];
    focusStreak = result.focusStreak || 0;
    darkMode = result.darkMode || false;
    timeLimits = result.timeLimits || [];
    timeTracking = result.timeTracking || {};
    applyDarkMode();
    renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
    renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
    attachRemoveListeners();
  } catch (error) {
    // Error loading data
  }
}

// Attach remove button listeners
function attachRemoveListeners() {
  // Blocked sites remove buttons
  document.querySelectorAll('.btn-remove:not([data-type="time-limit"])').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const url = e.target.dataset.url;
      const result = await removeSiteByUrl(url, blockedSites);
      if (result.success) {
        blockedSites = result.blockedSites;
        renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
        attachRemoveListeners();
      }
    });
  });
  
  // Time limit remove buttons
  document.querySelectorAll('.btn-remove[data-type="time-limit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const url = e.target.dataset.url;
      const result = await removeTimeLimit(url, timeLimits, timeTracking);
      if (result.success) {
        timeLimits = result.timeLimits;
        timeTracking = result.timeTracking;
        renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
        attachRemoveListeners();
      }
    });
  });
}

// Update extension icon based on dark mode
async function updateExtensionIcon(isDarkMode) {
  try {
    const iconSizes = [16, 32, 48, 96, 128, 256];
    const iconPaths = {};
    
    iconSizes.forEach(size => {
      const relativePath = isDarkMode 
        ? `icons/icon${size}-dark.png` 
        : `icons/icon${size}.png`;
      iconPaths[size] = chrome.runtime.getURL(relativePath);
    });
    
    await chrome.action.setIcon({ path: iconPaths });
  } catch (error) {
    // If dark mode icons don't exist, fall back to regular icons
    // This allows the extension to work even without dark mode icon files
    if (isDarkMode) {
      try {
        const iconSizes = [16, 32, 48, 96, 128, 256];
        const iconPaths = {};
        iconSizes.forEach(size => {
          iconPaths[size] = chrome.runtime.getURL(`icons/icon${size}.png`);
        });
        await chrome.action.setIcon({ path: iconPaths });
      } catch (fallbackError) {
        // Silently fail if icon update fails
      }
    }
  }
}

// Apply dark mode to the page
function applyDarkMode() {
  const body = document.body;
  
  if (darkMode) {
    body.classList.add('dark-mode');
  } else {
    body.classList.remove('dark-mode');
  }
  
  // Update extension icon when dark mode is applied
  updateExtensionIcon(darkMode);
}

// Open standalone extension page
function openStandalonePage() {
  const url = chrome.runtime.getURL('pages/standalone.html');
  chrome.tabs.create({ url: url });
}

// Add a site to the blocked list
async function handleAddSite() {
  const result = await addSite(blockedSites);
  if (result.success) {
    blockedSites = result.blockedSites;
    renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
    attachRemoveListeners();
  }
}

// Add a time limit
async function handleAddTimeLimit() {
  const result = await addTimeLimit(timeLimits, timeTracking);
  if (result.success) {
    timeLimits = result.timeLimits;
    timeTracking = result.timeTracking;
    renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
    attachRemoveListeners();
  }
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Update fade overlays after tab switch
  setTimeout(() => {
    const blockedList = document.getElementById('blockedList');
    const blockedListWrapper = document.getElementById('blockedListWrapper');
    const timeLimitsList = document.getElementById('timeLimitsList');
    const timeLimitsListWrapper = document.getElementById('timeLimitsListWrapper');
    
    if (blockedList && blockedListWrapper) {
      updateFadeOverlays(blockedList, blockedListWrapper);
    }
    if (timeLimitsList && timeLimitsListWrapper) {
      updateFadeOverlays(timeLimitsList, timeLimitsListWrapper);
    }
  }, 0);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  const siteInput = document.getElementById('siteInput');
  const externalLinkBtn = document.getElementById('externalLinkBtn');
  
  document.getElementById('addBtn').addEventListener('click', handleAddSite);
  document.getElementById('addTimeLimitBtn').addEventListener('click', handleAddTimeLimit);
  
  // External link button
  if (externalLinkBtn) {
    externalLinkBtn.addEventListener('click', openStandalonePage);
  }
  
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
  
  // Listen for storage changes to update dark mode when changed in standalone page
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.darkMode) {
      darkMode = changes.darkMode.newValue || false;
      applyDarkMode(); // This will also update the icon
    }
  });
  
  if (siteInput) {
    siteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddSite();
      }
    });
    
    // Clear error when user starts typing
    siteInput.addEventListener('input', () => {
      clearError();
    });
  }
  
  // Time limit inputs
  const timeLimitSiteInput = document.getElementById('timeLimitSiteInput');
  const timeLimitMinutesInput = document.getElementById('timeLimitMinutesInput');
  
  if (timeLimitSiteInput) {
    timeLimitSiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddTimeLimit();
      }
    });
    
    timeLimitSiteInput.addEventListener('input', () => {
      clearTimeLimitError();
    });
  }
  
  if (timeLimitMinutesInput) {
    timeLimitMinutesInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddTimeLimit();
      }
    });
    
    timeLimitMinutesInput.addEventListener('input', () => {
      clearTimeLimitError();
    });
  }
});
