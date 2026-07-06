import { useState, useCallback } from 'react';

export interface HistoryEntry {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  matched: number;
  failed: number;
  total: number;
}

const STORAGE_KEY = 'transfer_music_history';

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
    setHistory((prev) => {
      const next = [
        { ...entry, id: crypto.randomUUID(), createdAt: Date.now() },
        ...prev,
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, addEntry };
}
