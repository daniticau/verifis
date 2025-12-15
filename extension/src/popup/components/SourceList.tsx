import type { Source } from "../../types";

interface SourceListProps {
  sources: Source[];
}

export default function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No reliable sources found yet.
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-2">Sources</div>
      <div className="space-y-3">
        {sources.map((source, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded p-3 hover:border-blue-300 transition-colors"
          >
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="font-medium text-sm text-blue-600 hover:text-blue-800 mb-1">
                {source.title}
              </div>
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-2 flex-wrap">
                <span>{source.domain}</span>
                {source.confidence !== undefined && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                    {Math.round(source.confidence > 1 ? source.confidence : source.confidence * 100)}% match
                  </span>
                )}
                {source.stance && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      source.stance === "supports"
                        ? "bg-green-100 text-green-700"
                        : source.stance === "contradicts"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {source.stance}
                  </span>
                )}
              </div>
              {source.snippet && (
                <div className="text-xs text-gray-600 line-clamp-2">
                  {source.snippet}
                </div>
              )}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

