import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateProduct } from '@/lib/validator';
import { Severity, AlertType, Platform, ExtractionSource, ExtractionStatus, AvailabilityStatus } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productId,
      skuId,
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
      extraAttributes,
      competitors,
      confidenceScore,
    } = body;

    if (!productId || !skuId) {
      return NextResponse.json({ success: false, error: 'Product ID and business SKU ID are required.' }, { status: 400 });
    }

    const priceNum = price ? Number(price) : null;
    const mrpNum = mrp ? Number(mrp) : null;

    let finalConfidence = confidenceScore !== undefined && confidenceScore !== null ? Number(confidenceScore) : null;
    
    // Fetch existing product to get jobId for logs
    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
    if (!existingProduct) {
      return NextResponse.json({ success: false, error: 'Draft product not found.' }, { status: 404 });
    }
    const jobId = existingProduct.processingJobId;

    // 1. Run core validation engine to compute final score and compile listing issues
    const validation = validateProduct({
      productTitle,
      description,
      brand,
      price: priceNum,
      mrp: mrpNum,
      imageUrl,
      availability: 'IN_STOCK',
      color,
      size,
      material,
      gender,
    });

    // Check if another product already exists with this SKU
    const existingSkuProduct = await prisma.product.findFirst({
      where: {
        skuId,
        id: { not: productId },
      },
    });

    if (existingSkuProduct) {
      // Update details of the existing product
      await prisma.product.update({
        where: { id: existingSkuProduct.id },
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
          imageUrl: imageUrl || existingSkuProduct.imageUrl,
          extraAttributes: extraAttributes || {},
          qualityScore: validation.qualityScore,
          confidenceScore: finalConfidence,
          extractionStatus: ExtractionStatus.COMPLETED,
        },
      });

      // Clear existing issues for this product and create new ones
      await prisma.productIssue.deleteMany({ where: { productId: existingSkuProduct.id } });
      if (validation.issues.length > 0) {
        await prisma.productIssue.createMany({
          data: validation.issues.map((iss) => ({
            productId: existingSkuProduct.id,
            issueType: iss.issueType,
            severity: iss.severity,
            title: iss.title,
            description: iss.description,
            suggestedFix: iss.suggestedFix,
          })),
        });
      }

      // Clear and re-populate competitor prices
      await prisma.competitorPrice.deleteMany({ where: { productId: existingSkuProduct.id } });
      let lowestCompPrice = Infinity;
      if (competitors && Array.isArray(competitors)) {
        for (const comp of competitors) {
          const compPrice = comp.price ? Number(comp.price) : 0;
          lowestCompPrice = Math.min(lowestCompPrice, compPrice);

          await prisma.competitorPrice.create({
            data: {
              productId: existingSkuProduct.id,
              platform: comp.platform as Platform,
              competitorTitle: comp.title || `${productTitle} on ${comp.platform}`,
              competitorUrl: comp.url || `https://example.com/competitor-${skuId}-${comp.platform.toLowerCase()}`,
              competitorPrice: compPrice,
              lastCheckedAt: new Date(),
            },
          });
        }
      }

      // Raise alerts if needed (listing validation and price gap)
      if (validation.qualityScore < 60) {
        await prisma.alert.create({
          data: {
            productId: existingSkuProduct.id,
            alertType: AlertType.LISTING_VALIDATION_ERROR,
            severity: Severity.HIGH,
            title: 'Weak Product Listing Published',
            message: `Product published as SKU "${skuId}" has a critical listing quality score of only ${validation.qualityScore}%. Please review validation issues immediately.`,
            contextData: { qualityScore: validation.qualityScore, issuesCount: validation.issues.length },
          },
        });
      }

      if (priceNum && lowestCompPrice !== Infinity && priceNum > 0) {
        const gapPercent = ((priceNum - lowestCompPrice) / lowestCompPrice) * 100;
        if (gapPercent > 10) {
          await prisma.alert.create({
            data: {
              productId: existingSkuProduct.id,
              alertType: AlertType.PRICE_GAP_EXCEEDED,
              severity: Severity.HIGH,
              title: 'Immediate Price Correction Recommended',
              message: `SKU "${skuId}" published on Flipkart is priced ${Math.round(
                gapPercent
              )}% higher than the lowest competitor listing (INR ${lowestCompPrice}).`,
              contextData: { ourPrice: priceNum, lowestCompetitor: lowestCompPrice, gapPercent },
            },
          });
        }
      }

      // Delete the draft product to prevent duplicate SKU error
      await prisma.product.delete({ where: { id: productId } });

      // Write final job log
      if (jobId) {
        await prisma.jobLog.create({
          data: {
            jobId,
            message: `Product SKU ${skuId} already existed. Updated existing product details and deleted draft.`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        alreadyExisted: true,
        message: 'Draft published: Updated details for existing SKU in database.',
        skuId,
      });
    }

    // 2. Update existing DRAFT Product
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        skuId,
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
        extraAttributes: extraAttributes || {},
        qualityScore: validation.qualityScore,
        confidenceScore: finalConfidence,
        extractionSource: ExtractionSource.VIDEO_AI,
        extractionStatus: ExtractionStatus.COMPLETED,
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

    // 4. Populate competitor prices
    await prisma.competitorPrice.deleteMany({ where: { productId: product.id } });
    let lowestCompPrice = Infinity;
    if (competitors && Array.isArray(competitors)) {
      for (const comp of competitors) {
        const compPrice = comp.price ? Number(comp.price) : 0;
        lowestCompPrice = Math.min(lowestCompPrice, compPrice);

        await prisma.competitorPrice.create({
          data: {
            productId: product.id,
            platform: comp.platform as Platform,
            competitorTitle: comp.title || `${productTitle} on ${comp.platform}`,
            competitorUrl: comp.url || `https://example.com/competitor-${skuId}-${comp.platform.toLowerCase()}`,
            competitorPrice: compPrice,
            lastCheckedAt: new Date(),
          },
        });
      }
    }

    // 5. Raise immediate Alerts
    // Listing Validation Alert (If score is very low)
    if (validation.qualityScore < 60) {
      await prisma.alert.create({
        data: {
          productId: product.id,
          alertType: AlertType.LISTING_VALIDATION_ERROR,
          severity: Severity.HIGH,
          title: 'Weak Product Listing Published',
          message: `Product published as SKU "${skuId}" has a critical listing quality score of only ${validation.qualityScore}%. Please review validation issues immediately.`,
          contextData: { qualityScore: validation.qualityScore, issuesCount: validation.issues.length },
        },
      });
    }

    // Price Gap Alert
    if (priceNum && lowestCompPrice !== Infinity && priceNum > 0) {
      const gapPercent = ((priceNum - lowestCompPrice) / lowestCompPrice) * 100;
      if (gapPercent > 10) {
        await prisma.alert.create({
          data: {
            productId: product.id,
            alertType: AlertType.PRICE_GAP_EXCEEDED,
            severity: Severity.HIGH,
            title: 'Immediate Price Correction Recommended',
            message: `SKU "${skuId}" published on Flipkart is priced ${Math.round(
              gapPercent
            )}% higher than the lowest competitor listing (INR ${lowestCompPrice}).`,
            contextData: { ourPrice: priceNum, lowestCompetitor: lowestCompPrice, gapPercent },
          },
        });
      }
    }

    // 6. Write final job log
    if (jobId) {
      await prisma.jobLog.create({
        data: {
          jobId,
          message: `Successfully published draft video extraction as active listing with SKU: ${skuId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Draft published as live listing successfully!',
      skuId,
    });
  } catch (error: any) {
    console.error('Publish Draft API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}
