import { useEffect, useState } from "react";
import { STORAGE_KEY_PREFIX } from "../constants";
import type { TabFactcheckData, FactcheckResponse } from "../types";
import ClaimCard from "./components/ClaimCard";

export default function App() {
  const [data, setData] = useState<TabFactcheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTabData();
  }, []);

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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
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
        <h1 className="text-lg font-semibold text-gray-900">Fact Check</h1>
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
              {result.claims.map((claim, idx) => (
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

