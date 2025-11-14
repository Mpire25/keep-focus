// Background service worker for Keep Focus extension
// Handles dynamic icon updates based on dark mode preference

// Helper function to update extension icon based on dark mode
async function updateIcon(isDarkMode) {
  try {
    const iconSizes = [16, 48, 128];
    const iconPaths = {};
    
    iconSizes.forEach(size => {
      // Use dark mode icons if available, otherwise fall back to regular icons
      iconPaths[size] = isDarkMode 
        ? `icon${size}-dark.png` 
        : `icon${size}.png`;
    });
    
    await chrome.action.setIcon({ path: iconPaths });
  } catch (error) {
    // If dark mode icons don't exist, fall back to regular icons
    // This allows the extension to work even without dark mode icon files
    if (isDarkMode) {
      try {
        const iconSizes = [16, 48, 128];
        const iconPaths = {};
        iconSizes.forEach(size => {
          iconPaths[size] = `icon${size}.png`;
        });
        await chrome.action.setIcon({ path: iconPaths });
      } catch (fallbackError) {
        // Silently fail if icon update fails
      }
    }
  }
}

// Listen for dark mode changes in storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.darkMode) {
    const isDarkMode = changes.darkMode.newValue || false;
    updateIcon(isDarkMode);
  }
});

// Update icon when extension loads/installs
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = result.darkMode || false;
    updateIcon(isDarkMode);
  } catch (error) {
    // Silently fail if storage access fails
  }
});

// Also update icon when service worker starts (for existing installations)
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = result.darkMode || false;
    updateIcon(isDarkMode);
  } catch (error) {
    // Silently fail if storage access fails
  }
});

// Update icon immediately when service worker loads
(async () => {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = result.darkMode || false;
    updateIcon(isDarkMode);
  } catch (error) {
    // Silently fail if storage access fails
  }
})();

