# ShiftSync API Contract

Derived only from the code in `app/api/**/route.ts`, `middleware.ts`, `lib/*` and `models/*`.
Anything the code does not make clear is listed in [Section 6](#6-unclear-or-not-determinable-from-code) instead of being guessed.

---

## 1. Conventions

### Base
- All routes live under `/api` in the same Next.js app. No CORS configuration exists in the repo.
- Request and response bodies are JSON unless stated otherwise.

### Authentication (`middleware.ts`)
- Matcher: `/api/:path*`.
- **Public** (no token): `POST /api/auth/register`, `POST /api/auth/login`. Every other route, including `GET /api/test`, requires a token.
- Header: `Authorization: Bearer <token>`. The token is read as `header.split(" ")[1]`, so the scheme word is not checked.
- Token: JWT, HS256, expires in 7 days, signed with `JWT_SECRET`. Payload: `{ userId, role, companyId }`.
- On success the middleware sets `x-user-id`, `x-user-role`, `x-company-id` on the request. Route handlers trust these headers.

| Case | Status | Body |
|---|---|---|
| No `Authorization` header, or no second word | 401 | `{ "error": "No token provided" }` |
| Token invalid, tampered or expired | 401 | `{ "error": "Invalid token" }` |

### Roles
`admin`, `manager`, `employee`. Roles are checked inside individual routes, not in the middleware. "All roles" below means any valid token.

### Generic 500
Most routes catch every exception and return `500` with `{ "error": "Something went wrong" }` (register uses `"Internal Server Error"`). Validation failures from Mongoose, invalid ObjectIds and Redis failures all end up here.

---

## 2. Data shapes (from `models/*`)

All documents also carry `_id`, `createdAt`, `updatedAt`, `__v` (Mongoose defaults and `timestamps: true`). Dates are serialized as ISO strings.

| Model | Fields |
|---|---|
| User | `name`, `email` (unique), `password` (bcrypt hash, never returned by any route), `role` (`admin`\|`manager`\|`employee`), `companyId` |
| Company | `name`, `createdBy` (User id) |
| Location | `name`, `companyId`, `latitude`, `longitude`, `radiusMeters` (default 100) |
| Shift | `companyId`, `locationId`, `assignedTo` (User id or `null`), `startTime`, `endTime`, `status` (`scheduled`\|`open`\|`claimed`\|`completed`\|`cancelled`, default `scheduled`), `createdBy` |
| Attendance | `employeeId`, `shiftId`, `companyId`, `clockInTime`, `clockOutTime`, `clockInLocation { latitude, longitude }`, `status` (`clocked-in`\|`clocked-out`, default `clocked-in`) |

---

## 3. Auth routes

### POST `/api/auth/register`
- **Auth:** public. Creates a company and its first user, who always gets role `admin`.
- **Body:** `{ name, email, password, companyName }`. All four are required (truthy check).
- **200:**
  ```json
  { "message": "Registered successfully", "token": "<jwt>", "user": { "name": "", "email": "", "role": "admin" } }
  ```
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 400 | `{ "error": "All fields are required" }` | Any field missing or empty |
  | 400 | `{ "error": "User already exists" }` | Email already registered |
  | 500 | `{ "error": "Internal Server Error" }` | Any other exception |

### POST `/api/auth/login`
- **Auth:** public.
- **Body:** `{ email, password }`.
- **200:**
  ```json
  { "message": "Login successful", "token": "<jwt>", "user": { "name": "", "email": "", "role": "admin|manager|employee" } }
  ```
  The user's `_id` and `companyId` are not in the body; they are only inside the token payload.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 400 | `{ "error": "Email and password are required" }` | Either field missing |
  | 401 | `{ "error": "Invalid email or password" }` | Unknown email, or wrong password (same message for both) |
  | unclear | none | Any exception (see Section 6) |

  The 400 and 401 bodies are built with `new Response(JSON.stringify(...))` with no explicit `Content-Type`, unlike other routes that use `NextResponse.json`.

---

## 4. Resource routes

### POST `/api/employees`
- **Auth:** `admin` only.
- **Body:** `{ name, email, password, newRole }`. `newRole` must be `manager` or `employee`. The user is created in the caller's company.
- **200:**
  ```json
  { "message": "Employee added", "user": { "name": "", "email": "", "role": "manager|employee" } }
  ```
  The new user's `_id` is not returned.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 403 | `{ "error": "Only admin can add employees" }` | Caller is not admin |
  | 400 | `{ "error": "Invalid role" }` | `newRole` is not `manager` or `employee` |
  | 500 | generic | Missing `password`, missing `name` or `email`, and other exceptions |

### POST `/api/locations`
- **Auth:** `admin` only.
- **Body:** `{ name, latitude, longitude, radiusMeters? }`. `radiusMeters` falls back to 100 when falsy (so `0` also becomes 100).
- **200:** `{ "message": "Location created", "location": <Location> }`
- **Side effect:** adds the location to the Redis geo set `geo:locations` (a single set shared by all companies).
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 403 | `{ "error": "Only admin can add locations" }` | Caller is not admin |
  | 500 | generic | Missing required fields, Redis failure, etc. |

### POST `/api/shifts`
- **Auth:** `admin` or `manager`.
- **Body:** `{ locationId, assignedTo?, startTime, endTime }`. `assignedTo` defaults to `null`. `status` is not accepted; it is always the default `scheduled`.
- **200:** `{ "message": "Shift created", "shift": <Shift> }`. Here `assignedTo` is a bare id string or `null` (not populated).
- **Side effect:** deletes the Redis cache key `shifts:<companyId>`.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 403 | `{ "error": "Only admin or manager can create shifts" }` | Caller is an employee |
  | 500 | generic | Missing `locationId`, `startTime` or `endTime`, unparseable date, invalid ObjectId |

### GET `/api/shifts`
- **Auth:** all roles. No filtering, pagination or sorting parameters. Returns every shift in the caller's company.
- **200:**
  ```json
  { "shifts": [ { "...Shift fields", "assignedTo": { "_id": "", "name": "", "email": "" } | null } ], "fromCache": false }
  ```
  - `assignedTo` is populated with `name` and `email` only.
  - `locationId` is **not** populated; it is a bare id.
  - Results are cached in Redis for 60 seconds under `shifts:<companyId>`. A cache hit returns `fromCache: true`.
- **Errors:** 500 generic.

### PATCH `/api/shifts/:id/open`
- **Auth:** any valid token, but the caller must be the shift's current assignee. No body.
- **Effect:** sets `status` to `open`. `assignedTo` is left unchanged.
- **200:** `{ "message": "Shift marked as open", "shift": <Shift> }` (`assignedTo` is a bare id).
- **Side effect:** deletes `shifts:<companyId>`.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 404 | `{ "error": "Shift not found" }` | No shift with that id |
  | 403 | `{ "error": "You can only open your own shift" }` | Caller is not `assignedTo` (also when `assignedTo` is `null`) |
  | 500 | generic | Malformed `:id` |

### POST `/api/shifts/:id/claim`
- **Auth:** all roles. No body.
- **Effect:** takes a short Redis lock (`lock:shift:<id>`, 5 s, set-if-absent), then requires `status === "open"`. Sets `assignedTo` to the caller and `status` to `scheduled`. The lock is always released.
- **200:** `{ "message": "Shift claimed successfully", "shift": <Shift> }` (`assignedTo` is a bare id).
- **Side effects:** pushes `{ type: "shift-claimed", shiftId, claimedBy, time }` onto the Redis list `notifications`; deletes `shifts:<companyId>`.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 409 | `{ "error": "Someone else is claiming this shift right now, try again" }` | Lock already held |
  | 409 | `{ "error": "This shift is no longer available" }` | Shift does not exist **or** its status is not `open` |
  | 500 | generic | Malformed `:id`, Redis failure |

---

## 5. Attendance and reporting routes

### POST `/api/attendance/clock-in`
- **Auth:** all roles.
- **Body:** `{ shiftId, latitude, longitude }`.
- **Order of checks:**
  1. Rate limit: 5 requests per 60 seconds per user (`rate-limit:clock-in:<userId>`). Every attempt counts, including failed ones.
  2. Shift lookup.
  3. Location lookup (the shift's `locationId`).
  4. Geofence: the point must be within that location's `radiusMeters`, using the Redis geo set.
- **200:**
  ```json
  { "message": "Clocked in successfully", "attendance": { "employeeId": "", "shiftId": "", "companyId": "", "clockInTime": "", "clockInLocation": { "latitude": 0, "longitude": 0 }, "status": "clocked-in" } }
  ```
- **Side effects:**
  - Increments the `clockins` field of the hash `stats:<companyId>:<YYYY-MM-DD>`.
  - Adds the user to the HyperLogLog `active:<companyId>:<date>`.
  - Pushes `{ type: "clock-in", employeeId, shiftId, time }` onto `notifications`.
  - Increments the user's score in the sorted set `leaderboard:<companyId>` by 1.
  - Publishes `{ employeeId, shiftId, status: "clocked-in", time }` to channel `attendance:<companyId>`.
  - The date is the **UTC** date.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 429 | `{ "error": "Rate limit exceeded" }` | More than 5 calls in the window |
  | 404 | `{ "error": "Shift not found" }` | No shift with that id |
  | 404 | `{ "error": "Location not found" }` | Shift's location missing |
  | 403 | `{ "error": "You are too far from the shift location to clock in" }` | Outside the radius |
  | 500 | generic | Malformed `shiftId`, missing or non-numeric coordinates, Redis failure |

### POST `/api/attendance/clock-out`
- **Auth:** all roles.
- **Body:** `{ shiftId }`.
- **Effect:** finds an attendance record with `employeeId = caller`, that `shiftId`, `status = clocked-in`. Sets `clockOutTime` and `status = clocked-out`.
- **200:** `{ "message": "Clocked out successfully", "attendance": <Attendance> }`
- **Side effects:** adds the worked hours (clock-out minus clock-in, in hours) to the `totalHours` field of `stats:<companyId>:<UTC date of clock-out>`; publishes `{ employeeId, shiftId, status: "clocked-out", time }` to `attendance:<companyId>`.
- **Errors:**
  | Status | Body | When |
  |---|---|---|
  | 404 | `{ "error": "No active clock-in found" }` | No matching open record |
  | 500 | generic | Malformed `shiftId`, etc. |

### GET `/api/attendance/live`
- **Auth:** all roles. Server-sent events stream for the caller's company.
- **Response:** `200`, headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- **Frames:** one per Redis message on `attendance:<companyId>`, formatted `data: <json>\n\n`, where the JSON is `{ "employeeId", "shiftId", "status": "clocked-in" | "clocked-out", "time" }`. No named events, no heartbeat or comment frames, no initial frame.
- **Errors:** none defined in the route. Auth failures come from the middleware (401).
- **Resource handling:** each connection opens its own Redis subscriber, which is closed when the client disconnects.

### GET `/api/leaderboard`
- **Auth:** all roles.
- **200:**
  ```json
  { "leaderboard": [ { "user": { "_id": "", "name": "", "email": "" } | null, "score": 0 } ] }
  ```
  Top 10 by score, highest first. The score is the number of clock-ins recorded for that user. `user` is `null` if the user document no longer exists.
- **Errors:** 500 generic.

### GET `/api/analytics`
- **Auth:** all roles (no role check in the route).
- **Query:** `days` (integer, default 7).
- **200:** `{ "analytics": [ { "date": "YYYY-MM-DD", "clockins": 0, "totalHours": 0 } ] }`
  - Oldest date first; the last entry is today (UTC).
  - Days with no data return zeros.
  - A `days` value that is not a number, or is 0 or negative, returns `{ "analytics": [] }` (the loop never runs).
  - There is no upper limit on `days`.
- **Errors:** 500 generic (for example Redis failure).

### GET `/api/analytics/active-employees`
- **Auth:** all roles.
- **Query:** `date` (default: today in UTC). The format is not validated.
- **200:** `{ "date": "YYYY-MM-DD", "uniqueActiveEmployees": 0 }`. This is a HyperLogLog count, so it is approximate.
- **Errors:** 500 generic.

### GET `/api/test`
- **Auth:** requires a valid token (it is not in the public list).
- **200:** `{ "message": "Database connected and Redis status set." }`. Looks like a connectivity check. The Redis calls are not awaited.

---

## 6. Unclear or not determinable from code

**Behaviour I could not pin down**
1. **`POST /api/auth/login` on an unexpected exception.** The `catch` only logs and returns nothing. The resulting HTTP response is up to Next.js and is not defined in the code.
2. **Duplicate email on `POST /api/employees`.** `User.email` is `unique`, but whether the index exists in your database depends on Mongoose index building. If it does, the failure lands in the generic 500; if not, duplicates would be created silently. Unknown.
3. **Whether `GET /api/attendance/live` actually streams.** The stream enqueues a plain string, whereas web `ReadableStream` responses normally expect bytes. I could not confirm from the code whether this works at runtime.
4. **Accepted date formats** for `startTime`, `endTime` and the `date` query. Whatever Mongoose's `Date` cast accepts for shifts; unvalidated for `date`.
5. **Consumer of the `notifications` Redis list.** Several routes push to it. No code in this repository reads it.
6. **Error `Content-Type`** for the login 400/401 responses (see Section 3).

**Things the contract does not offer (no route exists)**
- No endpoint to list employees, list locations, fetch the current user, or fetch attendance records.
- No endpoint to edit, cancel, delete or complete a shift. Nothing in the code ever sets `claimed`, `completed` or `cancelled`.
- No logout, token refresh, password change, or employee edit or delete.
- No swap or availability concept.

**Behaviours the code implies but where intent is unknown (please confirm)**
- A shift created without `assignedTo` has status `scheduled`, not `open`. Claiming requires `open`, and opening requires being the assignee (`null` never matches). By the code, an unassigned shift cannot become claimable.
- `claim`, `open` and `clock-in` look up the shift by id only. They do not check that it belongs to the caller's company.
- `clock-in` does not check that the shift is assigned to the caller, that the shift's time window is current, or that the caller is not already clocked in (repeat calls create more records until the rate limit hits).
- `open` does not check the current status (a `completed` or `cancelled` shift can be set to `open`).
- Neither clock-in nor clock-out changes the shift's `status`.
- `radiusMeters` is checked against a global Redis geo set (`geo:locations`) shared across companies. Locations created before that set existed would never pass the geofence.
- `x-user-*` headers are overwritten by the middleware on protected routes, so a client cannot spoof them there.

**Tooling note**
- `middleware.ts` types the argument as `Request` but reads `req.nextUrl`. `tsc --noEmit` reports `Property 'nextUrl' does not exist on type 'Request'`. Next 16 also marks the `middleware` file name as deprecated in favour of `proxy`.
