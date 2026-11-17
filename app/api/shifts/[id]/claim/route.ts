import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import Shift from "@/models/Shift";
import { enqueueNotification } from "@/lib/queue";

export async function POST(
  req: Request,
   { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const userId = req.headers.get("x-user-id");
    const companyId = req.headers.get("x-company-id");
   const { id } = await params;
   const shiftId = id;

    const lockKey = `lock:shift:${shiftId}`;

    // Lock lagane ki koshish karo
    const acquired = await redis.set(lockKey, userId as string, "PX", 5000, "NX");

    if (!acquired) {
      return NextResponse.json(
        { error: "Someone else is claiming this shift right now, try again" },
        { status: 409 }
      );
    }

    try {
      const shift = await Shift.findById(shiftId);

      if (!shift || shift.status !== "open") {
        return NextResponse.json(
          { error: "This shift is no longer available" },
          { status: 409 }
        );
      }

      shift.assignedTo = userId;
      shift.status = "scheduled";
      await shift.save();
      await enqueueNotification({
              type: "shift-claimed",
              shiftId,
              claimedBy: userId,
              time: new Date(),
            });   

      await redis.del(`shifts:${companyId}`);

      return NextResponse.json({ message: "Shift claimed successfully", shift });
    } finally {
      // Lock hamesha release karo, chahe success ho ya error
      await redis.del(lockKey);
    }
  } catch (err) {
    console.error("Claim shift error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}