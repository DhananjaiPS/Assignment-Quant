import { Queue } from "bullmq";

const connection: any = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
};

if (process.env.REDIS_PASSWORD) {
  connection.password = process.env.REDIS_PASSWORD;
}

if (process.env.REDIS_TLS === "true" || process.env.REDIS_HOST?.includes("upstash.io")) {
  connection.tls = {};
}

export const videoExtractionQueue = new Queue(
  "video-extraction-queue",
  {
    connection,
  }
);