// Verifis Reader + Clipper Popup Script
// Manages extension settings and communicates with content script

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('autoVerifyToggle');
  const status = document.getElementById('status');
  
  // Load saved state
  chrome.storage.sync.get(['autoVerifyHighlights'], function(result) {
    const isEnabled = result.autoVerifyHighlights !== false; // Default to true
    toggle.checked = isEnabled;
    updateStatus(isEnabled);
  });

  // Listen for storage changes to keep popup in sync
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && changes.autoVerifyHighlights) {
      const newValue = changes.autoVerifyHighlights.newValue;
      if (newValue !== undefined) {
        toggle.checked = newValue;
        updateStatus(newValue);
      }
    }
  });
  
  // Handle toggle changes
  toggle.addEventListener('change', function() {
    const isEnabled = toggle.checked;
    
    // Save to storage
    chrome.storage.sync.set({ autoVerifyHighlights: isEnabled });
    
    // Update status display
    updateStatus(isEnabled);
    
    // Send message to content script and wait for response
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'toggleAutoVerify',
          enabled: isEnabled
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.warn('Failed to send toggle message to content script');
            // Revert toggle if message failed
            toggle.checked = !isEnabled;
            updateStatus(!isEnabled);
            chrome.storage.sync.set({ autoVerifyHighlights: !isEnabled });
          } else if (response && response.status === 'ok') {
            console.log('Toggle message sent successfully');
          } else {
            console.warn('Toggle message failed:', response);
            // Revert toggle if response indicates failure
            toggle.checked = !isEnabled;
            updateStatus(!isEnabled);
            chrome.storage.sync.set({ autoVerifyHighlights: !isEnabled });
          }
        });
      }
    });
  });
  
  // Update status display
  function updateStatus(isEnabled) {
    if (isEnabled) {
      status.textContent = 'Highlight verification is enabled';
      status.className = 'status enabled';
    } else {
      status.textContent = 'Highlight verification is disabled';
      status.className = 'status disabled';
    }
  }
  
  // Check if extension is working on current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'ping' }, function(response) {
        if (chrome.runtime.lastError) {
          // Content script not loaded on this page
          status.textContent = 'Extension not active on this page';
          status.className = 'status disabled';
          toggle.disabled = true;
        } else if (response && response.ready === false) {
          // Extension not ready yet
          status.textContent = 'Extension initializing...';
          status.className = 'status disabled';
          toggle.disabled = true;
        } else {
          // Extension is ready
          toggle.disabled = false;
        }
      });
    }
  });
});
