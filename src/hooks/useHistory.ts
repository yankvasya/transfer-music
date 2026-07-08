import { useState, useCallback } from 'react';
import type { ResumeData, ServiceId } from '../types';

export interface HistoryEntry {
  id: string;
  service: ServiceId;
  name: string;
  url: string;
  createdAt: number;
  matched: number;
  failed: number;
  total: number;
  status: 'completed' | 'incomplete';
  resumeData?: ResumeData;
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

type EntrySummary = Omit<HistoryEntry, 'id' | 'createdAt' | 'status' | 'resumeData'>;

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const upsert = useCallback((id: string, patch: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
    setHistory((prev) => {
      const idx = prev.findIndex((h) => h.id === id);
      const entry: HistoryEntry = {
        id,
        createdAt: idx >= 0 ? prev[idx].createdAt : Date.now(),
        ...patch,
      };
      const next = idx >= 0 ? prev.map((h, i) => (i === idx ? entry : h)) : [entry, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Called periodically while an import runs, so it can be resumed after a reload/crash.
  const saveProgress = useCallback(
    (id: string, summary: EntrySummary, resumeData: ResumeData) => {
      upsert(id, { ...summary, status: 'incomplete', resumeData });
    },
    [upsert]
  );

  // Called once an import finishes; drops the resumable payload, keeps just the summary.
  const completeEntry = useCallback(
    (id: string, summary: EntrySummary) => {
      upsert(id, { ...summary, status: 'completed' });
    },
    [upsert]
  );

  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, saveProgress, completeEntry, removeEntry };
}
