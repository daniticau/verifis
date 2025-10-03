// Global type declarations for Chrome extension
/// <reference types="chrome"/>

// Extend the global Window interface if needed
declare global {
  interface Window {
    chrome: typeof chrome;
  }
  
  // For Node.js environment variables in extension context
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
    }
  }
  
  var process: {
    env: NodeJS.ProcessEnv;
  } | undefined;
}

export {};
