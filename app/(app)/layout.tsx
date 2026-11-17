"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui";

/** Only pages that exist are listed. Each new page adds its entry here. */
const NAV = [
  { href: "/today", label: "Today" },
  { href: "/open-shifts", label: "Open Shifts" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, me, signOut } = useAuth();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "anon") router.replace("/login");
  }, [state.status, router]);

  if (state.status !== "authed") {
    return (
      <div className="mx-auto max-w-[1320px] p-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-14 pt-5 sm:px-6">
      <a
        href="#main"
        className="absolute left-3 top-[-60px] z-10 rounded-card bg-focus px-3.5 py-2.5 font-bold text-ink focus:top-3"
      >
        Skip to Content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-desk-line pb-4">
        <p className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <svg viewBox="0 0 28 28" fill="none" className="size-7" aria-hidden="true">
            <rect x="3" y="3" width="22" height="22" rx="3" stroke="#F2EBD3" strokeWidth="2" />
            <circle cx="14" cy="14" r="4" fill="#FFD36B" />
            <path d="M3 9h22" stroke="#F2EBD3" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          ShiftSync
        </p>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map(({ href, label }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center rounded-card px-4 font-semibold transition-colors duration-150",
                  active ? "bg-paper text-ink" : "text-on-desk-muted hover:bg-desk-2 hover:text-on-desk",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-[14px]">
          <span className="text-on-desk-muted">
            {me?.name} · <span className="capitalize">{me?.role}</span>
          </span>
          <button
            onClick={signOut}
            className="inline-flex min-h-11 items-center rounded-card px-3 font-semibold text-on-desk-muted transition-colors duration-150 hover:bg-desk-2 hover:text-on-desk"
          >
            Sign Out
          </button>
        </div>
      </header>
      <div id="main">{children}</div>
    </div>
  );
}
