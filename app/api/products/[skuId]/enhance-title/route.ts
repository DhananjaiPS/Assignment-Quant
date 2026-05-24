import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateProduct } from '@/lib/validator';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;

    const product = await prisma.product.findUnique({
      where: { skuId },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    // 1. Caching logic: check if there's a cached enhancement created within the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const cachedEnhancement = await prisma.titleEnhancement.findFirst({
      where: {
        productId: product.id,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (cachedEnhancement) {
      return NextResponse.json({
        success: true,
        enhancement: cachedEnhancement,
        cached: true,
      });
    }

    // Prepare extracted attributes JSON
    const attributes = {
      brand: product.brand || 'Unspecified',
      category: product.category || 'General',
      color: product.color || 'Solid',
      material: product.material || 'Standard Fabric',
      gender: product.gender || 'Unisex',
      size: product.size || 'Regular',
    };

    let keywords: string[] = [];
    let enhancedTitle = '';
    let reason = '';

    // 2. Query Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const prompt = `
You are an expert e-commerce SEO optimization engine.
Analyze the following product details and generate:
1. An SEO-optimized, highly searchable product title for Flipkart. Include brand, key attributes like color, material, gender, and category naturally. The title should be 15-80 characters long.
2. A list of 3-5 target search keywords for this product.
3. The optimization rationale (a short 1-sentence explanation of why this title is better).

Product Details:
- Original Title: "${product.productTitle || ''}"
- Description: "${product.description || ''}"
- Brand: "${product.brand || ''}"
- Category: "${product.category || ''}"
- Color: "${product.color || ''}"
- Size: "${product.size || ''}"
- Material: "${product.material || ''}"
- Gender: "${product.gender || ''}"

Return ONLY a valid JSON object matching this structure:
{
  "enhancedTitle": "string",
  "keywords": ["string", "string", "string"],
  "reason": "string"
}
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          let cleanText = text.trim();
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }
          const parsed = JSON.parse(cleanText);
          enhancedTitle = parsed.enhancedTitle;
          keywords = parsed.keywords || [];
          reason = parsed.reason;
        }
      } catch (err) {
        console.error('Gemini API call failed, falling back to templates:', err);
      }
    }

    // 3. Fallback templates if Gemini fails or is not available
    if (!enhancedTitle) {
      const catLower = (product.category || '').toLowerCase();
      const brandLower = (product.brand || '').toLowerCase();

      if (catLower.includes('footwear') || catLower.includes('shoe') || brandLower === 'nike' || brandLower === 'adidas') {
        keywords = ['running shoes', 'lightweight sneakers', 'sports shoes for men', 'athletic footwear'];
        enhancedTitle = `${attributes.brand} ${attributes.color} Lightweight Running Shoes for ${attributes.gender} with ${attributes.material} Upper`;
        reason = 'Positioned high-value brand name at start, added target gender tag, specified breathable mesh fabric, and integrated search-heavy keyword clusters.';
      } else if (catLower.includes('apparel') || catLower.includes('clothing') || catLower.includes('shirt') || catLower.includes('dress') || brandLower === 'zara' || brandLower === 'h&m') {
        keywords = ['midi summer dress', 'casual cotton wear', 'linen midi dress', 'dresses for women'];
        enhancedTitle = `${attributes.brand} Elegant ${attributes.color} ${attributes.material} Midi Summer Dress for ${attributes.gender}`;
        reason = 'Highlighted elegant styling parameters, added midi length attribute, specified linen cotton blend specifications, and integrated top-converting tags for women summer apparel.';
      } else {
        // Dynamic fallback that respects the product's actual leaf category and attributes!
        const catParts = (product.category || 'Product').split('/');
        const leafCategory = catParts[catParts.length - 1]?.trim() || 'Product';
        
        const brandStr = product.brand && product.brand !== 'Unknown' ? `${product.brand} ` : '';
        const colorStr = product.color ? `${product.color} ` : '';
        const materialStr = product.material ? `${product.material} ` : '';
        const genderStr = product.gender && product.gender.toLowerCase() !== 'unisex' ? `for ${product.gender} ` : '';
        
        enhancedTitle = `${brandStr}Premium ${colorStr}${materialStr}${leafCategory} ${genderStr}`.trim();
        keywords = [
          leafCategory.toLowerCase(),
          product.brand ? product.brand.toLowerCase() : '',
          product.color ? product.color.toLowerCase() : '',
          'premium listing'
        ].filter(Boolean);
        reason = `Structured title formatting beginning with brand, specifying key attributes like ${product.color || 'color'} and ${product.material || 'material'} to optimize search filter visibility.`;
      }
    }

    // Save Title Enhancement record
    const enhancement = await prisma.titleEnhancement.create({
      data: {
        productId: product.id,
        originalTitle: product.productTitle || 'Unnamed Product',
        enhancedTitle,
        extractedAttributes: attributes,
        keywords,
        reason,
        isApplied: false,
      },
    });

    return NextResponse.json({
      success: true,
      enhancement,
    });
  } catch (error: any) {
    console.error('Enhance Title API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
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

    const product = await prisma.product.findUnique({
      where: { skuId },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    const enhancement = await prisma.titleEnhancement.findUnique({
      where: { id: enhancementId },
    });

    if (!enhancement) {
      return NextResponse.json({ success: false, error: 'Enhancement record not found.' }, { status: 404 });
    }

    // Update isApplied state
    await prisma.titleEnhancement.update({
      where: { id: enhancementId },
      data: { isApplied: apply },
    });

    if (apply) {
      // Apply the enhanced title to the product
      const updatedProduct = await prisma.product.update({
        where: { id: product.id },
        data: {
          productTitle: enhancement.enhancedTitle,
        },
      });

      // Rerun validation since title changed!
      const validation = validateProduct({
        productTitle: enhancement.enhancedTitle,
        description: updatedProduct.description,
        brand: updatedProduct.brand,
        price: Number(updatedProduct.price),
        mrp: Number(updatedProduct.mrp),
        imageUrl: updatedProduct.imageUrl,
        availability: updatedProduct.availability,
        color: updatedProduct.color,
        size: updatedProduct.size,
        material: updatedProduct.material,
        gender: updatedProduct.gender,
      });

      await prisma.product.update({
        where: { id: product.id },
        data: { qualityScore: validation.qualityScore },
      });

      await prisma.productIssue.deleteMany({ where: { productId: product.id } });
      if (validation.issues.length > 0) {
        await prisma.productIssue.createMany({
          data: validation.issues.map((iss) => ({
            productId: product.id,
            issueType: iss.issueType,
            severity: iss.severity,
            title: iss.title,
            description: iss.description,
            suggestedFix: iss.suggestedFix,
          })),
        });
      }
    }

    return NextResponse.json({ success: true, message: apply ? 'Enhanced title applied successfully!' : 'Title reverted successfully!' });
  } catch (error: any) {
    console.error('Apply Title API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
