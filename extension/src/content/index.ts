import { SELECTION_STABLE_MS, MAX_SELECTION_CHARS } from "../constants";
import { debounce } from "./debounce";
import { showTooltip, showErrorTooltip, removeTooltip } from "./tooltip";
import type { ExtensionMessage, FactcheckResultMessage } from "../types";

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
  const range = getSelectionRange();

  // If selection is empty or changed, clear tooltip
  if (!text || text !== currentSelection) {
    removeTooltip();
    currentSelection = "";
    currentRange = null;
    return;
  }

  // If text is too long, truncate client-side
  if (text.length > MAX_SELECTION_CHARS) {
    // Still send, backend will handle truncation
  }

  // Store current range for tooltip positioning
  currentRange = range;

  // Send message to background
  chrome.runtime.sendMessage(
    {
      type: "CHECK_SELECTION",
      text,
      url: window.location.href,
    } as ExtensionMessage,
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Extension error:", chrome.runtime.lastError);
        if (currentRange) {
          showErrorTooltip(
            chrome.runtime.lastError.message || "Unknown error",
            currentRange
          );
        }
        return;
      }

      if (!response.success) {
        if (currentRange) {
          showErrorTooltip(
            response.error || "Failed to fact-check selection",
            currentRange
          );
        }
      }
      // Success case handled by message listener below
    }
  );
}

// Listen for results from background
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, _sendResponse) => {
    if (message.type === "FACTCHECK_RESULT") {
      const resultMessage = message as FactcheckResultMessage;

      if (resultMessage.error) {
        if (currentRange) {
          showErrorTooltip(resultMessage.error, currentRange);
        }
        return;
      }

      if (resultMessage.payload && currentRange) {
        showTooltip(resultMessage.payload, currentRange);
      } else if (currentRange) {
        // Empty result
        showTooltip({ claims: [] }, currentRange);
      }
    }
  }
);

// Handle selection changes
function handleSelectionChange(): void {
  const text = getSelectionText();

  // If selection cleared, remove tooltip
  if (!text) {
    removeTooltip();
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

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  removeTooltip();
});

