import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { extractFrames } from "@/lib/video/extractFrames";

import fs from "fs";
import path from "path";

import { GoogleGenerativeAI } from "@google/generative-ai";

import "dotenv/config";

// ======================================================
// REDIS CONNECTION
// ======================================================

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
};

// ======================================================
// GEMINI INIT
// ======================================================

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

// ======================================================
// SAFE JSON PARSER
// ======================================================

function safeJSONParse(text: string) {
  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {
    console.error("RAW GEMINI RESPONSE:", text);

    throw new Error(
      "Invalid JSON returned from Gemini"
    );
  }
}

// ======================================================
// WORKER
// ======================================================

const worker = new Worker(
  "video-extraction-queue",

  async (job: Job) => {
    const { jobId, productId, fileName } =
      job.data;

    try {
      console.log(
        `\n🚀 [WORKER] Starting extraction for: ${fileName}`
      );

      // ======================================================
      // UPDATE JOB STATUS
      // ======================================================

      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: "RUNNING",
          progress: 10,
        },
      });

      await prisma.jobLog.create({
        data: {
          jobId,
          message: `🚀 Started processing: ${fileName}`,
        },
      });

      // ======================================================
      // EXTRACT FRAMES
      // ======================================================

      const { frames, logMessages } =
        await extractFrames(fileName);

      console.log("FRAMES:", frames);

      for (const msg of logMessages) {
        await prisma.jobLog.create({
          data: {
            jobId,
            message: msg,
          },
        });
      }

      if (!frames.length) {
        throw new Error(
          "No frames extracted from video."
        );
      }

      // ======================================================
      // VALIDATE FRAME FILES
      // ======================================================

      const validFrames: string[] = [];

      for (const frame of frames) {
        let fullPath = frame;

        // convert /uploads/... => absolute path
        if (!path.isAbsolute(frame)) {
          fullPath = path.join(
            process.cwd(),
            "public",
            frame
          );
        }

        console.log(
          "CHECKING FRAME:",
          fullPath
        );

        if (fs.existsSync(fullPath)) {
          validFrames.push(fullPath);
        }
      }

      console.log(
        "VALID FRAMES:",
        validFrames
      );

      if (!validFrames.length) {
        throw new Error(
          "No valid frame files found."
        );
      }

      // ======================================================
      // UPDATE PROGRESS
      // ======================================================

      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          progress: 50,
        },
      });

      // ======================================================
      // PREPARE IMAGES FOR GEMINI
      // ======================================================

      const imageParts = validFrames.map(
        (file) => ({
          inlineData: {
            data: fs
              .readFileSync(file)
              .toString("base64"),

            mimeType: "image/jpeg",
          },
        })
      );

      // ======================================================
      // GEMINI MODEL
      // ======================================================

      const model =
        genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
        });

      // ======================================================
      // PROMPT
      // ======================================================

      const prompt = `
You are an ecommerce AI extraction engine.

Analyze these product images carefully.

Return ONLY valid JSON.

Do NOT use markdown.
Do NOT use triple backticks.

Schema:
{
  "productTitle": "string",
  "brand": "string",
  "category": "string",
  "price": number,
  "mrp": number,
  "color": "string",
  "confidenceScore": number
}
`;

      await prisma.jobLog.create({
        data: {
          jobId,
          message:
            "🧠 Gemini Vision analyzing extracted frames...",
        },
      });

      // ======================================================
      // GEMINI REQUEST
      // ======================================================

      const result =
        await model.generateContent([
          prompt,
          ...imageParts,
        ]);

      const rawText =
        result.response.text();

      console.log(
        "RAW GEMINI RESPONSE:",
        rawText
      );

      const aiData =
        safeJSONParse(rawText);

      console.log("PARSED AI DATA:", aiData);

      // ======================================================
      // UPDATE PRODUCT
      // ======================================================

      await prisma.product.update({
        where: { id: productId },

        data: {
          productTitle:
            aiData.productTitle ||
            "Unknown Product",

          brand:
            aiData.brand || "Unknown",

          category:
            aiData.category || "General",

          price:
            Number(aiData.price) || 0,

          mrp:
            Number(aiData.mrp) || 0,

          color:
            aiData.color || "Unknown",

          confidenceScore:
            Number(
              aiData.confidenceScore
            ) || 0,

          // IMPORTANT FIX
          imageUrl:
            frames[0] || null,

          extractionStatus:
            "COMPLETED",
        },
      });

      // ======================================================
      // COMPLETE JOB
      // ======================================================

      await prisma.processingJob.update({
        where: { id: jobId },

        data: {
          status: "COMPLETED",
          progress: 100,
        },
      });

      await prisma.jobLog.create({
        data: {
          jobId,

          message: `✅ Success! AI Confidence: ${aiData.confidenceScore || 0
            }%`,
        },
      });

      console.log(
        `✅ [WORKER] Completed extraction for: ${fileName}`
      );
    } catch (error: any) {
      console.error(
        "❌ WORKER ERROR:",
        error
      );

      await prisma.processingJob.update({
        where: { id: jobId },

        data: {
          status: "FAILED",
          errorMessage:
            error.message ||
            "Unknown worker error",
        },
      });

      await prisma.jobLog.create({
        data: {
          jobId,

          message: `❌ FATAL ERROR: ${error.message ||
            "Unknown worker error"
            }`,
        },
      });
    }
  },

  { connection }
);

// ======================================================
// EVENTS
// ======================================================

worker.on("ready", () => {
  console.log(
    "🚀 [WORKER] Online and listening to Redis queue!"
  );
});

worker.on("failed", (job, err) => {
  console.error(
    "❌ JOB FAILED:",
    job?.id,
    err
  );
});

worker.on("error", (err) => {
  console.error(
    "❌ WORKER INTERNAL ERROR:",
    err
  );
});

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

process.on("SIGINT", async () => {
  console.log("🛑 Closing worker...");

  await worker.close();

  process.exit(0);
});