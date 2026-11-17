import { NextResponse } from "next/server";
import redis from "@/lib/redis";

export async function GET(req: Request) {
  try {
    const companyId = req.headers.get("x-company-id");
    const dateParam = new URL(req.url).searchParams.get("date");
    const date = dateParam || new Date().toISOString().split("T")[0];

    const key = `active:${companyId}:${date}`;
    const count = await redis.pfcount(key);

    return NextResponse.json({ date, uniqueActiveEmployees: count });
  } catch (err) {
    console.error("Active employees error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}