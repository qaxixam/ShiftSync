"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Button, EmptyState, ErrorNote, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  useClaimShift,
  useClockedInToday,
  useClockIn,
  useClockOut,
  useLeaderboard,
  useShifts,
} from "@/lib/api/hooks";
import { useLiveAttendance } from "@/lib/use-live-attendance";
import { useClockedShifts } from "@/lib/use-clocked-shifts";
import { assigneeId, assigneeOf, fmtDay, fmtDayLong, fmtTime, isLongShift, isSameDay } from "@/lib/time";
import { TimeCard, type Punch } from "./timecard";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can’t share your location."));
    navigator.geolocation.getCurrentPosition(
      resolve,
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Location access is blocked. Allow it in your browser settings to clock in."
              : "Couldn’t get your location. Try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}

export default function TodayPage() {
  const { me } = useAuth();
  const shifts = useShifts();
  const clockedToday = useClockedInToday();
  const board = useLeaderboard();
  const live = useLiveAttendance();
  const clocked = useClockedShifts();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const claim = useClaimShift(me ? { _id: me._id, name: me.name, email: me.email } : null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Wall clock for "starts in" and elapsed hours; a 30 s tick is enough.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const all = shifts.data;

  const today = useMemo(
    () =>
      (all ?? [])
        .filter((s) => s.status !== "cancelled" && isSameDay(s.startTime, now))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [all, now],
  );

  const names = useMemo(() => {
    const m = new Map<string, string>();
    (all ?? []).forEach((s) => {
      const p = assigneeOf(s);
      if (p) m.set(p._id, p.name);
    });
    if (me) m.set(me._id, me.name);
    return m;
  }, [all, me]);

  const punches = useMemo(() => {
    const m = new Map<string, Punch>();
    [...live.events].reverse().forEach((e) => {
      const p = m.get(e.shiftId) ?? {};
      if (e.status === "clocked-in") m.set(e.shiftId, { ...p, inAt: e.time, outAt: undefined });
      else m.set(e.shiftId, { ...p, outAt: e.time });
    });
    return m;
  }, [live.events]);

  const open = useMemo(
    () =>
      (all ?? [])
        .filter((s) => s.status === "open" && new Date(s.endTime).getTime() > now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [all, now],
  );

  const scheduledPeople = new Set(today.map(assigneeId).filter(Boolean)).size;
  const longToday = today.filter(isLongShift).length;
  const mine = today.find(
    (s) => assigneeId(s) === me?._id && (s.status === "scheduled" || s.status === "claimed") && new Date(s.endTime).getTime() > now,
  );
  const mineClocked = mine ? clocked.ids.includes(mine._id) : false;
  const punchError = clockIn.error ?? clockOut.error;

  async function onClockIn(shiftId: string) {
    setGeoError(null);
    clockIn.reset();
    try {
      const pos = await getPosition();
      clockIn.mutate(
        { shiftId, latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        { onSuccess: () => clocked.add(shiftId) },
      );
    } catch (e) {
      setGeoError((e as Error).message);
    }
  }

  const clockedCount = clockedToday.data ?? 0;
  const headline = shifts.isLoading
    ? "Loading Today"
    : open.length > 0
      ? `${clockedCount} Clocked In Today, ${open.length} ${open.length === 1 ? "Shift Needs" : "Shifts Need"} Someone`
      : `${clockedCount} Clocked In Today, Every Shift Has a Person`;

  return (
    <>
      <div className="mb-5 mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="max-w-[22ch] text-[clamp(28px,4.2vw,44px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
            {headline}
          </h1>
          <p className="num mt-2 text-[14px] text-on-desk-muted">
            <time dateTime={new Date(now).toISOString().slice(0, 10)}>{fmtDayLong(new Date(now))}</time>
          </p>
        </div>
        <div role="group" aria-label="Today at a glance" className="flex gap-7">
          <Kpi value={clockedCount} of={scheduledPeople} label="Clocked In" loading={clockedToday.isLoading || shifts.isLoading} />
          <Kpi value={open.length} label="Open Shifts" hot={open.length > 0} loading={shifts.isLoading} />
          <Kpi value={longToday} label="Over 8 h" hot={longToday > 0} loading={shifts.isLoading} />
        </div>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="cards-h">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="cards-h" className="text-[13px] font-bold text-on-desk-muted">
              Today’s Cards
            </h2>
            <span className="flex items-center gap-2 text-[13px] text-on-desk-muted">
              <i
                aria-hidden
                className={`size-2 rounded-full ${live.connected ? "animate-pulse bg-[#7ee0a6]" : "bg-on-desk-muted"}`}
              />
              <span className="num">{live.connected ? "Live" : "Reconnecting…"}</span>
            </span>
          </div>
          <p className="mb-3 max-w-[70ch] text-[13px] text-on-desk-muted">
            Punches show as they happen. The API can’t list earlier punches, so anything before you opened this page reads “No punch yet”.
          </p>

          {shifts.error ? (
            <div className="mb-3 rounded-card bg-paper p-3">
              <ErrorNote error={shifts.error} />
              <Button className="mt-2" onClick={() => shifts.refetch()}>Try Again</Button>
            </div>
          ) : null}

          {shifts.isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5" aria-busy="true" aria-label="Loading cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[232px]" />
              ))}
            </div>
          ) : today.length === 0 ? (
            <EmptyState
              title="No shifts today"
              body="Shifts that start today appear here as cards. The API doesn’t let this app create shifts yet, so they come from wherever your team schedules them."
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
              {today.map((s) => {
                const person = assigneeOf(s);
                const id = assigneeId(s);
                const name = s.status === "open" ? "Unfilled" : (person?.name ?? (id ? (names.get(id) ?? "Unknown") : "Unfilled"));
                return (
                  <TimeCard
                    key={s._id}
                    shift={s}
                    name={name}
                    sub={person?.email}
                    punch={punches.get(s._id)}
                    now={now}
                  />
                );
              })}
            </div>
          )}
        </section>

        <aside aria-label="Side panels" className="grid gap-6">
          <section aria-labelledby="phone-h">
            <h2 id="phone-h" className="mb-2 text-[13px] font-bold text-on-desk-muted">
              Your Punch
            </h2>
            <div className="rounded-card bg-paper p-4 text-ink">
              {shifts.isLoading ? (
                <Skeleton className="h-[148px] bg-paper-2" />
              ) : mine ? (
                <div className="grid gap-3">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-ok">
                    <MapPin className="size-4" strokeWidth={1.6} aria-hidden />
                    {mineClocked ? "You are clocked in" : "Clock in at the shift location"}
                  </p>
                  <div className="rounded-card border border-dashed border-rule bg-paper-2 px-3.5 py-3">
                    <p className="text-[13px] text-ink-muted">Your Shift</p>
                    <p className="num text-[30px] leading-[1.1] tracking-tight">
                      {fmtTime(mine.startTime)} – {fmtTime(mine.endTime)}
                    </p>
                  </div>
                  {geoError || punchError ? <ErrorNote error={geoError ? new Error(geoError) : punchError} /> : null}
                  {mineClocked ? (
                    <Button
                      variant="outline"
                      loading={clockOut.isPending}
                      className="min-h-14 text-[17px]"
                      onClick={() => {
                        clockOut.reset();
                        clockOut.mutate({ shiftId: mine._id }, { onSuccess: () => clocked.remove(mine._id) });
                      }}
                    >
                      Clock Out
                    </Button>
                  ) : (
                    <Button variant="stamp" loading={clockIn.isPending} className="min-h-14 text-[17px]" onClick={() => onClockIn(mine._id)}>
                      Clock In
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-[14px] text-ink-muted">You have no shift left today. Open shifts you can claim are listed below.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="open-h">
            <h2 id="open-h" className="mb-2 flex justify-between text-[13px] font-bold text-on-desk-muted">
              Open Shifts <span className="num font-normal">{open.length}</span>
            </h2>
            {claim.error ? <div className="mb-2 rounded-card bg-paper p-2"><ErrorNote error={claim.error} /></div> : null}
            {shifts.isLoading ? (
              <div className="grid gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[62px]" />)}</div>
            ) : open.length === 0 ? (
              <EmptyState title="No open shifts" body="When a shift is released or posted without a person, you can claim it here." />
            ) : (
              <ul className="grid gap-2">
                {open.slice(0, 6).map((s) => (
                  <li key={s._id} className="flex items-center justify-between gap-3 rounded-card bg-paper px-3 py-2.5 text-ink">
                    <div>
                      <b className="num block text-[15px]">
                        {isSameDay(s.startTime, now) ? "Today" : fmtDay(s.startTime)} {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                      </b>
                      {isLongShift(s) && <span className="text-[13px] text-stamp-red">Over 8 h</span>}
                    </div>
                    <Button
                      loading={claim.isPending && claim.variables === s._id}
                      onClick={() => claim.mutate(s._id)}
                      aria-label={`Claim shift on ${fmtDay(s.startTime)} at ${fmtTime(s.startTime)}`}
                    >
                      Claim
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="lb-h">
            <h2 id="lb-h" className="mb-1 flex justify-between text-[13px] font-bold text-on-desk-muted">
              Most Clock-Ins <span className="font-normal">All Time</span>
            </h2>
            {board.isLoading ? (
              <Skeleton className="h-[120px]" />
            ) : (board.data ?? []).length === 0 ? (
              <p className="py-2 text-[14px] text-on-desk-muted">The ranking starts with the first clock-in.</p>
            ) : (
              <ol>
                {board.data!.slice(0, 5).map((e, i) => (
                  <li key={e.user?._id ?? i} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-desk-line px-1 py-2.5 last:border-b-0">
                    <span className="num text-[14px] text-focus">{i + 1}</span>
                    <span className="truncate">{e.user?.name ?? "Removed user"}</span>
                    <span className="num">{e.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="feed-h">
            <h2 id="feed-h" className="mb-2 text-[13px] font-bold text-on-desk-muted">Just Now</h2>
            {live.events.length === 0 ? (
              <p className="text-[14px] text-on-desk-muted">Punches from your company show up here the moment they happen.</p>
            ) : (
              <ul aria-live="polite" className="grid gap-2 text-[14px]">
                {live.events.slice(0, 6).map((e, i) => (
                  <li key={`${e.time}-${i}`} className="flex justify-between gap-3">
                    <span>
                      {names.get(e.employeeId) ?? "A teammate"} {e.status === "clocked-in" ? "clocked in" : "clocked out"}
                    </span>
                    <time className="num text-[13px] text-on-desk-muted">{fmtTime(e.time)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Kpi({
  value,
  of,
  label,
  hot,
  loading,
}: {
  value: number;
  of?: number;
  label: string;
  hot?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="border-l border-desk-line pl-3.5">
      <b className={`num block text-[34px] font-medium leading-none tracking-[-0.04em] ${hot ? "text-[#ffb4a8]" : ""}`}>
        {loading ? <Skeleton className="h-[34px] w-12" /> : value}
        {!loading && of !== undefined && <small className="text-lg text-on-desk-muted">/{of}</small>}
      </b>
      <span className="text-[13px] text-on-desk-muted">{label}</span>
    </div>
  );
}
