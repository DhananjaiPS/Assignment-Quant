import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateProduct } from '@/lib/validator';
import { Severity, AlertType, Platform } from '@prisma/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;

    const product = await prisma.product.findUnique({
      where: { skuId },
      include: {
        issues: {
          orderBy: [{ isResolved: 'asc' }, { severity: 'desc' }],
        },
        competitorPrices: {
          include: {
            priceHistory: {
              orderBy: { changedAt: 'desc' },
              take: 10,
            },
          },
        },
        titleEnhancements: {
          orderBy: { createdAt: 'desc' },
        },
        alerts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('Get Product SKU API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;
    const body = await request.json();

    const existingProduct = await prisma.product.findUnique({
      where: { skuId },
    });

    if (!existingProduct) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    const {
      productTitle,
      description,
      brand,
      category,
      price,
      mrp,
      color,
      size,
      material,
      gender,
      imageUrl,
      competitorPricing,
    } = body;

    const priceNum = price !== undefined && price !== null ? Number(price) : null;
    const mrpNum = mrp !== undefined && mrp !== null ? Number(mrp) : null;

    // 1. Run core validation engine to compute final score and compile listing issues
    const validation = validateProduct({
      productTitle,
      description,
      brand,
      price: priceNum,
      mrp: mrpNum,
      imageUrl,
      availability: existingProduct.availability,
      color,
      size,
      material,
      gender,
    });

    // 2. Update existing Product
    const product = await prisma.product.update({
      where: { skuId },
      data: {
        productTitle,
        description,
        brand,
        category,
        price: priceNum,
        mrp: mrpNum,
        color,
        size,
        material,
        gender,
        imageUrl,
        qualityScore: validation.qualityScore,
      },
    });

    // 3. Register listing issues in DB
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

    // 4. Populate competitor prices if competitorPricing was updated/passed
    let lowestCompPrice = Infinity;
    if (competitorPricing && Array.isArray(competitorPricing)) {
      await prisma.competitorPrice.deleteMany({ where: { productId: product.id } });
      for (const comp of competitorPricing) {
        if (!comp.platform || !comp.price) continue;
        const compPrice = Number(comp.price);
        lowestCompPrice = Math.min(lowestCompPrice, compPrice);

        await prisma.competitorPrice.create({
          data: {
            productId: product.id,
            platform: comp.platform as Platform,
            competitorTitle: comp.title || `${productTitle || 'Product'} on ${comp.platform}`,
            competitorUrl: comp.url || `https://example.com/competitor-${skuId}-${comp.platform.toLowerCase()}`,
            competitorPrice: compPrice,
            lastCheckedAt: new Date(),
          },
        });
      }
    } else {
      // Find existing competitor prices to compute lowestCompPrice for alert checks
      const comps = await prisma.competitorPrice.findMany({ where: { productId: product.id } });
      comps.forEach((comp) => {
        lowestCompPrice = Math.min(lowestCompPrice, Number(comp.competitorPrice));
      });
    }

    // 5. Raise immediate Alerts
    // Listing Validation Alert (If score is very low)
    if (validation.qualityScore < 60) {
      const existingAlert = await prisma.alert.findFirst({
        where: { productId: product.id, alertType: AlertType.LISTING_VALIDATION_ERROR, isActive: true },
      });
      if (!existingAlert) {
        await prisma.alert.create({
          data: {
            productId: product.id,
            alertType: AlertType.LISTING_VALIDATION_ERROR,
            severity: Severity.HIGH,
            title: 'Weak Product Listing Updated',
            message: `Product with SKU "${skuId}" has a critical listing quality score of only ${validation.qualityScore}%. Please review validation issues.`,
            contextData: { qualityScore: validation.qualityScore, issuesCount: validation.issues.length },
          },
        });
      }
    } else {
      // Deactivate active validation alerts if quality is now fine
      await prisma.alert.updateMany({
        where: { productId: product.id, alertType: AlertType.LISTING_VALIDATION_ERROR },
        data: { isActive: false, isDismissed: true },
      });
    }

    // Price Gap Alert
    if (priceNum && lowestCompPrice !== Infinity && priceNum > 0) {
      const gapPercent = ((priceNum - lowestCompPrice) / lowestCompPrice) * 100;
      if (gapPercent > 10) {
        const existingAlert = await prisma.alert.findFirst({
          where: { productId: product.id, alertType: AlertType.PRICE_GAP_EXCEEDED, isActive: true },
        });
        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              productId: product.id,
              alertType: AlertType.PRICE_GAP_EXCEEDED,
              severity: Severity.HIGH,
              title: 'Immediate Price Correction Recommended',
              message: `SKU "${skuId}" on Flipkart is priced ${Math.round(
                gapPercent
              )}% higher than the lowest competitor listing (INR ${lowestCompPrice}).`,
              contextData: { ourPrice: priceNum, lowestCompetitor: lowestCompPrice, gapPercent },
            },
          });
        }
      } else {
        // Deactivate price gap alerts if price is now competitive
        await prisma.alert.updateMany({
          where: { productId: product.id, alertType: AlertType.PRICE_GAP_EXCEEDED },
          data: { isActive: false, isDismissed: true },
        });
      }
    }

    // Fetch the updated product with all relations to return in response
    const updatedProduct = await prisma.product.findUnique({
      where: { skuId },
      include: {
        issues: {
          orderBy: [{ isResolved: 'asc' }, { severity: 'desc' }],
        },
        competitorPrices: {
          include: {
            priceHistory: {
              orderBy: { changedAt: 'desc' },
              take: 10,
            },
          },
        },
        titleEnhancements: {
          orderBy: { createdAt: 'desc' },
        },
        alerts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Product updated successfully!',
      product: updatedProduct,
    });
  } catch (error: any) {
    console.error('Update Product SKU API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;

    const existingProduct = await prisma.product.findUnique({
      where: { skuId },
    });

    if (!existingProduct) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    await prisma.product.delete({
      where: { skuId },
    });

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully!',
    });
  } catch (error: any) {
    console.error('Delete Product SKU API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}
