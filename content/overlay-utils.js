// Overlay utility functions

import { stopMediaObserver } from './media-control.js';

// Remove overlay and restore body content
export function removeOverlayAndRestoreBody() {
  const existingOverlay = document.getElementById('keep-focus-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
    // Restore body content
    Array.from(document.body.children).forEach(child => {
      if (child.id !== 'keep-focus-overlay') {
        child.style.display = '';
      }
    });
    document.body.style.overflow = '';
    // Stop media observer when overlay is removed
    stopMediaObserver();
  }
}

// Hide body content to prepare for overlay
export function hideBodyContent() {
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
}

// Inject overlay styles if not already present
export async function injectOverlayStyles(darkMode) {
  if (document.getElementById('keep-focus-styles')) {
    return; // Styles already injected
  }
  
  const { generateOverlayStyles } = await import('./overlay-styles.js');
  const style = document.createElement('style');
  style.id = 'keep-focus-styles';
  style.textContent = generateOverlayStyles(darkMode);
  document.head.appendChild(style);
}

