import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  await connectDB();
  redis.set("status", "ok");
  redis.get("status")
  return NextResponse.json({ message: "Database connected and Redis status set." });
  

}