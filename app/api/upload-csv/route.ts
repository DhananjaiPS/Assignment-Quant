import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateProduct } from '@/lib/validator';
import { JobType, JobStatus, ExtractionSource, ExtractionStatus, AvailabilityStatus, Platform } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No CSV file uploaded.' }, { status: 400 });
    }

    const text = await file.text();
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
        metadata: { fileName: file.name },
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: importJob.id,
        message: `Started parsing product CSV feed: "${file.name}"`,
      },
    });

    // Parse Headers
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Helper regex to split CSV by commas, but ignore commas inside quotes
    const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Use advanced split to handle nested commas in descriptions
      const values = line.split(csvSplitRegex).map((v) => v.trim().replace(/^["']|["']$/g, ''));

      if (values.length < headers.length) {
        failCount++;
        errors.push(`Row ${i}: Missing column count (found ${values.length}, expected ${headers.length})`);
        continue;
      }

      // Map row keys
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const skuId = row['sku_id'] || `SKU-CSV-${Math.floor(1000 + Math.random() * 9000)}`;
      const priceVal = row['price'] ? Number(row['price']) : null;
      const mrpVal = row['mrp'] ? Number(row['mrp']) : null;

      let avail: AvailabilityStatus = AvailabilityStatus.IN_STOCK;
      if (row['availability']?.toLowerCase().includes('out')) {
        avail = AvailabilityStatus.OUT_OF_STOCK;
      } else if (row['availability']?.toLowerCase().includes('pre')) {
        avail = AvailabilityStatus.PRE_ORDER;
      }

      // Run Listing Quality Validation on the item
      const validation = validateProduct({
        productTitle: row['product_title'],
        description: row['description'],
        brand: row['brand'],
        price: priceVal,
        mrp: mrpVal,
        imageUrl: row['image_url'],
        availability: avail,
        color: row['color'],
        size: row['size'],
        material: row['material'],
        gender: row['gender'],
      });

      try {
        // Upsert Product by unique skuId
        const product = await prisma.product.upsert({
          where: { skuId },
          update: {
            productTitle: row['product_title'] || null,
            description: row['description'] || null,
            brand: row['brand'] || null,
            category: row['category'] || null,
            price: priceVal,
            mrp: mrpVal,
            availability: avail,
            imageUrl: row['image_url'] || null,
            productUrl: row['product_url'] || null,
            color: row['color'] || null,
            size: row['size'] || null,
            material: row['material'] || null,
            gender: row['gender'] || null,
            qualityScore: validation.qualityScore,
            extractionSource: ExtractionSource.CSV_FALLBACK,
            extractionStatus: ExtractionStatus.COMPLETED,
          },
          create: {
            skuId,
            productTitle: row['product_title'] || null,
            description: row['description'] || null,
            brand: row['brand'] || null,
            category: row['category'] || null,
            price: priceVal,
            mrp: mrpVal,
            availability: avail,
            imageUrl: row['image_url'] || null,
            productUrl: row['product_url'] || null,
            color: row['color'] || null,
            size: row['size'] || null,
            material: row['material'] || null,
            gender: row['gender'] || null,
            qualityScore: validation.qualityScore,
            extractionSource: ExtractionSource.CSV_FALLBACK,
            extractionStatus: ExtractionStatus.COMPLETED,
          },
        });

        // 1. Re-populate validation issues
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

        successCount++;
      } catch (err: any) {
        failCount++;
        errors.push(`Row ${i} (SKU: ${skuId}): Database insertion error: ${err.message}`);
      }
    }

    // Finalize Ingestion Job status
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
        errorMessage: failCount > 0 ? `Failed parsing ${failCount} rows out of ${lines.length - 1}` : null,
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: importJob.id,
        message: `CSV Import completed. Status: ${status}. Successfully processed: ${successCount} SKUs, Failed: ${failCount}.`,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: importJob.id,
      successCount,
      failCount,
      errors,
    });
  } catch (error: any) {
    console.error('CSV Ingestion API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}