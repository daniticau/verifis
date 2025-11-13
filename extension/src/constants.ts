export const MAX_SELECTION_CHARS = 1200;
export const SELECTION_STABLE_MS = 1000;
export const MAX_CLAIMS = 3;
export const MAX_SOURCES = 5;
export const STORAGE_KEY_PREFIX = "factcheck:tab:";
export const SHARED_SECRET_HEADER = "X-EXTENSION-TOKEN";

// Backend URL - should be set via environment variable at build time
// For development, use a placeholder that can be overridden
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

