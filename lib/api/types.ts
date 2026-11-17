/** Shapes below come straight from API_CONTRACT.md. Only what the built pages use is declared. */
export type Role = "admin" | "manager" | "employee";
export type ShiftStatus = "scheduled" | "open" | "claimed" | "completed" | "cancelled";

export interface SessionUser {
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: SessionUser;
}

export interface PersonRef {
  _id: string;
  name: string;
  email: string;
}

/** GET /api/shifts populates assignedTo; write endpoints return a bare id. locationId is never populated. */
export interface Shift {
  _id: string;
  companyId: string;
  locationId: string;
  assignedTo: PersonRef | string | null;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  createdBy: string;
}

/** One frame of GET /api/attendance/live. */
export interface AttendanceEvent {
  employeeId: string;
  shiftId: string;
  status: "clocked-in" | "clocked-out";
  time: string;
}

export interface LeaderboardEntry {
  user: PersonRef | null;
  score: number;
}
