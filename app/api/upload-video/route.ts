import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { videoExtractionQueue } from "@/lib/queue";
import crypto from "crypto";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isPreset, presetName, cloudUrl, filename, fileSize } = body;

    let finalCloudUrl = cloudUrl;
    let originalFileName = filename || "uploaded_video.mp4";
    
    if (isPreset && presetName) {
      originalFileName = `${presetName}.mp4`;
      finalCloudUrl = "https://res.cloudinary.com/demo/video/upload/dog.mp4";
    }

    if (!finalCloudUrl) {
       return NextResponse.json({ error: "Missing video URL" }, { status: 400 });
    }

    // Determine unique fingerprinted key based on URL instead of hash
    const uniqueKey = presetName 
      ? `preset_${presetName}` 
      : crypto.createHash("md5").update(finalCloudUrl).digest("hex");

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

    // 3. Database Entry
    const job = await prisma.processingJob.create({
      data: {
        jobType: "VIDEO_EXTRACTION",
        status: "PENDING",
        progress: 0,
        uniqueKey,
        metadata: { 
          originalFileName, 
          cloudUrl: finalCloudUrl,
          fileSize: fileSize || 0,
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
    await videoExtractionQueue.add("extract-video", {
      jobId: job.id,
      productId: product.id,
      videoUrl: finalCloudUrl,
      fileName: originalFileName,
    });

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}