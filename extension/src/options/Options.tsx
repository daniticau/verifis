import { useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
  type ExtensionSettings,
  DEFAULT_SETTINGS,
} from "../storage/settings";

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const loaded = await getSettings();
      setSettings(loaded);
    } catch (err) {
      setError("Failed to load settings");
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleApiKeyChange(value: string) {
    setSettings((prev) => ({ ...prev, geminiApiKey: value }));
    setSaved(false);
  }

  function handleAutoPopupChange(value: boolean) {
    setSettings((prev) => ({ ...prev, autoOpenPopup: value }));
    setSaved(false);
  }

  function handleDebounceChange(value: number) {
    setSettings((prev) => ({ ...prev, debounceMs: value }));
    setSaved(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              Verifis Settings
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure your fact-checking extension
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* API Key Section */}
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="apiKey"
                  value={settings.geminiApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            {/* Auto Open Popup */}
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="autoPopup"
                  className="block text-sm font-medium text-gray-700"
                >
                  Auto-open popup after fact check
                </label>
                <p className="text-xs text-gray-500">
                  Automatically show the popup when fact-checking completes
                </p>
              </div>
              <button
                type="button"
                id="autoPopup"
                onClick={() => handleAutoPopupChange(!settings.autoOpenPopup)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.autoOpenPopup ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoOpenPopup ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Debounce Time */}
            <div>
              <label
                htmlFor="debounce"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Selection delay: {settings.debounceMs}ms
              </label>
              <input
                type="range"
                id="debounce"
                min="500"
                max="3000"
                step="100"
                value={settings.debounceMs}
                onChange={(e) => handleDebounceChange(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Wait time after selecting text before starting fact check
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {saved && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-600">Settings saved!</p>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            How to use Verifis
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Get a free Gemini API key from Google AI Studio</li>
            <li>Enter your API key above and save</li>
            <li>Highlight any text on a webpage</li>
            <li>Wait for the fact-check results to appear</li>
            <li>Click on the extension icon to see detailed results</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
