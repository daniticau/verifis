import type {
  FactcheckRequest,
  FactcheckResponse,
  Claim,
  Source,
} from "@verifis/shared-types";

export type { FactcheckRequest, FactcheckResponse, Claim, Source };

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

