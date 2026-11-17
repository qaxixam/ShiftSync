import clsx from "clsx";
import type { Shift } from "@/lib/api/types";
import { fmtDuration, fmtHours, fmtTime, hoursBetween, isLongShift } from "@/lib/time";

export interface Punch {
  inAt?: string;
  outAt?: string;
}

const tagOf = (s: Shift) => `No. ${s._id.slice(-4).toUpperCase()}`;

/** One paper card per shift. Punches come only from the live stream (see the note on the Today page). */
export function TimeCard({
  shift,
  name,
  sub,
  punch,
  now,
}: {
  shift: Shift;
  name: string;
  sub?: string;
  punch?: Punch;
  now: number;
}) {
  const open = shift.status === "open";
  const planned = hoursBetween(shift.startTime, shift.endTime);
  const start = new Date(shift.startTime).getTime();

  let inStamp: React.ReactNode = null;
  if (punch?.inAt) {
    const lateMin = Math.ceil((new Date(punch.inAt).getTime() - start) / 60000);
    inStamp =
      lateMin > 0 ? (
        <span className="stamp text-stamp-red">Late {lateMin} Min</span>
      ) : (
        <span className="stamp text-stamp-in">On Time</span>
      );
  }

  // Footer: what we can honestly say from the punches we know about.
  let foot: React.ReactNode;
  let progress: number | null = null;
  if (open) {
    foot = now < start ? `Starts in ${fmtDuration(start - now)}` : "Started, still unfilled";
  } else if (punch?.outAt && punch.inAt) {
    foot = <span className="num font-semibold">{fmtHours(hoursBetween(punch.inAt, punch.outAt))} worked</span>;
  } else if (punch?.inAt) {
    const worked = Math.max(0, (now - new Date(punch.inAt).getTime()) / 36e5);
    progress = Math.min(100, (worked / planned) * 100);
    foot = <span className="num font-semibold">{fmtHours(worked)}</span>;
  } else {
    foot = now < start ? `Starts in ${fmtDuration(start - now)}` : `Started at ${fmtTime(shift.startTime)}`;
  }

  return (
    <article
      className={clsx(
        "rounded-card transition-transform duration-150 ease-out hover:-translate-y-0.5",
        open
          ? "border-2 border-dashed border-on-desk-muted text-on-desk"
          : "bg-paper text-ink shadow-[0_1px_0_#00000040]",
      )}
    >
      <header className="flex items-start justify-between gap-2 px-3.5 pb-2.5 pt-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-bold leading-tight tracking-tight">{name}</h3>
          {sub && <p className={clsx("truncate text-[13px]", open ? "text-on-desk-muted" : "text-ink-muted")}>{sub}</p>}
        </div>
        <span
          className={clsx(
            "num shrink-0 rounded-[3px] border px-1.5 py-0.5 text-[11px]",
            open ? "border-on-desk-muted text-on-desk-muted" : "border-rule text-ink-muted",
          )}
        >
          {open ? "Open" : tagOf(shift)}
        </span>
      </header>
      <hr className={clsx("border-0 border-t-2 border-dashed", open ? "border-desk-line" : "border-rule")} />
      <dl className="px-3.5 py-1.5">
        <Row label="Plan" open={open}>
          <span className="num whitespace-nowrap text-[15px] font-medium">
            {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
          </span>
          {isLongShift(shift) && <span className="stamp text-stamp-red">Over 8 h</span>}
        </Row>
        {open ? (
          <Row label="Who" open>
            <span className="num text-[14px] text-on-desk-muted">Nobody yet</span>
          </Row>
        ) : (
          <>
            <Row label="In" open={false}>
              {punch?.inAt ? (
                <>
                  <span className="num text-[15px] font-medium">{fmtTime(punch.inAt)}</span>
                  {inStamp}
                </>
              ) : (
                <span className="num text-[14px] text-ink-muted">No punch yet</span>
              )}
            </Row>
            <Row label="Out" open={false}>
              {punch?.outAt ? (
                <span className="num text-[15px] font-medium">{fmtTime(punch.outAt)}</span>
              ) : (
                <span className="num text-[14px] text-ink-muted">—</span>
              )}
            </Row>
          </>
        )}
      </dl>
      <footer
        className={clsx(
          "flex items-center justify-between gap-3 rounded-b-card px-3.5 py-2 text-[13px]",
          open ? "bg-desk-2" : "bg-paper-2",
        )}
      >
        <span>{foot}</span>
        {progress !== null && (
          <span
            role="img"
            aria-label={`${Math.round(progress)}% of the planned shift done`}
            className="h-1.5 w-24 overflow-hidden rounded-[3px] bg-[#d9cda3]"
          >
            <i className="block h-full bg-stamp-in" style={{ width: `${progress}%` }} />
          </span>
        )}
      </footer>
    </article>
  );
}

function Row({ label, open, children }: { label: string; open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "grid grid-cols-[44px_1fr] items-center gap-2 border-b py-2 last:border-b-0",
        open ? "border-desk-line" : "border-[#d6cba4]",
      )}
    >
      <dt className={clsx("num text-[11px] font-semibold uppercase tracking-wide", open ? "text-on-desk-muted" : "text-ink-muted")}>
        {label}
      </dt>
      <dd className="flex flex-wrap items-center justify-between gap-2">{children}</dd>
    </div>
  );
}
