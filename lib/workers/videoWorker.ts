import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { extractFrames } from "@/lib/video/extractFrames";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import vision from "@google-cloud/vision";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectObjects } from "@/lib/vision/yolo";
import {
    IssueType,
    Severity,
    AvailabilityStatus,
    ExtractionSource,
    ExtractionStatus,
} from "@prisma/client";

import "./scheduler";

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

const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
];

const visionClientOptions: any = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    visionClientOptions.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } catch (err: any) {
    console.error("❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", err.message);
  }
}
const visionClient = new vision.ImageAnnotatorClient(visionClientOptions);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ======================================================
// NOTIFICATION SYSTEM (For Frontend Toasters)
// ======================================================
async function notifyFrontend(jobId: string, type: "info" | "success" | "error", message: string) {
    // NOTE: In production, trigger a Pusher event, Socket.io emit, or write to a Notifications DB table here.
    console.log(`[TOAST -> ${type.toUpperCase()}]: ${message}`);
    // Example: pusher.trigger(`job-${jobId}`, 'status-update', { type, message });
}

// ======================================================
// ROBUST JSON PARSER
// ======================================================
function safeJSONParse(text: string) {
    try {
        const cleaned = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        return JSON.parse(cleaned);
    } catch {
        return null; // Let the fallback engine handle it
    }
}

// ======================================================
// SMART HEURISTIC FALLBACK PARSER
// ======================================================
function heuristicExtract(ocrText: string, yoloObjects: string[]) {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
    let title = yoloObjects.length ? `Premium ${yoloObjects[0]}` : "Unknown Product";
    let brand = "Generic";
    let size = "";
    let price = 999;
    let mrp = 1299;
    
    if (lines.length > 0) {
        // Simple heuristic: Take first line as brand, and first 2-3 lines as title
        brand = lines[0].split(' ').slice(0, 2).join(' ');
        title = lines.slice(0, 2).join(' ').substring(0, 100);
    }

    // Try to find sizes using Regex (e.g., 800 ml, 500g, 1L)
    const sizeMatch = ocrText.match(/(\d+(?:\.\d+)?\s*(?:ml|l|g|kg|oz|fl\.?\s*oz|pack|pcs))/i);
    if (sizeMatch) {
        size = sizeMatch[1];
    }

    // Try to find prices using Regex (₹100, Rs. 100, 100/-)
    const priceMatch = ocrText.match(/(?:₹|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)|(\d+(?:,\d+)*(?:\.\d+)?)\s*\/-/i);
    if (priceMatch) {
        const val = priceMatch[1] || priceMatch[2];
        price = parseFloat(val.replace(/,/g, ''));
        mrp = Math.floor(price * 1.3); // Fake an MRP 30% higher
    }

    const description = lines.length > 0 
        ? `Extracted from video: ${lines.join(' ').substring(0, 250)}...`
        : (yoloObjects.length ? `Detected objects: ${yoloObjects.join(', ')}` : "No details available.");

    return {
        productTitle: title,
        brand: brand,
        description: description,
        category: yoloObjects.length ? yoloObjects[0] : "General",
        price: price,
        mrp: mrp,
        size: size,
        color: "",
        gender: "Unisex",
        material: "",
        confidenceScore: 0.35 // Lower confidence for heuristic extraction
    };
}

// ======================================================
// GEMINI FALLBACK ENGINE
// ======================================================
async function generateWithFallback(prompt: string, validFrames: string[]) {
    let lastError: any = null;

    const imageParts = validFrames.slice(0, 3).map((f) => {
        return {
            inlineData: {
                data: fs.readFileSync(f).toString("base64"),
                mimeType: "image/jpeg"
            }
        };
    });

    for (const modelName of MODELS) {
        try {
            console.log(`🧠 Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.4, // Increased slightly to allow creative inference
                },
            });

            const response = await model.generateContent([prompt, ...imageParts]);
            const text = response.response.text();
            console.log(`✅ SUCCESS with ${modelName}`);

            return { text, modelUsed: modelName };
        } catch (err: any) {
            lastError = err;
            console.log(`❌ ${modelName} failed: ${err.message}. Trying next...`);
        }
    }
    throw new Error(`All Gemini models failed. Last Error: ${lastError?.message}`);
}

// ======================================================
// MAIN WORKER
// ======================================================
const worker = new Worker(
    "video-extraction-queue",
    async (job: Job) => {
        const { jobId, productId, videoUrl, fileName } = job.data;
        let tempFilePath = "";

        try {
            await notifyFrontend(jobId, "info", `Started processing ${fileName}`);

            await prisma.processingJob.update({
                where: { id: jobId },
                data: { status: "RUNNING", progress: 10, startedAt: new Date() },
            });

            // 1. Download Video
            const tempFileName = `temp_${jobId}.mp4`;
            tempFilePath = path.join(process.cwd(), "public", "uploads", tempFileName);
            fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });

            const videoResponse = await fetch(videoUrl);
            fs.writeFileSync(tempFilePath, Buffer.from(await videoResponse.arrayBuffer()));
            await prisma.processingJob.update({ where: { id: jobId }, data: { progress: 25 } });

            // 2. Extract Frames
            const { frames } = await extractFrames(tempFileName);
            const validFrames = frames
                .map((f: string) => path.join(process.cwd(), "public", f.replace(/^.*uploads\//, "uploads/")))
                .filter((f: string) => fs.existsSync(f));

            if (validFrames.length === 0) throw new Error("No valid frames extracted");
            const relativeImageUrl = validFrames[0].replace(process.cwd() + "/public", "").replace(/\\/g, "/");
            await prisma.processingJob.update({ where: { id: jobId }, data: { progress: 45 } });

            // 3. OCR Extraction
            let allOcrText = "";
            for (const frame of validFrames) {
                try {
                    const [ocrResult] = await visionClient.textDetection(frame);
                    allOcrText += ocrResult.textAnnotations?.[0]?.description || "\n";
                } catch (ocrErr: any) {
                    console.log(`⚠️ Vision API error on frame ${frame}:`, ocrErr.message);
                }
            }
            const cleanedOcr = [...new Set(allOcrText.split("\n").map((t) => t.trim()).filter(Boolean))].join("\n");
            console.log("📝 OCR EXTRACTED:", cleanedOcr || "NONE");
            await prisma.processingJob.update({ where: { id: jobId }, data: { progress: 60 } });

            // 4. YOLO Detection
            let detectedObjects: string[] = [];
            for (const frame of validFrames.slice(0, 3)) {
                try {
                    const objects = await detectObjects(frame);
                    detectedObjects.push(...objects);
                } catch (err) {
                    console.log("YOLO failed on frame:", frame);
                }
            }
            detectedObjects = [...new Set(detectedObjects)];
            console.log("🎯 YOLO DETECTED:", detectedObjects);

            // 5. Elite AI Prompting
            const prompt = `
You are an Elite E-Commerce Cataloging Expert AI.
Your job is to generate a perfect product listing schema based on the provided text (OCR) and visual tags (YOLO).

AVAILABLE DATA:
OCR TEXT: [${cleanedOcr || "NONE"}]
YOLO DETECTED OBJECTS: [${detectedObjects.join(", ") || "NONE"}]

STRICT INFERENCE RULES:
1. IF OCR IS EMPTY BUT YOLO DETECTED SOMETHING (e.g., 'apple', 'shoes', 'chair'):
   - Do NOT output "Unknown". You MUST infer the product.
   - Example: If YOLO says 'apple', set Title to "Fresh Premium Apples", Brand to "Fresh Farm Produce", Category to "Groceries / Fresh Fruits".
   - Estimate a realistic retail Price and MRP in INR (e.g., Price: 150, MRP: 200).
   - Generate a rich, compelling description based on the object.
2. If both are empty, output a generic template but flag confidence as 0.1.
3. Only return valid JSON matching this structure exactly:
{
  "productTitle": "string",
  "brand": "string",
  "description": "string (min 2 sentences)",
  "category": "string",
  "price": number (in INR),
  "mrp": number (in INR, must be > price),
  "color": "string",
  "gender": "Unisex | Men | Women",
  "size": "string",
  "material": "string",
  "confidenceScore": number (0.0 to 1.0. High if YOLO/OCR match, low if guessing heavily),
  "seoTitle": "string",
  "keywords": ["string"]
}
`;

            let aiData: any;
            try {
                const aiResponse = await generateWithFallback(prompt, validFrames);
                aiData = safeJSONParse(aiResponse.text);
            } catch (err: any) {
                console.log(`Gemini pipeline crashed: ${err.message}. Falling back to defaults.`);
            }

            // Fallback object if LLM completely hallucinates invalid JSON or hits Rate Limit
            if (!aiData) {
                console.log("🛠️ Using Smart Heuristic Fallback with OCR data...");
                aiData = heuristicExtract(cleanedOcr, detectedObjects);
            }

            // Upload the main frame to Cloudinary if available
            let finalImageUrl = relativeImageUrl;
            if (process.env.CLOUDINARY_CLOUD_NAME && validFrames.length > 0) {
                try {
                    console.log("☁️ Uploading extracted product frame to Cloudinary...");
                    const uploadRes = await cloudinary.uploader.upload(validFrames[0], {
                        folder: "quantacus/frames",
                    });
                    finalImageUrl = uploadRes.secure_url;
                    console.log("☁️ Cloudinary upload success:", finalImageUrl);
                } catch (cloudinaryErr: any) {
                    console.error("❌ Cloudinary upload failed, falling back to local path:", cloudinaryErr.message);
                }
            }

            // 6. Save to Database
            await prisma.product.update({
                where: { id: productId },
                data: {
                    skuId: `DRAFT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    productTitle: aiData.productTitle || "Draft Product",
                    brand: aiData.brand || "Generic",
                    description: aiData.description || "",
                    category: aiData.category || "General",
                    price: Number(aiData.price) || 0,
                    mrp: Number(aiData.mrp) || 0,
                    color: aiData.color || "",
                    gender: aiData.gender || "Unisex",
                    size: aiData.size || "",
                    material: aiData.material || "",
                    availability: AvailabilityStatus.IN_STOCK,
                    confidenceScore: Number(aiData.confidenceScore) || 0.5,
                    qualityScore: Math.round((Number(aiData.confidenceScore) || 0.5) * 100),
                    imageUrl: finalImageUrl,
                    extractionSource: ExtractionSource.VIDEO_AI,
                    extractionStatus: ExtractionStatus.COMPLETED,
                    extraAttributes: {
                        seoTitle: aiData.seoTitle,
                        keywords: aiData.keywords,
                        rawOCR: cleanedOcr.slice(0, 5000),
                        yoloObjects: detectedObjects,
                    },
                },
            });

            await prisma.processingJob.update({
                where: { id: jobId },
                data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
            });

            await notifyFrontend(jobId, "success", `Successfully extracted data for ${aiData.productTitle}`);
            console.log(`✅ COMPLETED: ${fileName}`);

        } catch (error: any) {
            console.error("❌ WORKER ERROR:", error);
            await notifyFrontend(jobId, "error", `Extraction failed: ${error.message}`);

            await prisma.processingJob.update({
                where: { id: jobId },
                data: { status: "FAILED", errorMessage: error.message },
            });
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    },
    { connection }
);