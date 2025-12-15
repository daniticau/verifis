import { useEffect, useState } from "react";
import { STORAGE_KEY_PREFIX } from "../constants";
import { getGeminiApiKey } from "../storage/settings";
import type { TabFactcheckData, Claim } from "../types";
import ClaimCard from "./components/ClaimCard";

export default function App() {
  const [data, setData] = useState<TabFactcheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    checkApiKeyAndLoadData();
  }, []);

  async function checkApiKeyAndLoadData() {
    const apiKey = await getGeminiApiKey();
    setHasApiKey(!!apiKey);
    if (apiKey) {
      loadTabData();
    } else {
      setLoading(false);
    }
  }

  async function loadTabData() {
    try {
      setLoading(true);
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        setError("No active tab found");
        return;
      }

      const storageKey = `${STORAGE_KEY_PREFIX}${tab.id}`;
      const result = await chrome.storage.local.get(storageKey);
      const tabData = result[storageKey] as TabFactcheckData | undefined;
      
      if (tabData) {
        setData(tabData);
      } else {
        setError("No fact-check data for this tab. Highlight some text to get started.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadTabData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500 min-h-[400px] flex items-center justify-center">
        <div>
          <p className="mb-2">No fact-check data available.</p>
          <p className="text-sm">Highlight text on a webpage to get started.</p>
        </div>
      </div>
    );
  }

  const result = data.result;
  const hasError = data.error || result?.meta?.error;

  return (
    <div className="w-full min-h-[400px] bg-white">
      <div className="border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Fact Check</h1>
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
        {data.url && (
          <p className="text-xs text-gray-500 mt-1 truncate">{data.url}</p>
        )}
      </div>

      <div className="p-4">
        {hasError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-medium mb-1">Error</div>
            <div className="text-red-600 text-sm">{data.error || result?.meta?.error}</div>
          </div>
        ) : result && result.claims.length > 0 ? (
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
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>No factual claims detected in the selected text.</p>
          </div>
        )}
      </div>
    </div>
  );
}