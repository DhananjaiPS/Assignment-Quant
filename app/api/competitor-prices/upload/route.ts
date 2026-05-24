import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Platform, Severity, AlertType, JobType, JobStatus } from '@prisma/client';

function parseCsvDate(dateStr?: string): Date {
  if (!dateStr || dateStr.trim() === '') return new Date();
  const cleanStr = dateStr.trim().replace(/[n\r\t]+$/, '');
  const parsed = new Date(cleanStr);
  if (isNaN(parsed.getTime())) {
    const dateMatch = cleanStr.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      const matchParsed = new Date(dateMatch[0]);
      if (!isNaN(matchParsed.getTime())) return matchParsed;
    }
    return new Date();
  }
  return parsed;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const selectedSkuIdsStr = formData.get('selectedSkuIds') as string | null;
    const selectedSkuIds: string[] | null = selectedSkuIdsStr ? JSON.parse(selectedSkuIdsStr) : null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No CSV file uploaded.' }, { status: 400 });
    }

    const text = await file.text();
    // Split lines, filter out empty ones
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

    if (lines.length <= 1) {
      return NextResponse.json({ success: false, error: 'CSV file is empty or missing data rows.' }, { status: 400 });
    }

    // Initialize an import job to track progress
    const importJob = await prisma.processingJob.create({
      data: {
        jobType: JobType.CSV_IMPORT,
        status: JobStatus.RUNNING,
        progress: 10,
        metadata: { fileName: file.name, type: 'competitor_prices' },
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: importJob.id,
        message: `Started parsing competitor prices CSV feed: "${file.name}"`,
      },
    });

    // Parse Headers
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    let alertsCreatedCount = 0;

    const mapPlatform = (platformStr: string): Platform | null => {
      const p = platformStr.trim().toUpperCase().replace(/[\s-]/g, '_');
      if (p === 'AMAZON') return Platform.AMAZON;
      if (p === 'MYNTRA') return Platform.MYNTRA;
      if (p === 'AJIO') return Platform.AJIO;
      if (p === 'NYKAA' || p === 'NYKAA_FASHION') return Platform.NYKAA;
      if (p === 'TATA_CLIQ' || p === 'TATA_CLIQ_FASHION' || p === 'TATACLIQ') return Platform.TATA_CLIQ;
      if (p === 'MEESHO') return Platform.MEESHO;
      return null;
    };

    // CSV parser regex to handle commas inside quotes if any
    const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(csvSplitRegex).map((v) => v.trim().replace(/^["']|["']$/g, ''));

      if (values.length < headers.length) {
        failCount++;
        errors.push(`Row ${i}: Missing column count (found ${values.length}, expected ${headers.length})`);
        continue;
      }

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const skuId = row['sku_id'];

      // If client provided a list of selected SKUs, skip rows not selected
      if (selectedSkuIds && skuId && !selectedSkuIds.includes(skuId)) {
        continue;
      }

      const platformStr = row['platform'];
      const priceStr = row['competitor_price'];

      if (!skuId || !platformStr || !priceStr) {
        failCount++;
        errors.push(`Row ${i}: Missing one of required fields (sku_id, platform, competitor_price)`);
        continue;
      }

      const platformEnum = mapPlatform(platformStr);
      if (!platformEnum) {
        failCount++;
        errors.push(`Row ${i} (SKU: ${skuId}): Unknown platform "${platformStr}"`);
        continue;
      }

      const competitorPriceValue = Number(priceStr);
      if (isNaN(competitorPriceValue) || competitorPriceValue <= 0) {
        failCount++;
        errors.push(`Row ${i} (SKU: ${skuId}): Invalid competitor price "${priceStr}"`);
        continue;
      }

      // Find parent product in catalog
      const product = await prisma.product.findUnique({
        where: { skuId },
      });

      if (!product) {
        failCount++;
        errors.push(`Row ${i}: Product with SKU "${skuId}" not found in inventory catalog.`);
        continue;
      }

      const competitorUrl = row['competitor_url'] || `https://example.com/competitor-${skuId}-${platformEnum.toLowerCase()}`;
      const competitorTitle = row['product_name'] || `${product.productTitle || 'Product'} on ${platformEnum}`;

      try {
        // Find if this competitor record exists by platform and product (ignore URL differences to prevent duplicates)
        const existingPrice = await prisma.competitorPrice.findFirst({
          where: {
            productId: product.id,
            platform: platformEnum,
          }
        });

        if (existingPrice) {
          const oldPrice = Number(existingPrice.competitorPrice);
          
          await prisma.competitorPrice.update({
            where: { id: existingPrice.id },
            data: {
              competitorPrice: competitorPriceValue,
              competitorTitle,
              competitorUrl: competitorUrl || existingPrice.competitorUrl,
              lastCheckedAt: parseCsvDate(row['last_checked_at']),
            }
          });

          if (oldPrice !== competitorPriceValue) {
            // Log history
            await prisma.competitorPriceHistory.create({
              data: {
                competitorPriceId: existingPrice.id,
                oldPrice,
                newPrice: competitorPriceValue,
                changedAt: new Date()
              }
            });

            // Check for competitor price drop alert (>= 15% drop)
            const dropPercent = ((oldPrice - competitorPriceValue) / oldPrice) * 100;
            if (dropPercent >= 15) {
              await prisma.alert.create({
                data: {
                  productId: product.id,
                  alertType: AlertType.COMPETITOR_PRICE_DROP,
                  severity: Severity.MEDIUM,
                  title: 'Competitor Price Cut Detected',
                  message: `Competitor on ${platformEnum} slashed price for SKU "${skuId}" by ${Math.round(dropPercent)}% (INR ${oldPrice} -> INR ${competitorPriceValue}).`,
                  contextData: { oldPrice, newPrice: competitorPriceValue, platform: platformEnum },
                }
              });
              alertsCreatedCount++;
            }
          }
        } else {
          // Create new record
          const newPriceRecord = await prisma.competitorPrice.create({
            data: {
              productId: product.id,
              platform: platformEnum,
              competitorTitle,
              competitorUrl,
              competitorPrice: competitorPriceValue,
              lastCheckedAt: parseCsvDate(row['last_checked_at']),
            }
          });

          // Record initial price point
          await prisma.competitorPriceHistory.create({
            data: {
              competitorPriceId: newPriceRecord.id,
              oldPrice: competitorPriceValue,
              newPrice: competitorPriceValue,
              changedAt: new Date()
            }
          });
        }

        // Run pricing gap validation check
        if (product.price) {
          const ourPrice = Number(product.price);
          const currentPrices = await prisma.competitorPrice.findMany({
            where: { productId: product.id }
          });

          let lowestPrice = ourPrice;
          currentPrices.forEach(p => {
            const val = Number(p.competitorPrice);
            if (val < lowestPrice) lowestPrice = val;
          });

          if (ourPrice > lowestPrice) {
            const gapPercent = ((ourPrice - lowestPrice) / lowestPrice) * 105; // gap relative to lowest
            if (gapPercent > 10) {
              // Check existing active pricing alert to prevent duplicates
              const existingAlert = await prisma.alert.findFirst({
                where: {
                  productId: product.id,
                  alertType: AlertType.PRICE_GAP_EXCEEDED,
                  isActive: true,
                  isDismissed: false
                }
              });

              if (!existingAlert) {
                await prisma.alert.create({
                  data: {
                    productId: product.id,
                    alertType: AlertType.PRICE_GAP_EXCEEDED,
                    severity: Severity.HIGH,
                    title: 'Immediate Price Correction Recommended',
                    message: `SKU "${skuId}" published on Flipkart is priced ${Math.round(gapPercent)}% higher than the lowest competitor listing (INR ${lowestPrice}).`,
                    contextData: { ourPrice, lowestCompetitor: lowestPrice, gapPercent },
                  }
                });
                alertsCreatedCount++;
              }
            }
          }
        }

        successCount++;

        // Update job progress
        if (i % 5 === 0 || i === lines.length - 1) {
          const progressPercentage = Math.min(95, Math.round(10 + (i / lines.length) * 85));
          await prisma.processingJob.update({
            where: { id: importJob.id },
            data: { progress: progressPercentage },
          });
        }
      } catch (err: any) {
        failCount++;
        errors.push(`Row ${i} (SKU: ${skuId}): Database insertion error: ${err.message}`);
      }
    }

    const status = failCount > 0 && successCount > 0
      ? JobStatus.PARTIALLY_COMPLETED
      : failCount > 0
        ? JobStatus.FAILED
        : JobStatus.COMPLETED;

    await prisma.processingJob.update({
      where: { id: importJob.id },
      data: {
        status,
        progress: 100,
        completedAt: new Date(),
        errorMessage: failCount > 0 ? `Failed parsing ${failCount} competitor price rows out of ${lines.length - 1}` : null,
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: importJob.id,
        message: `Competitor CSV Import completed. Status: ${status}. Successfully processed: ${successCount} entries, Failed: ${failCount}.`,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: importJob.id,
      successCount,
      failCount,
      errors,
      alertsCreatedCount
    });
  } catch (error: any) {
    console.error('Competitor Price Ingestion Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}
