import { useEffect, useState } from "react";
import { STORAGE_KEY_PREFIX, EXPLAIN_STORAGE_KEY_PREFIX, MODE_STORAGE_KEY } from "../constants";
import { getGeminiApiKey } from "../storage/settings";
import type { TabFactcheckData, TabExplainData, Claim, AppMode } from "../types";
import ClaimCard from "./components/ClaimCard";
import ExplainResults from "./components/ExplainResults";

export default function App() {
  const [mode, setMode] = useState<AppMode>("factcheck");
  const [data, setData] = useState<TabFactcheckData | null>(null);
  const [explainData, setExplainData] = useState<TabExplainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    checkApiKeyAndLoadData();
  }, []);

  async function checkApiKeyAndLoadData() {
    // Load current mode
    const modeResult = await chrome.storage.local.get(MODE_STORAGE_KEY);
    const currentMode = (modeResult[MODE_STORAGE_KEY] as AppMode) || "factcheck";
    setMode(currentMode);

    const apiKey = await getGeminiApiKey();
    setHasApiKey(!!apiKey);
    if (apiKey) {
      loadTabData(currentMode);
    } else {
      setLoading(false);
    }
  }

  async function loadTabData(currentMode?: AppMode) {
    const modeToUse = currentMode || mode;
    try {
      setLoading(true);
      setError(null);
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        setError("No active tab found");
        return;
      }

      if (modeToUse === "explain") {
        const storageKey = `${EXPLAIN_STORAGE_KEY_PREFIX}${tab.id}`;
        const result = await chrome.storage.local.get(storageKey);
        const tabData = result[storageKey] as TabExplainData | undefined;

        if (tabData) {
          setExplainData(tabData);
          setData(null);
        } else {
          setError("No explanation data for this tab. Highlight some text to get started.");
        }
      } else {
        const storageKey = `${STORAGE_KEY_PREFIX}${tab.id}`;
        const result = await chrome.storage.local.get(storageKey);
        const tabData = result[storageKey] as TabFactcheckData | undefined;

        if (tabData) {
          setData(tabData);
          setExplainData(null);
        } else {
          setError("No fact-check data for this tab. Highlight some text to get started.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleModeChange(newMode: AppMode) {
    if (newMode === mode) return;

    // Clear current results immediately
    setData(null);
    setExplainData(null);
    setError(null);

    // Store new mode
    await chrome.storage.local.set({ [MODE_STORAGE_KEY]: newMode });
    setMode(newMode);

    // Clear stored data for current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.storage.local.remove(`${STORAGE_KEY_PREFIX}${tab.id}`);
      await chrome.storage.local.remove(`${EXPLAIN_STORAGE_KEY_PREFIX}${tab.id}`);
    }

    // Show message to highlight text
    setError(`Highlight text on a webpage to get ${newMode === "explain" ? "an explanation" : "a fact-check"}.`);
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="p-6 text-center min-h-[400px] flex flex-col items-center justify-center">
        <div className="mb-4">
          <svg
            className="w-16 h-16 mx-auto text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          API Key Required
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Please configure your Gemini API key to start fact-checking.
        </p>
        <button
          onClick={openSettings}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Open Settings
        </button>
      </div>
    );
  }

  // Check if we have data for the current mode
  const hasData = mode === "explain" ? explainData : data;
  const currentUrl = mode === "explain" ? explainData?.url : data?.url;

  // Render mode toggle header
  const renderHeader = () => (
    <div className="border-b border-gray-200 p-4 bg-gray-50">
      <div className="flex items-center gap-2">
        {/* Mode Toggle */}
        <div className="flex flex-1 bg-gray-200 rounded-lg p-1">
          <button
            onClick={() => handleModeChange("factcheck")}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === "factcheck"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Fact Check
          </button>
          <button
            onClick={() => handleModeChange("explain")}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === "explain"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Explain
          </button>
        </div>

        <button
          onClick={openSettings}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
          title="Settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {currentUrl && (
        <p className="text-xs text-gray-500 mt-2 truncate">{currentUrl}</p>
      )}
    </div>
  );

  // Show error or no-data state with header
  if (error || !hasData) {
    return (
      <div className="w-full min-h-[400px] bg-white">
        {renderHeader()}
        <div className="p-6 text-center text-gray-500 flex items-center justify-center min-h-[300px]">
          <div>
            <p>{error || `No ${mode === "explain" ? "explanation" : "fact-check"} data available.`}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render content based on mode
  const renderContent = () => {
    if (mode === "explain" && explainData) {
      return <ExplainResults data={explainData} />;
    }

    if (mode === "factcheck" && data) {
      const result = data.result;
      const hasError = data.error || result?.meta?.error;

      if (hasError) {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-medium mb-1">Error</div>
            <div className="text-red-600 text-sm">{data.error || result?.meta?.error}</div>
          </div>
        );
      }

      if (result && result.claims.length > 0) {
        return (
          <>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Selected text:</div>
              <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
                {data.text.length > 200
                  ? `${data.text.substring(0, 200)}...`
                  : data.text}
              </div>
              {result.meta?.truncated && (
                <div className="text-xs text-amber-600 mt-1">
                  Text was truncated for processing
                </div>
              )}
            </div>

            <div className="space-y-4">
              {result.claims.map((claim: Claim, idx: number) => (
                <ClaimCard key={idx} claim={claim} index={idx} />
              ))}
            </div>
          </>
        );
      }

      return (
        <div className="text-center text-gray-500 py-8">
          <p>No factual claims detected in the selected text.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full min-h-[400px] bg-white">
      {renderHeader()}
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  );
}