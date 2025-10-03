/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
class SelectionHandler {
    constructor() {
        this.isInitialized = false;
        this.debounceTimer = null;
        this.lastSelectedText = '';
        this.isProcessing = false;
        this.DEBOUNCE_DELAY = 1000; // 1 second delay after selection
        this.MIN_TEXT_LENGTH = 20; // Minimum text length to trigger fact-check
        this.init();
    }
    init() {
        if (this.isInitialized)
            return;
        console.log('🔍 Verifis content script initialized with auto fact-checking');
        console.log('🔍 Debug: Setting up event listeners...');
        console.log('🔍 CONTENT SCRIPT IS RUNNING - CHECK PAGE CONSOLE');
        // Also show a visible notification to confirm content script is running
        this.showNotification('Verifis content script loaded!', 'info');
        // Set up extension context invalidation detection
        this.setupContextInvalidationDetection();
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'FACT_CHECK_REQUEST') {
                this.handleFactCheckRequest(message, sendResponse);
                return true; // Keep message channel open
            }
        });
        // Listen for text selection changes
        document.addEventListener('selectionchange', () => {
            this.handleSelectionChange();
        });
        // Listen for mouse up (when selection is complete)
        document.addEventListener('mouseup', () => {
            // Small delay to ensure selection is complete
            setTimeout(() => this.handleSelectionChange(), 100);
        });
        // Listen for keyboard shortcuts (manual override)
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.shiftKey && event.key === 'F') {
                event.preventDefault();
                this.triggerFactCheck();
            }
        });
        this.isInitialized = true;
    }
    // Set up extension context invalidation detection
    setupContextInvalidationDetection() {
        // Listen for extension context invalidation
        chrome.runtime.onConnect.addListener((port) => {
            port.onDisconnect.addListener(() => {
                if (chrome.runtime.lastError) {
                    console.warn('Extension context invalidated, resetting state');
                    this.isProcessing = false;
                    this.debounceTimer = null;
                    this.showNotification('Extension reloaded. Please refresh the page for full functionality.', 'warning');
                }
            });
        });
    }
    // Handle automatic text selection changes
    async handleSelectionChange() {
        console.log('🔍 Debug: handleSelectionChange called');
        const selection = this.getCurrentSelection();
        if (!selection) {
            console.log('🔍 Debug: No selection found');
            // Clear any pending debounce timer if no selection
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            return;
        }
        console.log('🔍 Debug: Selection found:', selection.text.substring(0, 50) + '...');
        // Check if auto fact-checking is enabled
        const settings = await this.getSettings();
        console.log('🔍 Debug: Settings loaded:', settings);
        if (!settings.autoFactCheckEnabled) {
            console.log('🔍 Debug: Auto fact-checking is disabled');
            return;
        }
        // Check if text is long enough and different from last selection
        if (selection.text.length < settings.minTextLength) {
            console.log(`🔍 Debug: Text too short (${selection.text.length} < ${settings.minTextLength})`);
            return;
        }
        if (selection.text === this.lastSelectedText) {
            console.log('🔍 Debug: Same text as last selection, skipping');
            return;
        }
        if (this.isProcessing) {
            console.log('🔍 Debug: Already processing a fact-check, skipping');
            return;
        }
        // Clear any existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        // Show selection indicator
        this.showSelectionIndicator(selection.text);
        // Set up debounced fact-check with user-configured delay
        console.log(`🔍 Debug: Setting up debounce timer for ${settings.autoFactCheckDelay} seconds`);
        this.debounceTimer = setTimeout(() => {
            console.log('🔍 Debug: Debounce timer fired, calling autoFactCheck');
            this.autoFactCheck(selection);
        }, settings.autoFactCheckDelay * 1000);
    }
    // Get extension settings
    async getSettings() {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                console.warn('Extension context invalidated, using defaults');
                return {
                    autoFactCheckEnabled: true,
                    autoFactCheckDelay: 1,
                    minTextLength: 20
                };
            }
            const stored = await chrome.storage.sync.get([
                'autoFactCheckEnabled',
                'autoFactCheckDelay',
                'minTextLength'
            ]);
            return {
                autoFactCheckEnabled: stored.autoFactCheckEnabled ?? true,
                autoFactCheckDelay: stored.autoFactCheckDelay ?? 1,
                minTextLength: stored.minTextLength ?? 20
            };
        }
        catch (error) {
            console.warn('Failed to load settings, using defaults:', error);
            return {
                autoFactCheckEnabled: true,
                autoFactCheckDelay: 1,
                minTextLength: 20
            };
        }
    }
    // Automatically fact-check selected text
    autoFactCheck(selection) {
        console.log('🔍 Debug: autoFactCheck called');
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
            console.warn('Extension context invalidated, cannot send fact-check request');
            this.isProcessing = false; // Reset processing flag
            this.showNotification('Extension context invalidated. Please reload the page.', 'error');
            return;
        }
        if (this.isProcessing) {
            console.log('🔍 Debug: Already processing, returning');
            return;
        }
        this.isProcessing = true;
        this.lastSelectedText = selection.text;
        console.log(`🔍 Auto fact-checking: "${selection.text.substring(0, 50)}..."`);
        console.log('🔍 Debug: About to send message to background script');
        // Show processing indicator
        this.showNotification('Auto fact-checking selected text...', 'info');
        // Send to background for processing
        console.log('🔍 Debug: Sending message to background...');
        chrome.runtime.sendMessage({
            type: 'FACT_CHECK_REQUEST',
            payload: {
                claim: selection.text,
                pageUrl: selection.pageUrl,
                pageTitle: selection.pageTitle,
                useFastModel: true // Use fast model for auto fact-checking
            }
        }, (response) => {
            console.log('🔍 Debug: Received response from background:', response);
            this.isProcessing = false;
            if (chrome.runtime.lastError) {
                console.error('🔍 Debug: Chrome runtime error:', chrome.runtime.lastError);
                this.showNotification(`Extension error: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }
            // Handle the response structure from background script
            const payload = response?.payload || response;
            if (payload && payload.success) {
                console.log('🔍 Debug: Fact-check successful:', payload.result);
                this.showFactCheckResult(payload.result);
                // Show brief success notification
                this.showNotification(`✅ Fact-check complete! Score: ${payload.result.overall}/100`, 'info');
                // Request background script to open the extension popup
                this.openExtensionPopup();
            }
            else {
                const error = payload?.error || 'Fact-check failed';
                console.error('🔍 Debug: Fact-check failed:', error);
                this.showNotification(`❌ Auto fact-check failed: ${error}`, 'error');
            }
        });
    }
    // Handle fact-check request from background
    handleFactCheckRequest(message, sendResponse) {
        const selection = this.getCurrentSelection();
        if (!selection) {
            sendResponse({
                success: false,
                error: 'No text selected'
            });
            return;
        }
        // Send to background for processing
        chrome.runtime.sendMessage({
            type: 'FACT_CHECK_REQUEST',
            payload: {
                claim: selection.text,
                pageUrl: selection.pageUrl,
                pageTitle: selection.pageTitle
            }
        }, (response) => {
            sendResponse(response);
        });
    }
    // Get current text selection
    getCurrentSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('🔍 Debug: No selection or no ranges');
            return null;
        }
        const selectedText = selection.toString().trim();
        console.log(`🔍 Debug: Selected text length: ${selectedText.length}`);
        if (!selectedText || selectedText.length < 10) {
            console.log(`🔍 Debug: Text too short or empty (${selectedText.length} < 10)`);
            return null;
        }
        const range = selection.getRangeAt(0);
        return {
            text: selectedText,
            pageUrl: window.location.href,
            pageTitle: document.title,
            selectionRange: {
                start: range.startOffset,
                end: range.endOffset
            }
        };
    }
    // Trigger fact-check for current selection
    triggerFactCheck() {
        const selection = this.getCurrentSelection();
        if (!selection) {
            this.showNotification('Please select some text to fact-check', 'warning');
            return;
        }
        this.showNotification('Fact-checking selected text...', 'info');
        // Send to background for processing
        chrome.runtime.sendMessage({
            type: 'FACT_CHECK_REQUEST',
            payload: {
                claim: selection.text,
                pageUrl: selection.pageUrl,
                pageTitle: selection.pageTitle
            }
        }, (response) => {
            if (response.success) {
                this.showFactCheckResult(response.result);
            }
            else {
                this.showNotification(`Fact-check failed: ${response.error}`, 'error');
            }
        });
    }
    // Show selection indicator
    showSelectionIndicator(text) {
        // Remove existing indicator
        const existing = document.getElementById('verifis-selection-indicator');
        if (existing) {
            existing.remove();
        }
        // Get selection position
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0)
            return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        // Create indicator element
        const indicator = document.createElement('div');
        indicator.id = 'verifis-selection-indicator';
        indicator.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top - 35}px;
      background: #3b82f6;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: none;
      animation: fadeIn 0.2s ease-out;
    `;
        indicator.textContent = 'Verifis will fact-check this...';
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
        // Auto-remove after 2 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, 2000);
    }
    // Show notification
    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.getElementById('verifis-notification');
        if (existing) {
            existing.remove();
        }
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'verifis-notification';
        notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      max-width: 300px;
      word-wrap: break-word;
    `;
        notification.textContent = message;
        document.body.appendChild(notification);
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    // Show fact-check result
    showFactCheckResult(result) {
        console.log('🔍 Debug: Showing fact-check result:', result);
        // The main popup opening is handled in autoFactCheck method
        // This method is kept for potential future use or manual fact-checking
        console.log('🔍 Fact-check result ready for popup display');
    }
    // Open extension popup
    openExtensionPopup() {
        try {
            console.log('🔍 Debug: Requesting extension popup to open...');
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        }
        catch (error) {
            console.error('🔍 Debug: Failed to request popup opening:', error);
        }
    }
    // Show detailed result overlay
    showResultOverlay(result) {
        // Remove existing overlay
        const existing = document.getElementById('verifis-result-overlay');
        if (existing) {
            existing.remove();
        }
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'verifis-result-overlay';
        overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      max-height: 80vh;
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 16px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-y: auto;
      animation: slideIn 0.3s ease-out;
    `;
        // Score badge
        const scoreColor = result.overall >= 70 ? '#dcfce7' : result.overall >= 40 ? '#fef3c7' : '#fee2e2';
        const scoreTextColor = result.overall >= 70 ? '#166534' : result.overall >= 40 ? '#92400e' : '#991b1b';
        overlay.innerHTML = `
      <div style="padding: 24px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 20px; font-weight: 600;">🔍 Verifis Fact-Check Result</h3>
          <button id="verifis-close-overlay" style="background: rgba(255,255,255,0.2); border: none; font-size: 20px; cursor: pointer; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <div style="background: ${scoreColor}; color: ${scoreTextColor}; padding: 12px 16px; border-radius: 8px; font-weight: 600; text-align: center; font-size: 16px;">
          Overall Score: ${result.overall}/100
        </div>
      </div>
      <div style="padding: 20px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Summary:</h4>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #4b5563;">${result.summary}</p>
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Sources (${result.sources.length}):</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${result.sources.map((source, index) => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 8px; background: #f9fafb;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 500; color: #6b7280;">${source.domain}</span>
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${source.stance === 'supports' ? '#dcfce7' : source.stance === 'refutes' ? '#fee2e2' : '#fef3c7'}; color: ${source.stance === 'supports' ? '#166534' : source.stance === 'refutes' ? '#991b1b' : '#92400e'};">${source.stance}</span>
              </div>
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">Credibility: ${source.credibility}/100</div>
              <div style="font-size: 12px; color: #374151;">
                ${source.evidence.map((evidence) => `• ${evidence}`).join('<br>')}
              </div>
            </div>
          `).join('')}
        </div>
        <div style="margin-top: 16px; text-align: center;">
          <button id="verifis-open-popup" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer;">Open in Extension</button>
        </div>
      </div>
    `;
        // Add CSS animation
        if (!document.getElementById('verifis-overlay-styles')) {
            const style = document.createElement('style');
            style.id = 'verifis-overlay-styles';
            style.textContent = `
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translate(-50%, -50%) scale(0.9); 
          }
          to { 
            opacity: 1; 
            transform: translate(-50%, -50%) scale(1); 
          }
        }
      `;
            document.head.appendChild(style);
        }
        document.body.appendChild(overlay);
        // Close button
        const closeBtn = overlay.querySelector('#verifis-close-overlay');
        closeBtn?.addEventListener('click', () => {
            overlay.remove();
        });
        // Close on background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        // Auto-close after 60 seconds (longer for better UX)
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        }, 60000);
    }
}
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SelectionHandler();
    });
}
else {
    new SelectionHandler();
}


/******/ })()
;