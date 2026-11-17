"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, ErrorNote, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useClaimShift, useReleaseShift, useShifts } from "@/lib/api/hooks";
import type { Shift } from "@/lib/api/types";
import { assigneeId, assigneeOf, dayLabel, fmtHours, fmtTime, hoursBetween, isLongShift } from "@/lib/time";

export default function OpenShiftsPage() {
  const { me } = useAuth();
  const shifts = useShifts();
  const meRef = me ? { _id: me._id, name: me.name, email: me.email } : null;
  const claim = useClaimShift(meRef);
  const release = useReleaseShift();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const open = useMemo(
    () =>
      (shifts.data ?? [])
        .filter((s) => s.status === "open" && new Date(s.endTime).getTime() > now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts.data, now],
  );

  const groups = useMemo(() => {
    const m = new Map<string, Shift[]>();
    open.forEach((s) => {
      const k = dayLabel(s.startTime, now);
      m.set(k, [...(m.get(k) ?? []), s]);
    });
    return [...m.entries()];
  }, [open, now]);

  const mine = useMemo(
    () =>
      (shifts.data ?? [])
        .filter(
          (s) =>
            assigneeId(s) === me?._id &&
            (s.status === "scheduled" || s.status === "claimed") &&
            new Date(s.endTime).getTime() > now,
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts.data, me, now],
  );

  const describe = (s: Shift) => `${dayLabel(s.startTime, now)} ${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`;
  const error = claim.error ?? release.error;

  return (
    <>
      <div className="mb-5 mt-6">
        <h1 className="max-w-[22ch] text-[clamp(28px,4.2vw,44px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
          {shifts.isLoading ? "Open Shifts" : open.length === 0 ? "No Open Shifts Right Now" : `${open.length} ${open.length === 1 ? "Shift Needs" : "Shifts Need"} Someone`}
        </h1>
        <p className="mt-2 max-w-[60ch] text-on-desk-muted">
          Claim a shift and it goes onto your card. Release one of yours and anyone can take it.
        </p>
      </div>

      <div role="status" aria-live="polite" className="mb-3 min-h-0">
        {notice && !error ? (
          <p className="rounded-card border-2 border-ok bg-paper px-3 py-2 text-[14px] font-semibold text-ok">{notice}</p>
        ) : null}
      </div>
      {error ? (
        <div className="mb-4 max-w-[640px] rounded-card bg-paper p-3">
          <ErrorNote error={error} />
        </div>
      ) : null}
      {shifts.error ? (
        <div className="mb-4 max-w-[640px] rounded-card bg-paper p-3">
          <ErrorNote error={shifts.error} />
          <Button className="mt-2" onClick={() => shifts.refetch()}>Try Again</Button>
        </div>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="open-h">
          <h2 id="open-h" className="sr-only">Open shifts by day</h2>
          {shifts.isLoading ? (
            <div className="grid gap-2" aria-busy="true" aria-label="Loading open shifts">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px]" />
              ))}
            </div>
          ) : open.length === 0 ? (
            <EmptyState
              title="Nothing to claim"
              body="When a teammate releases a shift, or a shift is posted without a person, it appears here."
            />
          ) : (
            <div className="grid gap-6">
              {groups.map(([day, list]) => (
                <div key={day}>
                  <h3 className="mb-2 text-[13px] font-bold text-on-desk-muted">
                    {day} <span className="num font-normal">· {list.length}</span>
                  </h3>
                  <ul className="grid gap-2">
                    {list.map((s) => {
                      const releasedBy = assigneeOf(s);
                      const byMe = assigneeId(s) === me?._id;
                      const who = byMe
                        ? "Released by you"
                        : releasedBy
                          ? `Released by ${releasedBy.name}`
                          : "Posted without a person";
                      return (
                        <li
                          key={s._id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-paper px-4 py-3 text-ink shadow-[0_1px_0_#00000040] transition-transform duration-150 ease-out hover:-translate-y-0.5"
                        >
                          <div className="min-w-0">
                            <p className="num text-[18px] font-medium">
                              {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                              <span className="ml-3 text-[14px] text-ink-muted">{fmtHours(hoursBetween(s.startTime, s.endTime))}</span>
                            </p>
                            <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                              {who}
                              {isLongShift(s) && <span className="stamp text-stamp-red">Over 8 h</span>}
                            </p>
                          </div>
                          <Button
                            variant="stamp"
                            loading={claim.isPending && claim.variables === s._id}
                            aria-label={`${byMe ? "Take back" : "Claim"} shift ${describe(s)}`}
                            onClick={() => {
                              setNotice(null);
                              claim.reset();
                              release.reset();
                              claim.mutate(s._id, {
                                onSuccess: () => setNotice(`${describe(s)} is now on your card.`),
                              });
                            }}
                          >
                            {byMe ? "Take Back" : "Claim"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside aria-labelledby="mine-h">
          <h2 id="mine-h" className="mb-2 flex justify-between text-[13px] font-bold text-on-desk-muted">
            Your Upcoming Shifts <span className="num font-normal">{shifts.isLoading ? "" : mine.length}</span>
          </h2>
          {shifts.isLoading ? (
            <div className="grid gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px]" />
              ))}
            </div>
          ) : mine.length === 0 ? (
            <EmptyState title="No upcoming shifts" body="Shifts assigned to you, or claimed by you, are listed here so you can release them." />
          ) : (
            <ul className="grid gap-2">
              {mine.map((s) => {
                const asking = confirming === s._id;
                return (
                  <li key={s._id} className="rounded-card bg-paper px-4 py-3 text-ink shadow-[0_1px_0_#00000040]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-ink-muted">{dayLabel(s.startTime, now)}</p>
                        <p className="num text-[16px] font-medium">
                          {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                        </p>
                      </div>
                      {!asking && (
                        <Button
                          aria-label={`Release shift ${describe(s)}`}
                          onClick={() => {
                            setConfirming(s._id);
                            setNotice(null);
                          }}
                        >
                          Release
                        </Button>
                      )}
                    </div>
                    {asking && (
                      <div className="mt-3 border-t-2 border-dashed border-rule pt-3">
                        <p className="mb-2 text-[13px] text-ink-muted">
                          Anyone can claim it once it is released. It stays yours until someone does, and you can take it back.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="stamp"
                            loading={release.isPending && release.variables === s._id}
                            onClick={() => {
                              claim.reset();
                              release.reset();
                              release.mutate(s._id, {
                                onSuccess: () => setNotice(`${describe(s)} is released and listed under Open Shifts.`),
                                onSettled: () => setConfirming(null),
                              });
                            }}
                          >
                            Release Shift
                          </Button>
                          <Button onClick={() => setConfirming(null)}>Keep It</Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
