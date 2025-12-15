// Types for the fact-check extension (inlined from shared-types for standalone build)

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
}

export interface FactcheckResultMessage {
  type: "FACTCHECK_RESULT";
  payload: FactcheckResponse | null;
  error?: string;
}

export type ExtensionMessage = CheckSelectionMessage | FactcheckResultMessage;

