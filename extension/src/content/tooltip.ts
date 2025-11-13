import type { FactcheckResponse, Claim } from "../types";

let tooltipElement: HTMLDivElement | null = null;

export function createTooltip(claims: Claim[]): HTMLDivElement {
  // Remove existing tooltip if present
  removeTooltip();

  const tooltip = document.createElement("div");
  tooltip.id = "verifis-tooltip";
  tooltip.style.cssText = `
    position: absolute;
    z-index: 999999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 12px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1f2937;
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  `;

  const title = document.createElement("div");
  title.textContent = "Fact Check";
  title.style.cssText = `
    font-weight: 600;
    font-size: 16px;
    color: #111827;
  `;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => removeTooltip();

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Claims list
  const claimsList = document.createElement("div");
  claims.forEach((claim, idx) => {
    const claimDiv = document.createElement("div");
    claimDiv.style.cssText = `
      margin-bottom: ${idx < claims.length - 1 ? "12px" : "0"};
      padding-bottom: ${idx < claims.length - 1 ? "12px" : "0"};
      border-bottom: ${idx < claims.length - 1 ? "1px solid #f3f4f6" : "none"};
    `;

    const claimText = document.createElement("div");
    claimText.textContent = claim.claim;
    claimText.style.cssText = `
      font-weight: 500;
      margin-bottom: 8px;
      color: #111827;
    `;

    // Show top 1-2 sources
    const topSources = claim.sources.slice(0, 2);
    if (topSources.length > 0) {
      const sourcesDiv = document.createElement("div");
      sourcesDiv.style.cssText = "font-size: 12px; color: #6b7280;";

      topSources.forEach((source) => {
        const sourceLink = document.createElement("a");
        sourceLink.href = source.url;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = `${source.title} (${source.domain})`;
        sourceLink.style.cssText = `
          display: block;
          margin-top: 4px;
          color: #2563eb;
          text-decoration: none;
        `;
        sourceLink.onmouseover = () => {
          sourceLink.style.textDecoration = "underline";
        };
        sourceLink.onmouseout = () => {
          sourceLink.style.textDecoration = "none";
        };
        sourcesDiv.appendChild(sourceLink);
      });

      claimDiv.appendChild(claimText);
      claimDiv.appendChild(sourcesDiv);
    } else {
      claimDiv.appendChild(claimText);
    }

    claimsList.appendChild(claimDiv);
  });

  tooltip.appendChild(header);
  tooltip.appendChild(claimsList);

  // Click outside to close
  const handleClickOutside = (e: MouseEvent) => {
    if (tooltip && !tooltip.contains(e.target as Node)) {
      removeTooltip();
      document.removeEventListener("click", handleClickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", handleClickOutside);
  }, 0);

  tooltipElement = tooltip;
  return tooltip;
}

export function showTooltip(
  result: FactcheckResponse,
  selectionRange: Range
): void {
  // Show error if present in meta
  if (result.meta?.error) {
    showErrorTooltip(result.meta.error, selectionRange);
    return;
  }

  if (result.claims.length === 0) {
    showEmptyTooltip(selectionRange);
    return;
  }

  const tooltip = createTooltip(result.claims);
  positionTooltip(tooltip, selectionRange);
  document.body.appendChild(tooltip);
}

function showEmptyTooltip(selectionRange: Range): void {
  const tooltip = document.createElement("div");
  tooltip.id = "verifis-tooltip";
  tooltip.style.cssText = `
    position: absolute;
    z-index: 999999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #6b7280;
  `;
  tooltip.textContent = "No factual claims detected in this text.";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7280;
  `;
  closeBtn.onclick = () => removeTooltip();
  tooltip.appendChild(closeBtn);

  positionTooltip(tooltip, selectionRange);
  tooltipElement = tooltip;
  document.body.appendChild(tooltip);
}

export function showErrorTooltip(message: string, selectionRange: Range): void {
  const tooltip = document.createElement("div");
  tooltip.id = "verifis-tooltip";
  tooltip.style.cssText = `
    position: absolute;
    z-index: 999999;
    background: white;
    border: 1px solid #ef4444;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #dc2626;
  `;
  tooltip.textContent = `Error: ${message}`;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7280;
  `;
  closeBtn.onclick = () => removeTooltip();
  tooltip.appendChild(closeBtn);

  positionTooltip(tooltip, selectionRange);
  tooltipElement = tooltip;
  document.body.appendChild(tooltip);
}

function positionTooltip(tooltip: HTMLDivElement, range: Range): void {
  const rect = range.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Position below selection, or above if near bottom
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const tooltipHeight = 200; // Approximate

  let top: number;
  if (spaceBelow > tooltipHeight || spaceBelow > spaceAbove) {
    top = rect.bottom + scrollY + 8;
  } else {
    top = rect.top + scrollY - tooltipHeight - 8;
  }

  // Center horizontally relative to selection
  const left = rect.left + scrollX + rect.width / 2 - 200; // 200 = half of max-width
  tooltip.style.top = `${Math.max(8, top)}px`;
  tooltip.style.left = `${Math.max(8, left)}px`;
}

export function removeTooltip(): void {
  if (tooltipElement && tooltipElement.parentNode) {
    tooltipElement.parentNode.removeChild(tooltipElement);
    tooltipElement = null;
  }
}

