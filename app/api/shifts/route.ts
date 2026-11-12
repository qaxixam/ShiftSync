import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import Shift from "@/models/Shift";

// Shift create karna (Admin/Manager only)
export async function POST(req: Request) {
  try {
    await connectDB();

    const role = req.headers.get("x-user-role");
    const companyId = req.headers.get("x-company-id");
    const userId = req.headers.get("x-user-id");

    if (role !== "admin" && role !== "manager") {
      return NextResponse.json(
        { error: "Only admin or manager can create shifts" },
        { status: 403 }
      );
    }

    const { locationId, assignedTo, startTime, endTime } = await req.json();

    const shift = await Shift.create({
      companyId,
      locationId,
      assignedTo: assignedTo || null,
      startTime,
      endTime,
      createdBy: userId,
    });

    // Cache invalidate karo — purana cached list ab outdated hai
    await redis.del(`shifts:${companyId}`);

    return NextResponse.json({ message: "Shift created", shift });
  } catch (err) {
    console.error("Create shift error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Shift list dekhna (sab roles)
export async function GET(req: Request) {
  try {
    await connectDB();

    const companyId = req.headers.get("x-company-id");
    const cacheKey = `shifts:${companyId}`;

    // Step 1: Cache mein check karo
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({ shifts: JSON.parse(cached), fromCache: true });
    }

    // Step 2: Cache miss — DB se lao
    const shifts = await Shift.find({ companyId }).populate("assignedTo", "name email");

    // Step 3: Redis mein store karo, 60 second ke liye (TTL)
    await redis.setex(cacheKey, 60, JSON.stringify(shifts));

    return NextResponse.json({ shifts, fromCache: false });
  } catch (err) {
    console.error("Get shifts error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}