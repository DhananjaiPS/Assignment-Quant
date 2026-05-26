import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;
    const product = await prisma.product.findUnique({
      where: { skuId }
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      }
    });

    const prompt = `
You are an Elite E-Commerce SEO Cataloging Expert.
Your job is to generate a highly optimized, click-driven, search-engine-friendly product title and select target SEO keywords.

ORIGINAL PRODUCT DATA:
- Original Title: ${product.productTitle || 'N/A'}
- Description: ${product.description || 'N/A'}
- Category: ${product.category || 'General'}
- Brand: ${product.brand || 'N/A'}
- Color: ${product.color || 'N/A'}
- Material: ${product.material || 'N/A'}
- Gender: ${product.gender || 'N/A'}
- Size: ${product.size || 'N/A'}

STRICT ENHANCEMENT RULES:
1. The new title must be clean, readable, professional, and follow the standard format: Brand + Gender (if applicable) + Material/Key Feature + Product Category/Type.
2. Max 75 characters for the title.
3. Incorporate high-volume e-commerce search keywords.
4. Extract 3-5 target search keywords that match user intent.
5. Provide a short, persuasive 1-sentence reasoning (reason) why this title will perform better (e.g. improve click-through-rate, search indexing).

Return ONLY a valid JSON object matching this structure:
{
  "suggestedTitle": "Highly Optimized Title (Max 75 characters)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "reason": "Clear 1-sentence SEO rationale for this enhancement."
}
`;

    const response = await model.generateContent(prompt);
    const rawText = response.response.text();
    
    let aiData = { suggestedTitle: '', keywords: [] as string[], reason: '' };
    try {
      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      aiData = JSON.parse(cleaned);
    } catch (e) {
      aiData = {
        suggestedTitle: rawText.trim().replace(/['"]/g, '').substring(0, 75),
        keywords: [product.brand, product.category, product.color].filter(Boolean) as string[],
        reason: 'Enhanced listing title for improved search indexability.'
      };
    }

    const suggestedTitle = aiData.suggestedTitle || product.productTitle || 'Enhanced Product';

    // Create a TitleEnhancement record with parsed parameters
    await prisma.titleEnhancement.create({
      data: {
        productId: product.id,
        originalTitle: product.productTitle || '',
        enhancedTitle: suggestedTitle,
        extractedAttributes: {
          category: product.category,
          brand: product.brand,
          color: product.color,
          material: product.material,
          gender: product.gender,
          size: product.size
        },
        keywords: aiData.keywords || [],
        reason: aiData.reason || 'Enhanced SEO-friendly e-commerce structure.'
      }
    });

    return NextResponse.json({ success: true, suggestedTitle });

  } catch (error: any) {
    console.error('Error enhancing title:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;
    const body = await request.json();
    const { enhancementId, apply } = body;

    if (!enhancementId) {
      return NextResponse.json({ success: false, error: 'Enhancement ID is required.' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { skuId },
      include: {
        titleEnhancements: {
          where: { id: enhancementId }
        }
      }
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    const enhancement = product.titleEnhancements[0];
    if (!enhancement) {
      return NextResponse.json({ success: false, error: 'Title enhancement record not found for this product.' }, { status: 404 });
    }

    if (apply) {
      await prisma.product.update({
        where: { skuId },
        data: {
          productTitle: enhancement.enhancedTitle,
        }
      });
      await prisma.titleEnhancement.update({
        where: { id: enhancementId },
        data: {
          isApplied: true
        }
      });
    } else {
      await prisma.product.update({
        where: { skuId },
        data: {
          productTitle: enhancement.originalTitle,
        }
      });
      await prisma.titleEnhancement.update({
        where: { id: enhancementId },
        data: {
          isApplied: false
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: apply ? 'Title successfully updated with AI suggestion.' : 'Title successfully reverted to original.'
    });

  } catch (error: any) {
    console.error('Error applying title enhancement:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

