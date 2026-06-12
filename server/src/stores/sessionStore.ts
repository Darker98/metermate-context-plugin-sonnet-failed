import type { SessionData } from '../types';

const store = new Map<string, SessionData>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export const sessionStore = {
  get(sessionId: string): SessionData | undefined {
    return store.get(sessionId);
  },

  put(data: SessionData): void {
    store.set(data.sessionId, { ...data, updatedAt: Date.now() });
  },

  delete(sessionId: string): void {
    store.delete(sessionId);
  },

  size(): number {
    return store.size;
  },

  sweep(ttlMs: number): void {
    const cutoff = Date.now() - ttlMs;
    for (const [id, session] of store) {
      if (session.updatedAt < cutoff) {
        store.delete(id);
      }
    }
  },

  startSweep(ttlMs: number): void {
    if (sweepTimer) return;
    const interval = Math.min(ttlMs, 60_000);
    sweepTimer = setInterval(() => sessionStore.sweep(ttlMs), interval);
  },

  stopSweep(): void {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  },
};
