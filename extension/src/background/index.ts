import { MAX_SELECTION_CHARS } from "../constants";
import { factcheckText } from "./api";
import { storeTabData, getStorageKey } from "./storage";
import type {
  ExtensionMessage,
  CheckSelectionMessage,
  TabFactcheckData,
} from "../types";

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: any) => void
  ) => {
    if (message.type === "CHECK_SELECTION") {
      handleCheckSelection(message, sender.tab?.id)
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((error) => {
          console.error("Factcheck error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }
  }
);

async function handleCheckSelection(
  message: CheckSelectionMessage,
  tabId: number | undefined
): Promise<void> {
  if (!tabId) {
    throw new Error("No tab ID available");
  }

  // Validate and truncate text
  let text = message.text.trim();
  if (text.length === 0) {
    throw new Error("Empty text selection");
  }

  const truncated = text.length > MAX_SELECTION_CHARS;
  if (truncated) {
    text = text.substring(0, MAX_SELECTION_CHARS);
  }

  // Store loading state
  const loadingData: TabFactcheckData = {
    text: message.text,
    url: message.url,
    result: null,
    timestamp: Date.now(),
  };
  await storeTabData(tabId, loadingData);

  try {
    // Call backend
    const result = await factcheckText({
      text,
      url: message.url,
    });

    // Store result
    const finalData: TabFactcheckData = {
      text: message.text,
      url: message.url,
      result,
      timestamp: Date.now(),
    };
    await storeTabData(tabId, finalData);

    // Send message to content script
    chrome.tabs.sendMessage(tabId, {
      type: "FACTCHECK_RESULT",
      payload: result,
    } as ExtensionMessage);
  } catch (error) {
    // Store error state
    const errorData: TabFactcheckData = {
      text: message.text,
      url: message.url,
      result: null,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
    await storeTabData(tabId, errorData);

    // Send error to content script
    chrome.tabs.sendMessage(tabId, {
      type: "FACTCHECK_RESULT",
      payload: null,
      error: error instanceof Error ? error.message : "Unknown error",
    } as ExtensionMessage);

    throw error;
  }
}

