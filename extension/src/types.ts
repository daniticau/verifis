// Types for the fact-check extension (inlined from shared-types for standalone build)

// App mode type
export type AppMode = "factcheck" | "explain";

// Explain mode types
export interface ExplainResponse {
  background: string;
  simpleSummary: string;
  meta?: {
    truncated?: boolean;
    error?: string;
  };
}

export interface TabExplainData {
  text: string;
  url: string;
  result: ExplainResponse | null;
  timestamp: number;
  error?: string;
}

export interface FactcheckRequest {
  text: string;
  url?: string;
  language?: string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  stance?: "supports" | "contradicts" | "unclear";
  confidence?: number;
}

export interface Claim {
  claim: string;
  summary?: string;
  sources: Source[];
}

export interface FactcheckResponse {
  claims: Claim[];
  meta?: {
    truncated?: boolean;
    error?: string;
  };
}

export interface TabFactcheckData {
  text: string;
  url: string;
  result: FactcheckResponse | null;
  timestamp: number;
  error?: string;
}

export interface CheckSelectionMessage {
  type: "CHECK_SELECTION";
  text: string;
  url: string;
  mode: AppMode;
}

export interface FactcheckResultMessage {
  type: "FACTCHECK_RESULT";
  payload: FactcheckResponse | null;
  error?: string;
}

export interface ExplainResultMessage {
  type: "EXPLAIN_RESULT";
  payload: ExplainResponse | null;
  error?: string;
}

export type ExtensionMessage = CheckSelectionMessage | FactcheckResultMessage | ExplainResultMessage;

