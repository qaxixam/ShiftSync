import { NextResponse } from "next/server";
import { verifyToken } from "./lib/auth";




const publicRoutes = ["/api/auth/register", "/api/auth/login"];

export async function middleware(req: Request) {
    const path = req.nextUrl.pathname;
    if (publicRoutes.includes(path)) {
        return NextResponse.next();
    }
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.split(" ")[1];
       if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  }
  try {
    const decoded = await verifyToken(token);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", decoded.userId);
    requestHeaders.set("x-user-role", decoded.role);
    requestHeaders.set("x-company-id", decoded.companyId);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (err) {
    console.log("Token verification failed:", err);
  return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
export const config = {
  matcher: ["/api/:path*"],
};

