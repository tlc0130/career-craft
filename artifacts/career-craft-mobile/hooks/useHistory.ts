import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "@career_craft_history";
export const MAX_ITEMS = 50;
export const NEAR_CAP_THRESHOLD = 40;

export interface HistoryItem {
  id: string;
  type: "resume" | "cover-letter";
  label: string;
  content: string;
  createdAt: string;
}

// ─── Module-level singleton store ────────────────────────────────────────────
// Shared across all hook instances so every screen sees the same state.
// Writes are atomic: we always update the in-memory cache synchronously first,
// then persist to AsyncStorage, then notify all subscribers.

let cache: HistoryItem[] | null = null;
let loadPromise: Promise<HistoryItem[]> | null = null;
const listeners = new Set<(items: HistoryItem[]) => void>();

function notify(items: HistoryItem[]) {
  listeners.forEach((fn) => fn(items));
}

/** Ensures the cache is populated exactly once from AsyncStorage. */
async function ensureLoaded(): Promise<HistoryItem[]> {
  if (cache !== null) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        cache = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
      } catch {
        cache = [];
      }
      return cache!;
    })();
  }
  return loadPromise;
}

/** Atomically update in-memory cache, notify subscribers, then persist. */
async function commitUpdate(updated: HistoryItem[]) {
  cache = updated; // sync update so next reader sees latest immediately
  notify(updated); // sync notify so all mounted hooks update immediately
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // persistence failure — in-memory state is still updated
  }
}

// ─── Public store actions (used by both hook and one-shot callers) ────────────

export async function addHistoryItem(
  type: HistoryItem["type"],
  jobDescription: string,
  content: string
): Promise<HistoryItem> {
  const current = await ensureLoaded();
  const label = extractLabel(jobDescription);
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    label,
    content,
    createdAt: new Date().toISOString(),
  };
  const updated = [item, ...current].slice(0, MAX_ITEMS);
  await commitUpdate(updated);
  return item;
}

export async function removeHistoryItem(id: string): Promise<void> {
  const current = await ensureLoaded();
  const updated = current.filter((i) => i.id !== id);
  await commitUpdate(updated);
}

export async function renameHistoryItem(id: string, newLabel: string): Promise<void> {
  const current = await ensureLoaded();
  const trimmed = newLabel.trim();
  if (!trimmed) return;
  const updated = current.map((i) =>
    i.id === id ? { ...i, label: trimmed } : i
  );
  await commitUpdate(updated);
}

export async function getHistoryItem(id: string): Promise<HistoryItem | null> {
  const all = await ensureLoaded();
  return all.find((i) => i.id === id) ?? null;
}

export async function clearHistory(): Promise<void> {
  await commitUpdate([]);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>(cache ?? []);
  const [loaded, setLoaded] = useState(cache !== null);

  useEffect(() => {
    const listener = (updated: HistoryItem[]) => {
      setItems([...updated]);
    };
    listeners.add(listener);

    // If not already loaded, trigger the load
    if (cache === null) {
      ensureLoaded().then((data) => {
        setItems([...data]);
        setLoaded(true);
      });
    } else {
      setItems([...cache]);
      setLoaded(true);
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addItem = useCallback(
    (type: HistoryItem["type"], jobDescription: string, content: string) =>
      addHistoryItem(type, jobDescription, content),
    []
  );

  const deleteItem = useCallback(
    (id: string) => removeHistoryItem(id),
    []
  );

  const renameItem = useCallback(
    (id: string, newLabel: string) => renameHistoryItem(id, newLabel),
    []
  );

  const clearAll = useCallback(() => clearHistory(), []);

  return { items, loaded, addItem, deleteItem, renameItem, clearAll };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function extractLabel(jobDescription: string): string {
  const firstLine = jobDescription.trim().split("\n")[0].trim();
  if (firstLine.length > 0) {
    return firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine;
  }
  return "Untitled";
}
