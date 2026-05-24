import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'ALL';
    const availability = searchParams.get('availability') || 'ALL';
    const qualityFilter = searchParams.get('quality') || 'ALL'; // HIGH, MEDIUM, LOW, ALL

    // Build Prisma query clauses
    const where: any = {};

    if (search) {
      where.OR = [
        { productTitle: { contains: search, mode: 'insensitive' } },
        { skuId: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category !== 'ALL') {
      where.category = category;
    }

    if (availability !== 'ALL') {
      where.availability = availability;
    }

    if (qualityFilter !== 'ALL') {
      if (qualityFilter === 'HIGH') {
        where.qualityScore = { gte: 85.00 };
      } else if (qualityFilter === 'MEDIUM') {
        where.qualityScore = { gte: 50.00, lt: 85.00 };
      } else if (qualityFilter === 'LOW') {
        where.qualityScore = { lt: 50.00 };
      }
    }

    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;

    const [products, totalCount, lowQualityCount, mediumQualityCount, highQualityCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          issues: true,
          competitorPrices: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
      prisma.product.count({
        where: {
          ...where,
          qualityScore: { lt: 50.00 },
        },
      }),
      prisma.product.count({
        where: {
          ...where,
          qualityScore: { gte: 50.00, lt: 85.00 },
        },
      }),
      prisma.product.count({
        where: {
          ...where,
          qualityScore: { gte: 85.00 },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      products,
      totalPages,
      stats: {
        totalCount,
        lowQualityCount,
        mediumQualityCount,
        highQualityCount,
      },
    });
  } catch (error: any) {
    console.error('Products List API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
