// Verifis Reader + Clipper Content Script
// Automatically verifies highlighted text on any webpage

(function() {
  'use strict';

  let overlayIframe = null;
  let debounceTimer = null;
  let lastSelection = '';
  let isVerifying = false;
  let autoVerifyEnabled = true; // Default to enabled

  // Configuration
  const CONFIG = {
    MIN_SELECTION_LENGTH: 15,
    DEBOUNCE_DELAY: 600,
    API_ENDPOINT: 'http://localhost:3000/api/clip', // Change to your local URL
    OVERLAY_URL: 'http://localhost:3000/overlay'    // Change to your local URL
  };

  // Load saved settings
  function loadSettings() {
    chrome.storage.sync.get(['autoVerifyHighlights'], function(result) {
      autoVerifyEnabled = result.autoVerifyHighlights !== false; // Default to true
      console.log('Verifis auto-verify:', autoVerifyEnabled ? 'enabled' : 'disabled');
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'ping') {
      sendResponse({ status: 'ok' });
    } else if (request.type === 'toggleAutoVerify') {
      autoVerifyEnabled = request.enabled;
      console.log('Verifis auto-verify toggled:', autoVerifyEnabled);
      sendResponse({ status: 'ok' });
    }
    return true;
  });

  // Debounced function to handle text selection
  function debouncedVerify(selectionText) {
    if (!autoVerifyEnabled) return; // Skip if disabled
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (selectionText && selectionText.length >= CONFIG.MIN_SELECTION_LENGTH) {
        verifySelection(selectionText);
      }
    }, CONFIG.DEBOUNCE_DELAY);
  }

  // Main verification function
  async function verifySelection(selectionText) {
    if (isVerifying || selectionText === lastSelection) return;
    
    isVerifying = true;
    lastSelection = selectionText;

    try {
      // Show verification indicator
      showVerificationIndicator();

      // Prepare clip data
      const clipData = {
        url: window.location.href,
        title: document.title,
        text: selectionText.trim()
      };

      // Send to API
      const response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clipData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Show overlay with verification results
      showOverlay(result.id, selectionText);

    } catch (error) {
      console.error('Verifis verification failed:', error);
      showErrorToast('Could not verify snippet');
    } finally {
      isVerifying = false;
      hideVerificationIndicator();
    }
  }

  // Show overlay iframe
  function showOverlay(clipId, selectionText) {
    if (!overlayIframe) {
      overlayIframe = document.createElement('iframe');
      overlayIframe.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        height: 600px;
        border: none;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        z-index: 2147483647;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(overlayIframe);
    }

    // Update overlay with new clip
    overlayIframe.src = `${CONFIG.OVERLAY_URL}?id=${clipId}&text=${encodeURIComponent(selectionText)}`;
    
    // Make overlay visible
    overlayIframe.style.display = 'block';
  }

  // Hide overlay
  function hideOverlay() {
    if (overlayIframe) {
      overlayIframe.style.display = 'none';
    }
  }

  // Show verification indicator
  function showVerificationIndicator() {
    // Add subtle highlight glow to selected text
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      const indicator = document.createElement('div');
      indicator.id = 'verifis-indicator';
      indicator.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top - 30}px;
        background: #3b82f6;
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 2147483646;
        pointer-events: none;
        animation: fadeIn 0.2s ease-out;
      `;
      indicator.textContent = 'Verifis verifying...';
      
      // Add CSS animation
      if (!document.getElementById('verifis-styles')) {
        const style = document.createElement('style');
        style.id = 'verifis-styles';
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(indicator);
    }
  }

  // Hide verification indicator
  function hideVerificationIndicator() {
    const indicator = document.getElementById('verifis-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  // Show error toast
  function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483646;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Event listeners
  function handleSelectionChange() {
    const selection = window.getSelection();
    const selectionText = selection.toString().trim();
    
    if (selectionText && selectionText.length >= CONFIG.MIN_SELECTION_LENGTH) {
      debouncedVerify(selectionText);
    } else {
      // Clear timer if selection is too short
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }
  }

  function handleMouseUp() {
    // Small delay to ensure selection is complete
    setTimeout(handleSelectionChange, 50);
  }

  function handleKeyDown(event) {
    // Close overlay with ESC
    if (event.key === 'Escape') {
      hideOverlay();
    }
  }

  // Initialize
  function init() {
    // Load settings first
    loadSettings();
    
    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    // Listen for messages from overlay (for closing)
    window.addEventListener('message', (event) => {
      if (event.data.type === 'verifis-close-overlay') {
        hideOverlay();
      }
    });
    
    console.log('Verifis Reader + Clipper initialized');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
