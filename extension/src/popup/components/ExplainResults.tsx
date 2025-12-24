import type { TabExplainData } from "../../types";

interface ExplainResultsProps {
  data: TabExplainData;
}

export default function ExplainResults({ data }: ExplainResultsProps) {
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

  if (!result) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Loading explanation...</p>
      </div>
    );
  }

  const { background, simpleSummary } = result;
  const hasContent = simpleSummary || background;

  if (!hasContent) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No explanation available for this text.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Text */}
      <div>
        <div className="text-sm text-gray-600 mb-2">Selected text:</div>
        <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
          {data.text.length > 200 ? `${data.text.substring(0, 200)}...` : data.text}
        </div>
        {result.meta?.truncated && (
          <div className="text-xs text-amber-600 mt-1">
            Text was truncated for processing
          </div>
        )}
      </div>

      {/* Simple Summary - Prominent placement */}
      {simpleSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-900 mb-2">
            In Simple Terms
          </div>
          <div className="text-sm text-blue-800">{simpleSummary}</div>
        </div>
      )}

      {/* Background */}
      {background && (
        <div>
          <div className="text-sm font-medium text-gray-900 mb-2">
            Background
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
            {background}
          </div>
        </div>
      )}
    </div>
  );
}
