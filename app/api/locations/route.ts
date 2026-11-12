import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Location from "@/models/Location";
import redis from "@/lib/redis";

export async function POST(req: Request) {
  try {
    await connectDB();

    const role = req.headers.get("x-user-role");
    const companyId = req.headers.get("x-company-id");

    if (role !== "admin") {
      return NextResponse.json({ error: "Only admin can add locations" }, { status: 403 });
    }

    const { name, latitude, longitude, radiusMeters } = await req.json();

    const location = await Location.create({
      name,
      companyId,
      latitude,
      longitude,
      radiusMeters: radiusMeters || 100,
    });
    await redis.geoadd("geo:locations", longitude, latitude, location._id.toString());

    return NextResponse.json({ message: "Location created", location });
  } catch (err) {
    console.error("Create location error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}