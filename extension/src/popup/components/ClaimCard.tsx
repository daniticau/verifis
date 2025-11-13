import { useState } from "react";
import type { Claim } from "../../types";
import SourceList from "./SourceList";

interface ClaimCardProps {
  claim: Claim;
  index: number;
}

export default function ClaimCard({ claim, index }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 mb-1">
              Claim {index + 1}
            </div>
            <div className="text-sm text-gray-700">{claim.claim}</div>
            {claim.sources.length > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                {claim.sources.length} source{claim.sources.length !== 1 ? "s" : ""} found
              </div>
            )}
          </div>
          <div className="ml-4 text-gray-400">
            {expanded ? "▼" : "▶"}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4">
            {claim.summary && (
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Summary
                </div>
                <div className="text-sm text-gray-700">{claim.summary}</div>
              </div>
            )}
            <SourceList sources={claim.sources} />
          </div>
        </div>
      )}
    </div>
  );
}

