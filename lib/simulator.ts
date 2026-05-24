import { prisma } from "./prisma";
import { validateProduct } from "./validator";

import {
  Severity,
  AlertType,
} from "@prisma/client";

import { extractFrames } from "./video/extractFrames";
import { extractProductDetails } from "./ai/extractProduct";
import { processVisionOcr } from "./ocr/googleVision";

import fs from "fs";
import path from "path";

// ======================================================
// MAIN VIDEO PROCESSING PIPELINE
// ======================================================

export async function runVideoJobSimulation(
  jobId: string,
  productId: string,
  fileName: string,
  enhanceTitle: boolean = false
) {
  try {
    console.log("\n🚀 STARTING VIDEO PIPELINE");
    console.log("FILE:", fileName);

    // ======================================================
    // 1. JOB START
    // ======================================================

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        progress: 10,
        startedAt: new Date(),
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId,
        message:
          "Job active: Queued for dynamic frame-driven AI extraction...",
      },
    });

    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    if (!hasGeminiKey) {
      await prisma.jobLog.create({
        data: {
          jobId,
          message:
            "[System Warning] GEMINI_API_KEY missing.",
        },
      });

      throw new Error("Missing GEMINI_API_KEY");
    }

    await prisma.jobLog.create({
      data: {
        jobId,
        message:
          "[System] Gemini Multimodal pipeline initialized.",
      },
    });

    // ======================================================
    // 2. FRAME EXTRACTION
    // ======================================================

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        progress: 25,
      },
    });

    const frameResult = await extractFrames(fileName);

    for (const msg of frameResult.logMessages) {
      await prisma.jobLog.create({
        data: { jobId, message: msg },
      });
    }

    console.log("FRAME URLS:", frameResult.frames);

    if (!frameResult.frames.length) {
      throw new Error("No frames extracted.");
    }

    // ======================================================
    // 3. CONVERT URL PATHS -> ABSOLUTE FILE PATHS
    // ======================================================

    const absoluteFramePaths = frameResult.frames.map(
      (frame) =>
        path.join(process.cwd(), "public", frame)
    );

    console.log(
      "ABSOLUTE FRAME PATHS:",
      absoluteFramePaths
    );

    // ======================================================
    // 4. VALIDATE FRAME FILES
    // ======================================================

    const validFrames: string[] = [];

    for (const frame of absoluteFramePaths) {
      const exists = fs.existsSync(frame);

      console.log("FRAME EXISTS:", frame, exists);

      if (exists) {
        validFrames.push(frame);
      }
    }

    if (!validFrames.length) {
      throw new Error(
        "No valid extracted frame files found."
      );
    }

    await prisma.jobLog.create({
      data: {
        jobId,
        message: `[FFmpeg] Successfully extracted ${validFrames.length} frames.`,
      },
    });

    // ======================================================
    // 5. OCR PROCESSING
    // ======================================================

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        progress: 50,
      },
    });

    console.log("🚀 STARTING OCR");

    const ocrResult = await processVisionOcr(
      validFrames
    );

    console.log("OCR RESULT:", ocrResult);

    for (const msg of ocrResult.logMessages) {
      await prisma.jobLog.create({
        data: { jobId, message: msg },
      });
    }

    // ======================================================
    // 6. GEMINI AI EXTRACTION
    // ======================================================

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        progress: 75,
      },
    });

    console.log("🚀 STARTING GEMINI EXTRACTION");

    const aiResult = await extractProductDetails(
      validFrames,
      fileName,
      enhanceTitle
    );

    console.log("AI RESULT:", aiResult);

    for (const msg of aiResult.logMessages) {
      await prisma.jobLog.create({
        data: { jobId, message: msg },
      });
    }

    // ======================================================
    // 7. UPDATE PRODUCT
    // ======================================================

    await prisma.jobLog.create({
      data: {
        jobId,
        message:
          "[Database] Updating Product entity with extracted attributes...",
      },
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        brand:
          aiResult.brand || "Unknown",

        productTitle:
          aiResult.productTitle ||
          "Unknown Product",

        category:
          aiResult.category || "General",

        description:
          aiResult.description ||
          "Unable to confidently extract product details.",

        color:
          aiResult.color || "Unknown",

        material:
          aiResult.material || "Unknown",

        gender:
          aiResult.gender || "Unisex",

        size:
          aiResult.size || "Unknown",

        price:
          aiResult.priceEstimate || 0,

        mrp:
          aiResult.mrpEstimate || 0,

        // IMPORTANT FIX
        imageUrl:
          frameResult.frames[0] || null,

        confidenceScore:
          aiResult.confidence || 0,

        extraAttributes:
          aiResult.extraAttributes || {},

        extractionStatus: "COMPLETED",
      },
    });

    // ======================================================
    // 8. VALIDATION ENGINE
    // ======================================================

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        progress: 90,
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId,
        message:
          "[Validator] Launching listing quality audit...",
      },
    });

    const validation = validateProduct({
      productTitle: aiResult.productTitle,
      brand: aiResult.brand,
      description: aiResult.description,
      color: aiResult.color,
      material: aiResult.material,
      gender: aiResult.gender,
      price: aiResult.priceEstimate,
      mrp: aiResult.mrpEstimate,
      imageUrl: frameResult.frames[0],
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        qualityScore: validation.qualityScore,
      },
    });

    // ======================================================
    // 9. PRODUCT ISSUES
    // ======================================================

    for (const issue of validation.issues) {
      await prisma.productIssue.create({
        data: {
          productId,
          issueType: issue.issueType,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          suggestedFix: issue.suggestedFix,
        },
      });

      if (issue.severity === "HIGH") {
        await prisma.alert.create({
          data: {
            productId,

            alertType:
              AlertType.LISTING_VALIDATION_ERROR,

            severity: Severity.HIGH,

            title: `Critical Listing Issue: ${issue.title}`,

            message: issue.description,
          },
        });
      }
    }

    // ======================================================
    // 10. COMPLETE JOB
    // ======================================================

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date(),
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId,
        message: `✅ Extraction COMPLETED successfully. Confidence Score: ${aiResult.confidence}%`,
      },
    });

    console.log("✅ PIPELINE COMPLETED");
  } catch (error: any) {
    console.error("❌ PIPELINE FAILED");
    console.error(error);

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        progress: 0,
        errorMessage:
          error.message ||
          "Unknown extraction error",
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId,
        message: `❌ FATAL ERROR: ${error.message}`,
      },
    });
  }
}