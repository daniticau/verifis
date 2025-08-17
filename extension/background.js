// Verifis Reader + Clipper Background Service Worker
// Handles extension lifecycle and messaging

// Extension installation
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      autoVerifyHighlights: true
    });
    
    console.log('Verifis Reader + Clipper installed');
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'ping') {
    sendResponse({ status: 'ok' });
  }
  
  // Handle any other message types here
  return true; // Keep message channel open for async responses
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
  // This will open the popup automatically due to manifest configuration
  console.log('Extension icon clicked on tab:', tab.id);
});
