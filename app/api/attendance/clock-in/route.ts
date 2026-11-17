import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import Shift from "@/models/Shift";
import Location from "@/models/Location";
import Attendance from "@/models/Attendance";
import { enqueueNotification } from "@/lib/queue";

export async function POST(req: Request) {
  try {
    await connectDB();

    const userId = req.headers.get("x-user-id");
    const { shiftId, latitude, longitude } = await req.json();

    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const location = await Location.findById(shift.locationId);
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Geofence check: employee us location ke radius ke andar hai kya?
    const nearby: string[] = await redis.geosearch(
      "geo:locations",
      "FROMLONLAT",
      longitude,
      latitude,
      "BYRADIUS",
      location.radiusMeters,
      "m",
      "ASC"
    ) as any;

    const isWithinRange = nearby.includes(location._id.toString());

    if (!isWithinRange) {
      return NextResponse.json(
        { error: "You are too far from the shift location to clock in" },
        { status: 403 }
      );
    }

    const attendance = await Attendance.create({
      employeeId: userId,
      shiftId,
      companyId: shift.companyId,
      clockInTime: new Date(),
      clockInLocation: { latitude, longitude },
    });
    await enqueueNotification({
       type: "clock-in",
       employeeId: userId,
        shiftId,
        time: attendance.clockInTime,
        });
        await redis.zincrby(`leaderboard:${shift.companyId}`, 1, userId as string);
    await redis.publish(
  `attendance:${shift.companyId}`,
  JSON.stringify({
    employeeId: userId,
    shiftId,
    status: "clocked-in",
    time: attendance.clockInTime,
  })
);


    return NextResponse.json({ message: "Clocked in successfully", attendance });
  } catch (err) {
    console.error("Clock-in error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}