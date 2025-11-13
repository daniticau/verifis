import { BACKEND_URL, SHARED_SECRET_HEADER } from "../constants";
import type { FactcheckRequest, FactcheckResponse } from "../types";

// Shared secret - should be set via environment variable at build time
const SHARED_SECRET = import.meta.env.VITE_SHARED_SECRET || "";

export async function factcheckText(
  request: FactcheckRequest
): Promise<FactcheckResponse> {
  const response = await fetch(`${BACKEND_URL}/factcheck`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SHARED_SECRET_HEADER]: SHARED_SECRET,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Backend error: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  return response.json();
}

