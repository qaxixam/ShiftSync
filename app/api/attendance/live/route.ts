import redis from "@/lib/redis";



export async function GET(req: Request) {
  const companyId = req.headers.get("x-company-id");
  const channel = `attendance:${companyId}`;
  const subscriber = redis.duplicate(); // alag connection banaya

  const stream = new ReadableStream({
    start(controller) {
      subscriber.subscribe(channel);

      subscriber.on("message", (_channel, message) => {
        controller.enqueue(`data: ${message}\n\n`);
      });
    },
    cancel() {
      subscriber.unsubscribe(channel);
      subscriber.quit();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}