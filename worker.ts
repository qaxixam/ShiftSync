import Redis from "ioredis";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const redis = new Redis(process.env.REDIS_URL as string);

async function processQueue() {
  console.log("Worker started, waiting for notifications...");

  while (true) {
    const result = await redis.brpop("notifications", 0);

    if (result) {
      const [, message] = result;
      const notification = JSON.parse(message);
      console.log("📩 Processing notification:", notification);
      // Real app mein yahan Nodemailer/Twilio se actual email/SMS bhejte
    }
  }
}

processQueue();