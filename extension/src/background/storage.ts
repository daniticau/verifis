import { STORAGE_KEY_PREFIX } from "../constants";
import type { TabFactcheckData } from "../types";

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

