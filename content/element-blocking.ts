// Element blocking utilities for hiding specific page elements

import { getAllData } from '../utils/storage-utils.js';
import type { ElementBlockingRule } from '../types/index.js';

// Global variable to track element observer
let elementObserver: MutationObserver | null = null;
const hiddenElements = new WeakSet<Element>();

// YouTube selector mappings
const YOUTUBE_SELECTORS = {
  shorts: [
    'ytd-reel-shelf-renderer',
    'a[href*="/shorts/"]',
    'ytd-shorts',
    'ytd-reel-item-renderer'
  ],
  suggestedVideos: [
    'ytd-watch-next-secondary-results-renderer',
    'ytd-compact-video-renderer',
    '#secondary',
    'ytd-item-section-renderer[class*="watch-next"]'
  ],
  ads: [
    'ytd-ad-slot-renderer',
    '.ytp-ad-module',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-display-ad-renderer'
  ],
  comments: [
    '#comments',
    'ytd-comments',
    'ytd-comments-header-renderer',
    'ytd-comment-thread-renderer'
  ],
  minimalMode: [
    '#secondary',
    '#related',
    'ytd-watch-next-secondary-results-renderer',
    '#comments',
    'ytd-comments',
    'ytd-item-section-renderer[class*="watch-next"]',
    'ytd-compact-video-renderer'
  ]
};

// Get selectors for a specific YouTube blocking option
function getYouTubeSelectors(option: keyof typeof YOUTUBE_SELECTORS): string[] {
  return YOUTUBE_SELECTORS[option];
}

// Check if a domain matches (handles subdomains)
// e.g., 'www.youtube.com' matches 'youtube.com'
function domainMatches(ruleDomain: string, currentDomain: string): boolean {
  // Exact match
  if (ruleDomain === currentDomain) {
    return true;
  }
  
  // Check if current domain is a subdomain of rule domain
  // e.g., 'www.youtube.com' ends with '.youtube.com'
  if (currentDomain.endsWith('.' + ruleDomain)) {
    return true;
  }
  
  return false;
}

// Apply element blocking for given selectors
function applyElementBlocking(selectors: string[]): void {
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!hiddenElements.has(el)) {
          (el as HTMLElement).style.display = 'none';
          hiddenElements.add(el);
        }
      });
    } catch (e) {
      // Silently ignore selector errors
    }
  });
}

// Throttle function to limit how often we process mutations
let throttleTimeout: number | null = null;
const THROTTLE_DELAY = 100; // Process mutations at most every 100ms

// Start observing for new elements
function startElementObserver(selectors: string[]): void {
  stopElementObserver();
  
  elementObserver = new MutationObserver(() => {
    // Throttle the callback to avoid excessive processing
    if (throttleTimeout !== null) {
      return; // Already scheduled
    }
    
    throttleTimeout = window.setTimeout(() => {
      throttleTimeout = null;
      applyElementBlocking(selectors);
    }, THROTTLE_DELAY);
  });
  
  if (document.body) {
    elementObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Stop observing for new elements
export function stopElementObserver(): void {
  if (elementObserver) {
    elementObserver.disconnect();
    elementObserver = null;
  }
  if (throttleTimeout !== null) {
    clearTimeout(throttleTimeout);
    throttleTimeout = null;
  }
}


// Initialize element blocking for current domain
export async function initElementBlocking(): Promise<void> {
  try {
    const result = await getAllData();
    const rules: ElementBlockingRule[] = result.elementBlockingRules || [];
    
    const currentDomain = new URL(window.location.href).hostname;
    
    const activeRules = rules.filter(rule => {
      const matches = domainMatches(rule.domain, currentDomain);
      return matches && rule.enabled;
    });
    
    // Combine all selectors from active rules
    const allSelectors = activeRules.flatMap(rule => rule.selectors);
    
    if (activeRules.length === 0) {
      stopElementObserver();
      return;
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyElementBlocking(allSelectors);
        startElementObserver(allSelectors);
      });
      return;
    }
    
    // Apply blocking immediately
    applyElementBlocking(allSelectors);
    
    // Start observing for new elements
    startElementObserver(allSelectors);
  } catch (error) {
    // Extension context invalidated or other error - stop observing
    const err = error as Error;
    if (err.message && err.message.includes('Extension context invalidated')) {
      stopElementObserver();
      return;
    }
    // Other errors - continue silently
  }
}

// Get YouTube selectors for a specific option (exported for UI use)
export function getYouTubeSelectorsForOption(option: keyof typeof YOUTUBE_SELECTORS): string[] {
  return getYouTubeSelectors(option);
}

