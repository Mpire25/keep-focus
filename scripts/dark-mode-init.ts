// Apply dark mode immediately before page renders to prevent flash
(async function() {
  // Hide body initially to prevent flash
  document.documentElement.style.visibility = 'hidden';

  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    if (result.darkMode) {
      document.documentElement.classList.add('dark-mode');
      document.body?.classList.add('dark-mode');
    }
  } finally {
    // Always restore visibility, even if storage read fails
    document.documentElement.style.visibility = '';
  }
})();
