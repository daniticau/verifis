// Popup script for Verifis fact-checker
import { FactCheckRequest, FactCheckResponse, FactCheckResult } from '../shared/types';

class PopupController {
  private elements!: {
    claimInput: HTMLTextAreaElement;
    loading: HTMLElement;
    error: HTMLElement;
    errorMessage: HTMLElement;
    result: HTMLElement;
    scoreBadge: HTMLElement;
    summary: HTMLElement;
    sourcesList: HTMLElement;
    settingsLink: HTMLElement;
  };

  private currentResult: FactCheckResult | null = null;
  private autoFactCheckResult: FactCheckResult | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadStoredSettings();
    this.checkForAutoFactCheckResult();
  }

  private initializeElements() {
    this.elements = {
      claimInput: document.getElementById('claim-input') as HTMLTextAreaElement,
      loading: document.getElementById('loading') as HTMLElement,
      error: document.getElementById('error') as HTMLElement,
      errorMessage: document.getElementById('error-message') as HTMLElement,
      result: document.getElementById('result') as HTMLElement,
      scoreBadge: document.getElementById('score-badge') as HTMLElement,
      summary: document.getElementById('summary') as HTMLElement,
      sourcesList: document.getElementById('sources-list') as HTMLElement,
      settingsLink: document.getElementById('settings-link') as HTMLElement
    };
  }

  private setupEventListeners() {
    // Settings link
    this.elements.settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    // Auto-resize textarea
    this.elements.claimInput.addEventListener('input', () => {
      this.autoResizeTextarea();
    });
  }

  private async loadStoredSettings() {
    // No settings to load in simplified popup
  }

  // Check for auto fact-check results from background
  private async checkForAutoFactCheckResult() {
    try {
      // Listen for messages from background about auto fact-check results
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'AUTO_FACT_CHECK_RESULT') {
          console.log('🔍 Debug: Received auto fact-check result in popup:', message.payload);
          this.autoFactCheckResult = message.payload;
          this.displayAutoFactCheckResult();
        }
      });

      // Check if there's a recent result in storage
      const stored = await chrome.storage.local.get(['lastAutoFactCheckResult']);
      if (stored.lastAutoFactCheckResult) {
        const result = stored.lastAutoFactCheckResult;
        const timestamp = result.timestamp || 0;
        const now = Date.now();
        
        // Show result if it's less than 2 minutes old (shorter window for current results)
        if (now - timestamp < 2 * 60 * 1000) {
          console.log('🔍 Debug: Found recent auto fact-check result in storage');
          this.autoFactCheckResult = result;
          this.displayAutoFactCheckResult();
        } else {
          console.log('🔍 Debug: Stored result is too old, clearing');
          // Clear old result
          await chrome.storage.local.remove(['lastAutoFactCheckResult']);
        }
      } else {
        console.log('🔍 Debug: No stored auto fact-check result found');
      }
    } catch (error) {
      console.warn('Failed to check for auto fact-check result:', error);
    }
  }

  // Display auto fact-check result in popup
  private displayAutoFactCheckResult() {
    if (!this.autoFactCheckResult) return;

    console.log('🔍 Debug: Displaying auto fact-check result in popup');
    
    // Pre-fill the textarea with the claim
    this.elements.claimInput.value = this.autoFactCheckResult.claim;
    
    // Auto-resize the textarea to fit the content with a small delay
    setTimeout(() => {
      this.autoResizeTextarea();
    }, 10);
    
    // Show the result
    this.showResult(this.autoFactCheckResult);
    
    // Show a notification that this was an auto fact-check
    this.showAutoFactCheckNotification();
  }

  // Show notification about auto fact-check
  private showAutoFactCheckNotification() {
    // Create a notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = 'Auto fact-check result loaded';
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  // Simplified popup - no manual fact-checking, only shows auto results

  private showResult(result: FactCheckResult) {
    this.hideAll();
    
    // Update score badge
    this.updateScoreBadge(result.overall);
    
    // Update summary
    this.elements.summary.textContent = result.summary;
    
    // Update sources
    this.updateSources(result.sources);
    
    // Show result
    this.elements.result.classList.add('show');
  }

  private updateScoreBadge(score: number) {
    const badge = this.elements.scoreBadge;
    badge.textContent = `Overall Score: ${score}/100`;
    
    // Remove existing classes
    badge.className = 'score-badge';
    
    // Add appropriate class
    if (score >= 70) {
      badge.classList.add('score-high');
    } else if (score >= 40) {
      badge.classList.add('score-medium');
    } else {
      badge.classList.add('score-low');
    }
  }

  private updateSources(sources: any[]) {
    const container = this.elements.sourcesList;
    container.innerHTML = '';

    sources.forEach(source => {
      const sourceElement = document.createElement('div');
      sourceElement.className = 'source-item';
      
      sourceElement.innerHTML = `
        <div class="source-header">
          <span class="source-domain">${source.domain}</span>
          <span class="source-stance stance-${source.stance}">${source.stance}</span>
        </div>
        <div class="source-credibility">Credibility: ${source.credibility}/100</div>
        <div class="source-evidence">
          <ul>
            ${source.evidence.map((evidence: string) => `<li>${evidence}</li>`).join('')}
          </ul>
        </div>
      `;
      
      container.appendChild(sourceElement);
    });
  }

  private hideAll() {
    this.elements.loading.style.display = 'none';
    this.elements.error.style.display = 'none';
    this.elements.result.classList.remove('show');
  }

  // Auto-resize textarea to fit content
  private autoResizeTextarea() {
    const textarea = this.elements.claimInput;
    
    // Store the current scroll position
    const scrollTop = textarea.scrollTop;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Get the scroll height and calculate the exact height needed
    const scrollHeight = textarea.scrollHeight;
    
    // Calculate the new height based on content
    const minHeight = 80; // Minimum height of 80px
    const maxHeight = 300; // Maximum height of 300px (matches CSS)
    const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));
    
    // Set the new height
    textarea.style.height = newHeight + 'px';
    
    // Restore the scroll position
    textarea.scrollTop = scrollTop;
    
    // Also adjust the popup height if needed
    this.adjustPopupHeight();
  }

  // Adjust popup height based on content
  private adjustPopupHeight() {
    const popup = document.body;
    const currentHeight = popup.offsetHeight;
    const minHeight = 500; // Minimum popup height
    const maxHeight = 800; // Maximum popup height
    
    // Calculate content height
    const contentHeight = Math.max(minHeight, popup.scrollHeight);
    const newHeight = Math.min(maxHeight, contentHeight);
    
    // Set popup height
    popup.style.minHeight = newHeight + 'px';
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
