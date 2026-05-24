import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function escapeCSVField(val: any) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        issues: {
          where: { isResolved: false }
        }
      },
      orderBy: { skuId: 'asc' }
    });

    const headers = [
      'SKU ID',
      'Product Title',
      'Brand',
      'Category',
      'Price (INR)',
      'MRP (INR)',
      'Quality Score (%)',
      'Confidence Score',
      'Availability',
      'Pending Issues'
    ];
    const csvRows = [headers.join(',')];

    for (const product of products) {
      const issuesText = product.issues.map(i => `[${i.severity}] ${i.title}: ${i.description}`).join('; ');
      const row = [
        product.skuId,
        product.productTitle || '',
        product.brand || '',
        product.category || '',
        product.price ? product.price.toString() : '',
        product.mrp ? product.mrp.toString() : '',
        product.qualityScore ? product.qualityScore.toString() : '',
        product.confidenceScore ? product.confidenceScore.toString() : '',
        product.availability,
        issuesText
      ];
      csvRows.push(row.map(escapeCSVField).join(','));
    }

    const csvContent = csvRows.join('\r\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="product_quality_report_${Date.now()}.csv"`,
      }
    });
  } catch (error: any) {
    console.error('Error generating quality CSV export:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
