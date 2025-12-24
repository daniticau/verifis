import { STORAGE_KEY_PREFIX, EXPLAIN_STORAGE_KEY_PREFIX } from "../constants";
import type { TabFactcheckData, TabExplainData } from "../types";

export function getStorageKey(tabId: number): string {
  return `${STORAGE_KEY_PREFIX}${tabId}`;
}

export async function storeTabData(
  tabId: number,
  data: TabFactcheckData
): Promise<void> {
  const key = getStorageKey(tabId);
  await chrome.storage.local.set({ [key]: data });
}

export async function getTabData(
  tabId: number
): Promise<TabFactcheckData | null> {
  const key = getStorageKey(tabId);
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

export async function clearTabData(tabId: number): Promise<void> {
  const key = getStorageKey(tabId);
  await chrome.storage.local.remove(key);
}

// Explain mode storage functions
export function getExplainStorageKey(tabId: number): string {
  return `${EXPLAIN_STORAGE_KEY_PREFIX}${tabId}`;
}

export async function storeExplainTabData(
  tabId: number,
  data: TabExplainData
): Promise<void> {
  const key = getExplainStorageKey(tabId);
  await chrome.storage.local.set({ [key]: data });
}

export async function getExplainTabData(
  tabId: number
): Promise<TabExplainData | null> {
  const key = getExplainStorageKey(tabId);
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

export async function clearExplainTabData(tabId: number): Promise<void> {
  const key = getExplainStorageKey(tabId);
  await chrome.storage.local.remove(key);
}

