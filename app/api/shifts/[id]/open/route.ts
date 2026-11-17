import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import Shift from "@/models/Shift";

export async function PATCH(
  req: Request,
 { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const companyId = req.headers.get("x-company-id");

    const shift = await Shift.findById(id);   
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    if (shift.assignedTo?.toString() !== userId) {
      return NextResponse.json(
        { error: "You can only open your own shift" },
        { status: 403 }
      );
    }

    shift.status = "open";
    await shift.save();

    await redis.del(`shifts:${companyId}`);

    return NextResponse.json({ message: "Shift marked as open", shift });
  } catch (err) {
    console.error("Open shift error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}