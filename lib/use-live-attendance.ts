"use client";

import { useEffect, useState } from "react";
import { streamAttendance } from "./api/client";
import type { AttendanceEvent } from "./api/types";

/**
 * Subscribes to the company's live punch stream. The API has no endpoint for past punches,
 * so only events that arrive while this hook is mounted are known. Reconnects every 5 s if the stream drops.
 */
export function useLiveAttendance(limit = 50) {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function run() {
      try {
        setConnected(true);
        await streamAttendance((d) => setEvents((prev) => [d as AttendanceEvent, ...prev].slice(0, limit)), ctl.signal);
      } catch {
        // fall through to the reconnect below
      }
      if (ctl.signal.aborted) return;
      setConnected(false);
      timer = setTimeout(run, 5000);
    }
    run();

    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [limit]);

  return { events, connected };
}
