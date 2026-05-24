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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an elite E-commerce SEO Expert.
      Based on the following product data, generate EXACTLY ONE highly optimized, click-driven product title.
      Rules:
      - Include Brand, Material, Key Feature, and Category if present.
      - Max 75 characters.
      - Do NOT output quotes or extra text, just the title.

      Category: ${product.category || 'General'}
      Description: ${product.description || 'N/A'}
      Brand: ${product.brand || 'N/A'}
      Color: ${product.color || 'N/A'}
    `;

    const response = await model.generateContent(prompt);
    const suggestedTitle = response.response.text().trim().replace(/['"]/g, '');

    // Optionally create a TitleEnhancement record
    await prisma.titleEnhancement.create({
      data: {
        productId: product.id,
        originalTitle: product.productTitle || '',
        enhancedTitle: suggestedTitle,
        extractedAttributes: {
          category: product.category,
          brand: product.brand,
          color: product.color
        },
        keywords: []
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

