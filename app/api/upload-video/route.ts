import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Queue } from "bullmq";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary Configure kiya
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const videoQueue = new Queue("video-extraction-queue", {
  connection: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const isPreset = formData.get("isPreset") === "true";
    const presetName = formData.get("presetName") as string | null;

    let cloudVideoUrl = "";
    let originalFileName = "";
    let buffer: Buffer | null = null;
    let fileSize = 0;
    let fileHash: string | null = null;

    if (isPreset && presetName) {
      originalFileName = `${presetName}.mp4`;
      // Use a sample video URL for demo presets
      cloudVideoUrl = "https://res.cloudinary.com/demo/video/upload/dog.mp4";
    } else {
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file found" }, { status: 400 });

      originalFileName = file.name;
      fileSize = file.size;

      // File to Buffer conversion
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      fileHash = crypto.createHash("md5").update(buffer).digest("hex");
    }

    // Determine unique fingerprinted key
    const uniqueKey = presetName 
      ? `preset_${presetName}` 
      : `${fileHash}_${fileSize}`;

    // Hard Stop Duplicate uploads: check if this job already exists in DB
    const existingJob = await prisma.processingJob.findUnique({
      where: { uniqueKey },
      include: {
        products: true,
      },
    });

    if (existingJob && existingJob.products.length > 0) {
      return NextResponse.json({ 
        success: true, 
        jobId: existingJob.id,
        alreadyExisted: true,
        message: 'This video has already been processed. Redirecting to the existing draft.'
      });
    }

    // Upload to Cloudinary only if it's a new upload (not preset, not duplicate)
    if (!isPreset && buffer) {
      const uploadResult: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "video", folder: "quantaculas" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      cloudVideoUrl = uploadResult.secure_url;
    }

    // 3. Database Entry
    const job = await prisma.processingJob.create({
      data: {
        jobType: "VIDEO_EXTRACTION",
        status: "PENDING",
        progress: 0,
        uniqueKey,
        metadata: { 
          originalFileName, 
          cloudUrl: cloudVideoUrl,
          fileHash,
          fileSize,
          presetName: presetName || null
        },
      },
    });

    const product = await prisma.product.create({
      data: {
        skuId: `DRAFT-${Math.random().toString(36).substring(7).toUpperCase()}`,
        productTitle: originalFileName,
        processingJobId: job.id,
        extractionSource: "VIDEO_AI",
        extractionStatus: "PENDING",
      },
    });

    // 4. Worker ko File ka naam nahi, Cloudinary URL bheja!
    await videoQueue.add("extract-video", {
      jobId: job.id,
      productId: product.id,
      videoUrl: cloudVideoUrl,
      fileName: originalFileName,
    });

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}