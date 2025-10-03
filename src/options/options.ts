// Options page script for Verifis settings
import { ExtensionSettings } from '../shared/types';

class OptionsController {
  private elements!: {
    status: HTMLElement;
    apiKey: HTMLInputElement;
    primaryModel: HTMLSelectElement;
    fastModel: HTMLSelectElement;
    allowedSites: HTMLTextAreaElement;
    maxResults: HTMLInputElement;
    fromDate: HTMLInputElement;
    strictWhitelist: HTMLInputElement;
    autoFactCheckEnabled: HTMLInputElement;
    autoFactCheckDelay: HTMLInputElement;
    minTextLength: HTMLInputElement;
    fastPreviewEnabled: HTMLInputElement;
    cacheEnabled: HTMLInputElement;
    cacheExpiry: HTMLInputElement;
    saveBtn: HTMLButtonElement;
    resetBtn: HTMLButtonElement;
  };

  private defaultSettings: ExtensionSettings = {
    allowedSites: ['nih.gov', 'who.int', 'nejm.org', 'jamanetwork.com'],
    maxResults: 8,
    fromDate: '2023-01-01',
    strictWhitelist: false,
    autoFactCheckEnabled: true,
    autoFactCheckDelay: 1,
    minTextLength: 20,
    fastPreviewEnabled: false,
    cacheEnabled: true,
    cacheExpiryMinutes: 10
  };

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadSettings();
  }

  private initializeElements() {
    this.elements = {
      status: document.getElementById('status') as HTMLElement,
      apiKey: document.getElementById('api-key') as HTMLInputElement,
      primaryModel: document.getElementById('primary-model') as HTMLSelectElement,
      fastModel: document.getElementById('fast-model') as HTMLSelectElement,
      allowedSites: document.getElementById('allowed-sites') as HTMLTextAreaElement,
      maxResults: document.getElementById('max-results') as HTMLInputElement,
      fromDate: document.getElementById('from-date') as HTMLInputElement,
      strictWhitelist: document.getElementById('strict-whitelist') as HTMLInputElement,
      autoFactCheckEnabled: document.getElementById('auto-fact-check-enabled') as HTMLInputElement,
      autoFactCheckDelay: document.getElementById('auto-fact-check-delay') as HTMLInputElement,
      minTextLength: document.getElementById('min-text-length') as HTMLInputElement,
      fastPreviewEnabled: document.getElementById('fast-preview-enabled') as HTMLInputElement,
      cacheEnabled: document.getElementById('cache-enabled') as HTMLInputElement,
      cacheExpiry: document.getElementById('cache-expiry') as HTMLInputElement,
      saveBtn: document.getElementById('save-btn') as HTMLButtonElement,
      resetBtn: document.getElementById('reset-btn') as HTMLButtonElement
    };
  }

  private setupEventListeners() {
    this.elements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    this.elements.resetBtn.addEventListener('click', () => {
      this.resetToDefaults();
    });

    // Auto-save on input changes (debounced)
    let saveTimeout: ReturnType<typeof setTimeout>;
    const autoSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveSettings();
      }, 1000);
    };

    this.elements.apiKey.addEventListener('input', autoSave);
    this.elements.allowedSites.addEventListener('input', autoSave);
    this.elements.maxResults.addEventListener('input', autoSave);
    this.elements.fromDate.addEventListener('change', autoSave);
    this.elements.strictWhitelist.addEventListener('change', autoSave);
    this.elements.autoFactCheckEnabled.addEventListener('change', autoSave);
    this.elements.autoFactCheckDelay.addEventListener('input', autoSave);
    this.elements.minTextLength.addEventListener('input', autoSave);
    this.elements.fastPreviewEnabled.addEventListener('change', autoSave);
    this.elements.cacheEnabled.addEventListener('change', autoSave);
    this.elements.cacheExpiry.addEventListener('input', autoSave);
  }

  private async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get([
        'XAI_API_KEY',
        'allowedSites',
        'maxResults',
        'fromDate',
        'strictWhitelist',
        'autoFactCheckEnabled',
        'autoFactCheckDelay',
        'minTextLength',
        'fastPreviewEnabled',
        'cacheEnabled',
        'cacheExpiryMinutes'
      ]);

      // Apply stored settings or defaults
      const settings: ExtensionSettings = {
        allowedSites: stored.allowedSites || this.defaultSettings.allowedSites,
        maxResults: stored.maxResults || this.defaultSettings.maxResults,
        fromDate: stored.fromDate || this.defaultSettings.fromDate,
        strictWhitelist: stored.strictWhitelist ?? this.defaultSettings.strictWhitelist,
        autoFactCheckEnabled: stored.autoFactCheckEnabled ?? this.defaultSettings.autoFactCheckEnabled,
        autoFactCheckDelay: stored.autoFactCheckDelay || this.defaultSettings.autoFactCheckDelay,
        minTextLength: stored.minTextLength || this.defaultSettings.minTextLength,
        fastPreviewEnabled: stored.fastPreviewEnabled ?? this.defaultSettings.fastPreviewEnabled,
        cacheEnabled: stored.cacheEnabled ?? this.defaultSettings.cacheEnabled,
        cacheExpiryMinutes: stored.cacheExpiryMinutes || this.defaultSettings.cacheExpiryMinutes
      };

      this.applySettingsToUI(settings);
      this.showStatus('Settings loaded successfully', 'success');

    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  private applySettingsToUI(settings: ExtensionSettings) {
    // Load API key from storage (don't show it in UI for security)
    chrome.storage.sync.get(['XAI_API_KEY'], (result) => {
      if (result.XAI_API_KEY) {
        this.elements.apiKey.value = result.XAI_API_KEY;
      }
    });
    
    this.elements.allowedSites.value = settings.allowedSites.join(', ');
    this.elements.maxResults.value = settings.maxResults.toString();
    this.elements.fromDate.value = settings.fromDate;
    this.elements.strictWhitelist.checked = settings.strictWhitelist;
    this.elements.autoFactCheckEnabled.checked = settings.autoFactCheckEnabled;
    this.elements.autoFactCheckDelay.value = settings.autoFactCheckDelay.toString();
    this.elements.minTextLength.value = settings.minTextLength.toString();
    this.elements.fastPreviewEnabled.checked = settings.fastPreviewEnabled;
    this.elements.cacheEnabled.checked = settings.cacheEnabled;
    this.elements.cacheExpiry.value = settings.cacheExpiryMinutes.toString();
  }

  private getSettingsFromUI(): ExtensionSettings {
    const allowedSitesText = this.elements.allowedSites.value.trim();
    const allowedSites = allowedSitesText 
      ? allowedSitesText.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    return {
      allowedSites,
      maxResults: parseInt(this.elements.maxResults.value) || 8,
      fromDate: this.elements.fromDate.value || '2023-01-01',
      strictWhitelist: this.elements.strictWhitelist.checked,
      autoFactCheckEnabled: this.elements.autoFactCheckEnabled.checked,
      autoFactCheckDelay: parseFloat(this.elements.autoFactCheckDelay.value) || 1,
      minTextLength: parseInt(this.elements.minTextLength.value) || 20,
      fastPreviewEnabled: this.elements.fastPreviewEnabled.checked,
      cacheEnabled: this.elements.cacheEnabled.checked,
      cacheExpiryMinutes: parseInt(this.elements.cacheExpiry.value) || 10
    };
  }

  private async saveSettings() {
    try {
      const settings = this.getSettingsFromUI();
      
      // Validate settings
      const validation = this.validateSettings(settings);
      if (!validation.valid) {
        this.showStatus(`Validation error: ${validation.errors.join(', ')}`, 'error');
        return;
      }

      // Save to Chrome storage
      await chrome.storage.sync.set({
        XAI_API_KEY: this.elements.apiKey.value.trim(),
        allowedSites: settings.allowedSites,
        maxResults: settings.maxResults,
        fromDate: settings.fromDate,
        strictWhitelist: settings.strictWhitelist,
        autoFactCheckEnabled: settings.autoFactCheckEnabled,
        autoFactCheckDelay: settings.autoFactCheckDelay,
        minTextLength: settings.minTextLength,
        fastPreviewEnabled: settings.fastPreviewEnabled,
        cacheEnabled: settings.cacheEnabled,
        cacheExpiryMinutes: settings.cacheExpiryMinutes
      });

      this.showStatus('Settings saved successfully', 'success');

      // Notify background script of settings change
      try {
        chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          payload: settings
        });
      } catch (error) {
        console.warn('Failed to notify background script:', error);
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  private validateSettings(settings: ExtensionSettings): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.maxResults < 1 || settings.maxResults > 20) {
      errors.push('Max results must be between 1 and 20');
    }

    if (settings.cacheExpiryMinutes < 1 || settings.cacheExpiryMinutes > 60) {
      errors.push('Cache expiry must be between 1 and 60 minutes');
    }

    if (settings.fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(settings.fromDate)) {
      errors.push('From date must be in YYYY-MM-DD format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      this.applySettingsToUI(this.defaultSettings);
      await this.saveSettings();
      this.showStatus('Settings reset to defaults', 'info');
    }
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info') {
    const status = this.elements.status;
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
