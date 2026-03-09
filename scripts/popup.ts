// Popup UI for managing blocked sites

import { getAllData, setStorageData } from '../utils/storage-utils.js';
import { updateExtensionIcon } from '../utils/icon-utils.js';
import { renderBlockedList, renderTimeLimitsList, updateFadeOverlays } from '../ui/list-renderer.js';
import { addSite, removeSiteByUrl, addTimeLimit, removeTimeLimit, showError, clearError, showTimeLimitError, clearTimeLimitError } from '../ui/form-handlers.js';
import type { BlockedSite, TimeLimit, TimeTracking } from '../types/index.js';

let blockedSites: BlockedSite[] = [];
let focusStreak = 0;
let darkMode = false;
let timeLimits: TimeLimit[] = [];
let timeTracking: TimeTracking = {};

// Load data from storage
async function loadData(): Promise<void> {
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
function attachRemoveListeners(): void {
  // Blocked sites remove buttons
  document.querySelectorAll('.btn-remove:not([data-type="time-limit"])').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const url = target.dataset.url;
      if (url) {
        const result = await removeSiteByUrl(url, blockedSites);
        if (result.success) {
          blockedSites = result.blockedSites || [];
          renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
          attachRemoveListeners();
        }
      }
    });
  });
  
  // Time limit remove buttons
  document.querySelectorAll('.btn-remove[data-type="time-limit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const url = target.dataset.url;
      if (url) {
        const result = await removeTimeLimit(url, timeLimits, timeTracking);
        if (result.success) {
          timeLimits = result.timeLimits || [];
          timeTracking = result.timeTracking || {};
          renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
          attachRemoveListeners();
        }
      }
    });
  });
}

// Apply dark mode to the page
function applyDarkMode(): void {
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
function openStandalonePage(): void {
  const url = chrome.runtime.getURL('pages/standalone.html');
  chrome.tabs.create({ url: url });
}

// Add a site to the blocked list
async function handleAddSite(): Promise<void> {
  const result = await addSite(blockedSites);
  if (result.success) {
    blockedSites = result.blockedSites || [];
    renderBlockedList(blockedSites, 'blockedList', 'blockedListWrapper');
    attachRemoveListeners();
  }
}

// Add a time limit
async function handleAddTimeLimit(): Promise<void> {
  const result = await addTimeLimit(timeLimits, timeTracking);
  if (result.success) {
    timeLimits = result.timeLimits || [];
    timeTracking = result.timeTracking || {};
    renderTimeLimitsList(timeLimits, timeTracking, 'timeLimitsList', 'timeLimitsListWrapper');
    attachRemoveListeners();
  }
}

// Switch tabs
function switchTab(tabName: string): void {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    if ((btn as HTMLElement).dataset.tab === tabName) {
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
  
  const addBtn = document.getElementById('addBtn');
  const addTimeLimitBtn = document.getElementById('addTimeLimitBtn');
  
  if (addBtn) {
    addBtn.addEventListener('click', handleAddSite);
  }
  if (addTimeLimitBtn) {
    addTimeLimitBtn.addEventListener('click', handleAddTimeLimit);
  }
  
  // External link button
  if (externalLinkBtn) {
    externalLinkBtn.addEventListener('click', openStandalonePage);
  }
  
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
  
  // Listen for storage changes to update dark mode when changed in standalone page
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.darkMode) {
      darkMode = (changes.darkMode.newValue as boolean) || false;
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

