export interface ExtensionSettings {
  geminiApiKey: string;
  autoOpenPopup: boolean;
  debounceMs: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  geminiApiKey: "",
  autoOpenPopup: true,
  debounceMs: 1000,
};

const SETTINGS_KEY = "verifis:settings";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
  };
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>
): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
}

export async function getGeminiApiKey(): Promise<string> {
  const settings = await getSettings();
  return settings.geminiApiKey;
}

export async function isAutoOpenPopupEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.autoOpenPopup;
}

export async function getDebounceMs(): Promise<number> {
  const settings = await getSettings();
  return settings.debounceMs;
}
