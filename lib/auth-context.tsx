"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { session } from "./api/client";
import type { AuthResponse, SessionUser } from "./api/types";

interface Me extends SessionUser {
  _id: string;
}
type State = { status: "loading" } | { status: "anon" } | { status: "authed"; me: Me };

interface Ctx {
  state: State;
  me: Me | null;
  canManage: boolean;
  signIn: (res: AuthResponse) => void;
  signOut: () => void;
}

const AuthContext = createContext<Ctx | null>(null);

/** The login response omits the user id, but the JWT payload carries it (API_CONTRACT.md, Section 3). */
function userIdFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(part)) as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

function load(): State {
  const token = session.getToken();
  const user = session.getUser<SessionUser>();
  const id = token ? userIdFromToken(token) : null;
  return token && user && id ? { status: "authed", me: { ...user, _id: id } } : { status: "anon" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const router = useRouter();
  const qc = useQueryClient();

  // The session lives in localStorage, so it can only be read after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setState(load()), []);

  const signIn = useCallback((res: AuthResponse) => {
    session.set(res.token, res.user);
    setState(load());
  }, []);

  const signOut = useCallback(() => {
    session.clear();
    qc.clear();
    setState({ status: "anon" });
    router.replace("/login");
  }, [qc, router]);

  const value = useMemo<Ctx>(() => {
    const me = state.status === "authed" ? state.me : null;
    return { state, me, canManage: me?.role === "admin" || me?.role === "manager", signIn, signOut };
  }, [state, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
