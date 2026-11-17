const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const TOKEN_KEY = "shiftsync.token";
const USER_KEY = "shiftsync.user";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The token lives in localStorage because the API reads an Authorization header. */
export const session = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  getUser<T>(): T | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(token: string, user: unknown) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  },
};

const FRIENDLY: Record<number, string> = {
  401: "Your session has expired. Sign in again.",
  403: "You don’t have permission to do that.",
  429: "Too many attempts. Wait a minute and try again.",
};

async function readError(res: Response): Promise<ApiError> {
  let detail = "";
  try {
    const body = await res.json();
    detail = typeof body?.error === "string" ? body.error : "";
  } catch {}
  return new ApiError(res.status, detail || FRIENDLY[res.status] || "Something went wrong. Try again.");
}

export async function api<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const token = session.getToken();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection.");
  }

  if (!res.ok) {
    const err = await readError(res);
    // An expired token on a protected route sends you back to sign in.
    if (res.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
      session.clear();
      // Hard navigation on purpose: it also drops all cached data from the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
    throw err;
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "The server sent an unreadable response.");
  }
}

/**
 * Reads GET /api/attendance/live. EventSource can't send the Authorization header the API
 * requires, so this reads the stream with fetch. Resolves when the stream ends.
 */
export async function streamAttendance(onEvent: (data: unknown) => void, signal: AbortSignal): Promise<void> {
  const token = session.getToken();
  const res = await fetch(`${BASE}/api/attendance/live`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok || !res.body) throw await readError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {}
    }
  }
}
