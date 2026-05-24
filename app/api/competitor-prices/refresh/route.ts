import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Severity, AlertType } from '@prisma/client';

export async function POST() {
  try {
    // Find all competitor prices in the database
    const competitorPrices = await prisma.competitorPrice.findMany({
      include: {
        product: true
      }
    });

    let refreshedCount = 0;
    let alertsCreatedCount = 0;

    for (const comp of competitorPrices) {
      const oldPrice = Number(comp.competitorPrice);
      // Fluctuate between -20% and +10%
      const fluctuation = (Math.random() * 0.3) - 0.2;
      const newPrice = Math.max(1, Math.round(oldPrice * (1 + fluctuation)));

      if (oldPrice === newPrice) continue;

      // Update the competitor price
      await prisma.competitorPrice.update({
        where: { id: comp.id },
        data: {
          competitorPrice: newPrice,
          lastCheckedAt: new Date()
        }
      });

      // Record history
      await prisma.competitorPriceHistory.create({
        data: {
          competitorPriceId: comp.id,
          oldPrice,
          newPrice,
          changedAt: new Date()
        }
      });

      refreshedCount++;

      // 1. Check for competitor price drop alert (>= 15% drop)
      const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;
      if (dropPercent >= 15) {
        await prisma.alert.create({
          data: {
            productId: comp.productId,
            alertType: AlertType.COMPETITOR_PRICE_DROP,
            severity: Severity.MEDIUM,
            title: 'Competitor Price Cut Detected',
            message: `Competitor on ${comp.platform} slashed price for SKU "${comp.product.skuId}" by ${Math.round(dropPercent)}% (INR ${oldPrice} -> INR ${newPrice}).`,
            contextData: { oldPrice, newPrice, platform: comp.platform },
          }
        });
        alertsCreatedCount++;
      }

      // 2. Check for Flipkart Price Gap Alert (> 10% premium over lowest competitor)
      if (comp.product.price) {
        const ourPrice = Number(comp.product.price);
        
        // Find lowest competitor price for this product
        const allCompsForProduct = await prisma.competitorPrice.findMany({
          where: { productId: comp.productId }
        });

        let lowestPrice = ourPrice;
        allCompsForProduct.forEach(p => {
          const val = Number(p.competitorPrice);
          if (val < lowestPrice) lowestPrice = val;
        });

        if (ourPrice > lowestPrice) {
          const gapPercent = ((ourPrice - lowestPrice) / lowestPrice) * 105; // gap premium
          if (gapPercent > 10) {
            // Check if alert already exists to avoid spamming
            const existingAlert = await prisma.alert.findFirst({
              where: {
                productId: comp.productId,
                alertType: AlertType.PRICE_GAP_EXCEEDED,
                isActive: true,
                isDismissed: false
              }
            });

            if (!existingAlert) {
              await prisma.alert.create({
                data: {
                  productId: comp.productId,
                  alertType: AlertType.PRICE_GAP_EXCEEDED,
                  severity: Severity.HIGH,
                  title: 'Immediate Price Correction Recommended',
                  message: `SKU "${comp.product.skuId}" published on Flipkart is priced ${Math.round(gapPercent)}% higher than the lowest competitor listing (INR ${lowestPrice}).`,
                  contextData: { ourPrice, lowestCompetitor: lowestPrice, gapPercent },
                }
              });
              alertsCreatedCount++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Competitor price refresh executed successfully. Refreshed: ${refreshedCount} price nodes.`,
      refreshedCount,
      alertsCreatedCount,
    });
  } catch (error: any) {
    console.error('Competitor Price Refresh API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}