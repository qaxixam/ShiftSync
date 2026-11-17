"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { AuthResponse, LeaderboardEntry, PersonRef, Shift } from "./types";

export const keys = {
  shifts: ["shifts"] as const,
  leaderboard: ["leaderboard"] as const,
  active: ["active-employees"] as const,
};

/* ---------- auth ---------- */
export const login = (b: { email: string; password: string }) =>
  api<AuthResponse>("/api/auth/login", { method: "POST", body: b });

export const register = (b: { name: string; email: string; password: string; companyName: string }) =>
  api<AuthResponse>("/api/auth/register", { method: "POST", body: b });

/* ---------- reads ---------- */
export const useShifts = () =>
  useQuery({
    queryKey: keys.shifts,
    queryFn: async () => (await api<{ shifts: Shift[] }>("/api/shifts")).shifts,
    refetchInterval: 60_000, // the server caches this list for 60 s
  });

export const useLeaderboard = () =>
  useQuery({
    queryKey: keys.leaderboard,
    queryFn: async () => (await api<{ leaderboard: LeaderboardEntry[] }>("/api/leaderboard")).leaderboard,
  });

/** Unique employees who clocked in today (a HyperLogLog count, so approximate). */
export const useClockedInToday = () =>
  useQuery({
    queryKey: keys.active,
    queryFn: async () =>
      (await api<{ date: string; uniqueActiveEmployees: number }>("/api/analytics/active-employees"))
        .uniqueActiveEmployees,
  });

/* ---------- shift actions ---------- */

/** Claim updates the list first and rolls back if the server says someone else got it. */
export function useClaimShift(me: PersonRef | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/shifts/${id}/claim`, { method: "POST" }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: keys.shifts });
      const prev = qc.getQueryData<Shift[]>(keys.shifts);
      if (prev && me) {
        qc.setQueryData<Shift[]>(
          keys.shifts,
          prev.map((s) => (s._id === id ? { ...s, status: "scheduled", assignedTo: me } : s)),
        );
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.shifts, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.shifts }),
  });
}

/**
 * Release your own shift so anyone can claim it (PATCH /api/shifts/:id/open).
 * The API leaves you as the assignee until someone claims it, so the shift stays linked to you.
 */
export function useReleaseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/shifts/${id}/open`, { method: "PATCH" }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: keys.shifts });
      const prev = qc.getQueryData<Shift[]>(keys.shifts);
      if (prev) qc.setQueryData<Shift[]>(keys.shifts, prev.map((s) => (s._id === id ? { ...s, status: "open" } : s)));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.shifts, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.shifts }),
  });
}

/* ---------- attendance ---------- */
export const useClockIn = () =>
  useMutation({
    mutationFn: (b: { shiftId: string; latitude: number; longitude: number }) =>
      api("/api/attendance/clock-in", { method: "POST", body: b }),
  });

export const useClockOut = () =>
  useMutation({
    mutationFn: (b: { shiftId: string }) => api("/api/attendance/clock-out", { method: "POST", body: b }),
  });
