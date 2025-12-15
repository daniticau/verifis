import { SELECTION_STABLE_MS, MAX_SELECTION_CHARS } from "../constants";
import { debounce } from "./debounce";
import type { ExtensionMessage } from "../types";

let currentSelection: string = "";
let currentRange: Range | null = null;
let debouncedCheck: (() => void) | null = null;

function getSelectionText(): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }
  return selection.toString().trim();
}

function getSelectionRange(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  return selection.getRangeAt(0);
}

function checkSelection(): void {
  const text = getSelectionText();

  // If selection is empty or changed, reset state
  if (!text || text !== currentSelection) {
    currentSelection = "";
    currentRange = null;
    return;
  }

  // If text is too long, truncate client-side
  if (text.length > MAX_SELECTION_CHARS) {
    // Still send, backend will handle truncation
  }

  // Store current range
  currentRange = getSelectionRange();

  // Send message to background (data will be stored and available in popup)
  chrome.runtime.sendMessage(
    {
      type: "CHECK_SELECTION",
      text,
      url: window.location.href,
    } as ExtensionMessage,
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Extension error:", chrome.runtime.lastError);
        return;
      }

      if (!response.success) {
        console.error("Factcheck failed:", response.error);
      }
      // Success - data is stored by background script, available in popup
    }
  );
}

// Listen for results from background (data is already stored, no need to show tooltip)
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, _sendResponse) => {
    if (message.type === "FACTCHECK_RESULT") {
      // Data is already stored by background script
      // No tooltip display - user can view results in extension popup
      if (message.error) {
        console.error("Factcheck error:", message.error);
      }
    }
  }
);

// Handle selection changes
function handleSelectionChange(): void {
  const text = getSelectionText();

  // If selection cleared, reset state
  if (!text) {
    currentSelection = "";
    currentRange = null;
    return;
  }

  // If selection changed, update and reset debounce
  if (text !== currentSelection) {
    currentSelection = text;
    currentRange = getSelectionRange();

    // Create new debounced function if needed
    if (!debouncedCheck) {
      debouncedCheck = debounce(() => {
        // Verify selection hasn't changed during debounce
        const currentText = getSelectionText();
        if (currentText === currentSelection && currentText.length > 0) {
          checkSelection();
        }
      }, SELECTION_STABLE_MS);
    }

    debouncedCheck();
  }
}

// Listen to selection events
document.addEventListener("selectionchange", handleSelectionChange);
document.addEventListener("mouseup", handleSelectionChange);

