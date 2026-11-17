import { NextResponse } from "next/server";
import redis from "@/lib/redis";

export async function GET(req: Request) {
  try {
    const companyId = req.headers.get("x-company-id");
    const daysParam = new URL(req.url).searchParams.get("days");
    const days = daysParam ? parseInt(daysParam) : 7;

    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];

      const stats = await redis.hgetall(`stats:${companyId}:${dateKey}`);
      results.push({
        date: dateKey,
        clockins: Number(stats.clockins || 0),
        totalHours: Number(stats.totalHours || 0),
      });
    }

    return NextResponse.json({ analytics: results.reverse() });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}