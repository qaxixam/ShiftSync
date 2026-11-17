"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorNote, Field, inputCls } from "@/components/ui";
import { login, register } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const router = useRouter();
  const { signIn, state } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (state.status === "authed") router.replace("/today");
  }, [state.status, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      const res = isLogin
        ? await login({ email: text("email"), password })
        : await register({ name: text("name"), email: text("email"), password, companyName: text("companyName") });
      signIn(res);
      router.replace("/today");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <main id="main" className="mx-auto grid min-h-screen max-w-[1100px] items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_420px]">
      <section aria-label="About ShiftSync" className="order-2 lg:order-1">
        <p className="mb-6 flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <svg viewBox="0 0 28 28" fill="none" className="size-7" aria-hidden="true">
            <rect x="3" y="3" width="22" height="22" rx="3" stroke="#F2EBD3" strokeWidth="2" />
            <circle cx="14" cy="14" r="4" fill="#FFD36B" />
            <path d="M3 9h22" stroke="#F2EBD3" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          ShiftSync
        </p>
        <h1 className="max-w-[16ch] text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
          Schedule shifts. Fill gaps. See who is on site.
        </h1>
        <p className="mt-4 max-w-[46ch] text-on-desk-muted">
          One card per person per day. Staff punch in at the shift location, and managers see it as it happens.
        </p>
        {/* A sample card: the product's core object, shown instead of a slogan. */}
        <div aria-hidden="true" className="mt-8 hidden max-w-[300px] rounded-card bg-paper text-ink lg:block">
          <div className="flex items-start justify-between px-3.5 pb-2.5 pt-3.5">
            <div>
              <p className="text-[17px] font-bold leading-tight">Amira Khan</p>
              <p className="text-[13px] text-ink-muted">Counter · Harbor St</p>
            </div>
            <span className="num rounded-[3px] border border-rule px-1.5 py-0.5 text-[11px] text-ink-muted">No. 0412</span>
          </div>
          <hr className="border-0 border-t-2 border-dashed border-rule" />
          <div className="num space-y-1.5 px-3.5 py-2.5 text-[15px]">
            <p className="flex justify-between"><span className="text-[11px] font-semibold text-ink-muted">PLAN</span>07:00 – 15:00</p>
            <p className="flex items-center justify-between"><span className="text-[11px] font-semibold text-ink-muted">IN</span>06:58 <span className="stamp text-stamp-in">On Time</span></p>
          </div>
        </div>
      </section>

      <section className="order-1 lg:order-2">
        <form onSubmit={onSubmit} className="rounded-card bg-paper text-ink shadow-[0_1px_0_#00000040]">
          <header className="flex items-start justify-between px-5 pb-3 pt-5">
            <h2 className="text-[22px] font-bold leading-tight tracking-tight">
              {isLogin ? "Sign In" : "Create Your Company"}
            </h2>
            <span className="num rounded-[3px] border border-rule px-1.5 py-0.5 text-[11px] text-ink-muted">
              {isLogin ? "Staff Entrance" : "New Account"}
            </span>
          </header>
          <hr className="border-0 border-t-2 border-dashed border-rule" />
          <div className="space-y-4 px-5 py-5">
            {!isLogin && (
              <>
                <Field label="Your Name">
                  <input name="name" required autoComplete="name" className={inputCls} />
                </Field>
                <Field label="Company Name">
                  <input name="companyName" required autoComplete="organization" className={inputCls} />
                </Field>
              </>
            )}
            <Field label="Email">
              <input name="email" type="email" required autoComplete="email" spellCheck={false} placeholder="you@company.com…" className={inputCls} />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                className={inputCls}
              />
            </Field>
            {error ? <ErrorNote error={error} /> : null}
            <Button type="submit" variant="stamp" loading={busy} className="w-full">
              {isLogin ? "Sign In" : "Create Company"}
            </Button>
            {!isLogin && (
              <p className="text-[12px] text-ink-muted">You become the company admin. Add managers and staff after you sign in.</p>
            )}
          </div>
          <footer className="rounded-b-card bg-paper-2 px-5 py-3 text-[14px] text-ink-muted">
            {isLogin ? "New company? " : "Already have an account? "}
            <Link href={isLogin ? "/register" : "/login"} className="font-bold text-ink underline underline-offset-2">
              {isLogin ? "Create One" : "Sign In"}
            </Link>
          </footer>
        </form>
      </section>
    </main>
  );
}
