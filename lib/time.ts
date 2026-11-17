import type { PersonRef, Shift } from "./api/types";

/** A shift longer than this is flagged. The API has no overtime rule, so this is a UI-only threshold. */
export const LONG_SHIFT_HOURS = 8;

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const fmtTime = (iso: string | number | Date) => timeFmt.format(new Date(iso));
export const fmtDay = (iso: string | number | Date) => dayFmt.format(new Date(iso));
export const fmtDayLong = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);

export const isSameDay = (a: string | number | Date, b: string | number | Date) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export const hoursBetween = (a: string | number | Date, b: string | number | Date) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 36e5;

export const fmtHours = (h: number) => `${(Math.round(h * 10) / 10).toString()} h`;

export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}

/** "Today", "Tomorrow", or "Wed 18 Nov". */
export function dayLabel(iso: string | number | Date, now: number) {
  if (isSameDay(iso, now)) return "Today";
  if (isSameDay(iso, now + 864e5)) return "Tomorrow";
  return fmtDay(iso);
}

export const assigneeOf =(s: Shift): PersonRef | null =>
  s.assignedTo && typeof s.assignedTo === "object" ? s.assignedTo : null;

export const assigneeId = (s: Shift): string | null =>
  typeof s.assignedTo === "string" ? s.assignedTo : (s.assignedTo?._id ?? null);

export const isLongShift = (s: Pick<Shift, "startTime" | "endTime">) =>
  hoursBetween(s.startTime, s.endTime) > LONG_SHIFT_HOURS;
