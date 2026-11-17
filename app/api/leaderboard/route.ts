import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import redis from "@/lib/redis";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    await connectDB();
    const companyId = req.headers.get("x-company-id");

    const leaderboardKey = `leaderboard:${companyId}`;

    // Top 10 employees, highest score pehle
    const raw = await redis.zrevrange(leaderboardKey, 0, 9, "WITHSCORES");

    // raw aise aata hai: [userId1, score1, userId2, score2, ...]
    const results = [];
    for (let i = 0; i < raw.length; i += 2) {
      const userId = raw[i];
      const score = Number(raw[i + 1]);
      const user = await User.findById(userId).select("name email");
      results.push({ user, score });
    }

    return NextResponse.json({ leaderboard: results });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}