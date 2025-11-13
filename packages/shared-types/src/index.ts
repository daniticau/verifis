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
  confidence?: number; // Optional confidence score from Gemini
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

