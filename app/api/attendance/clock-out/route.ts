import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import Attendance from "@/models/Attendance";

export async function POST(req: Request) {
  try {
    await connectDB();
    const userId = req.headers.get("x-user-id");
    const { shiftId } = await req.json();

    const attendance = await Attendance.findOne({
      employeeId: userId,
      shiftId,
      status: "clocked-in",
    });

    if (!attendance) {
      return NextResponse.json({ error: "No active clock-in found" }, { status: 404 });
    }

    attendance.clockOutTime = new Date();
    attendance.status = "clocked-out";
    await attendance.save();

    await redis.publish(
      `attendance:${attendance.companyId}`,
      JSON.stringify({
        employeeId: userId,
        shiftId,
        status: "clocked-out",
        time: attendance.clockOutTime,
      })
    );

    return NextResponse.json({ message: "Clocked out successfully", attendance });
  } catch (err) {
    console.error("Clock-out error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}