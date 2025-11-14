// Apply dark mode immediately before page renders to prevent flash
(function() {
  // Hide body initially to prevent flash
  document.documentElement.style.visibility = 'hidden';
  
  chrome.storage.sync.get(['darkMode'], function(result) {
    if (result.darkMode) {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    }
    // Show body once dark mode is determined
    document.documentElement.style.visibility = '';
  });
})();

