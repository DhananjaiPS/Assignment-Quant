import fs from "fs";

export interface GeminiExtractionResult {
  skuId?: string;
  productTitle: string;
  brand: string;
  category: string;
  description: string;
  color: string;
  material: string;
  gender: string;
  priceEstimate: number;
  mrpEstimate: number;
  size: string;
  imageUrl: string;
  confidence: number;
  competitors: any[];
  extraAttributes: Record<string, any>;
  logMessages: string[];
  suggestedKeywords?: string[];
}

const SAFE_FALLBACK: GeminiExtractionResult = {
  productTitle: "Unknown Product",
  brand: "Unknown",
  category: "General",
  description: "Unable to confidently extract product details from video frames.",
  color: "Unknown",
  material: "Unknown",
  gender: "Unisex",
  priceEstimate: 0,
  mrpEstimate: 0,
  size: "Unknown",
  imageUrl: "",
  confidence: 0,
  competitors: [],
  extraAttributes: {},
  logMessages: ["SAFE MODE ACTIVATED: No hallucinated data returned"],
  suggestedKeywords: [],
};

export async function extractProductDetails(
  frames: string[],
  videoFileName: string,
  enhanceTitle: boolean = false
): Promise<GeminiExtractionResult> {
  const logMessages: string[] = [];

  logMessages.push(`[SYSTEM] Starting multimodal extraction pipeline...`);
  logMessages.push(`[SYSTEM] Frames received: ${frames.length}`);

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const prompt = `
You are an enterprise e-commerce product extraction engine.

STRICT RULES:
1. DO NOT GUESS ANY ATTRIBUTE.
2. If unclear → return null.
3. If product cannot be identified → return LOW confidence.
4. NEVER hallucinate brand or category.
5. Output ONLY valid JSON.

Extract:
- brand
- productTitle
- category (Electronics, Apparel, Footwear, Home & Kitchen, General)
- description
- color
- material
- gender
- size
- priceEstimate
- mrpEstimate
- confidence

${enhanceTitle ? "Generate SEO optimized productTitle and suggestedKeywords (3-5 keywords)" : ""}

Video: ${videoFileName}
`;

  const parts: any[] = [{ text: prompt }];

  for (const frame of frames) {
    if (!fs.existsSync(frame)) {
      logMessages.push(`[WARN] Missing frame skipped: ${frame}`);
      continue;
    }

    const base64 = fs.readFileSync(frame).toString("base64");

    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64,
      },
    });
  }

  try {
    logMessages.push(`[SYSTEM] Calling Gemini API...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || "Gemini API failed");
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const parsed = JSON.parse(text);

    // Validate structure
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON structure from Gemini");
    }

    logMessages.push(
      `[SYSTEM] Gemini extraction successful. Confidence: ${parsed.confidence || 0}`
    );

    // Confidence gating (IMPORTANT)
    if (!parsed.confidence || parsed.confidence < 60) {
      logMessages.push(`[WARNING] Low confidence detection → forcing safe mode`);
      return {
        ...SAFE_FALLBACK,
        logMessages,
      };
    }

    return {
      productTitle: parsed.productTitle || "Unknown Product",
      brand: parsed.brand || "Unknown",
      category: parsed.category || "General",
      description:
        parsed.description || "No description available from extraction.",
      color: parsed.color || "Unknown",
      material: parsed.material || "Unknown",
      gender: parsed.gender || "Unisex",
      size: parsed.size || "Unknown",
      priceEstimate: Number(parsed.priceEstimate || 0),
      mrpEstimate: Number(parsed.mrpEstimate || 0),
      imageUrl: parsed.imageUrl || "",
      confidence: Number(parsed.confidence || 0),
      competitors: [],
      extraAttributes: {
        suggestedKeywords: parsed.suggestedKeywords || [],
      },
      suggestedKeywords: parsed.suggestedKeywords || [],
      logMessages,
    };
  } catch (error: any) {
    logMessages.push(`[ERROR] Gemini failed: ${error.message}`);
    logMessages.push(`[SYSTEM] Switching to SAFE FALLBACK mode`);

    return {
      ...SAFE_FALLBACK,
      logMessages,
    };
  }
}