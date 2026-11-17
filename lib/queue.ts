import redis from "@/lib/redis";

export async function enqueueNotification(payload: Record<string, any>) {
  await redis.lpush("notifications", JSON.stringify(payload));
}