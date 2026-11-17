"use client";

import { Loader2 } from "lucide-react";
import clsx from "clsx";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "stamp" | "outline";
  loading?: boolean;
};

/** One button pair: navy "stamp" for the main action, outlined for the rest. 44px minimum height. */
export function Button({ variant = "outline", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 text-[15px] font-bold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60",
        variant === "stamp" && "bg-stamp-in text-white hover:bg-[#27458a]",
        variant === "outline" && "border-2 border-ink text-ink hover:bg-ink hover:text-paper",
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}

/** Input that sits on a paper card. */
export const inputCls =
  "min-h-11 w-full rounded-card border border-rule bg-[#fbf7e6] px-3 text-[15px] text-ink transition-[border-color] duration-150 placeholder:text-ink-muted hover:border-ink-muted";

/** Placeholder block. Give it the exact size of the thing it stands in for. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={clsx("animate-pulse rounded-card bg-desk-2", className)} />
);

/** Empty state on the dark desk: says what is missing and what to do. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border-2 border-dashed border-on-desk-muted/60 px-5 py-6">
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 max-w-[52ch] text-on-desk-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** Error that sits on a paper card: stamped in red, says what to do next. */
export function ErrorNote({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong. Try again.";
  return (
    <p role="alert" className="rounded-card border-2 border-stamp-red px-3 py-2 text-[14px] font-semibold text-stamp-red">
      {message}
    </p>
  );
}
