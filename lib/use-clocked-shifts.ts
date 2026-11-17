"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "shiftsync.clockedIn";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** The API cannot say which shifts you are clocked into, so this device remembers it. */
export function useClockedShifts() {
  const [ids, setIds] = useState<string[]>([]);

  // localStorage is only readable after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setIds(read()), []);

  const set = useCallback((fn: (prev: string[]) => string[]) => {
    setIds((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return {
    ids,
    add: (id: string) => set((p) => [...new Set([...p, id])]),
    remove: (id: string) => set((p) => p.filter((x) => x !== id)),
  };
}
