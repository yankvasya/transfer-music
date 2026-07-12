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
  // Optional for backward compatibility with entries saved before duplicate detection /
  // smart matching existed.
  duplicates?: number;
  needsReview?: number;
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

// A resumable entry stores its full track/matched/failed arrays, so a large import (the
// kind most likely to actually need resuming) can plausibly push total history size past
// localStorage's quota. Swallow that here rather than letting it throw out of `upsert` —
// notably, `upsert` is also called from ImporterProgress's crash-recovery catch block, so
// an unguarded throw here would defeat the whole point of persisting a checkpoint on crash.
function trySetHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to persist import history (storage may be full):', err);
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
      trySetHistory(next);
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
      trySetHistory(next);
      return next;
    });
  }, []);

  return { history, saveProgress, completeEntry, removeEntry };
}
