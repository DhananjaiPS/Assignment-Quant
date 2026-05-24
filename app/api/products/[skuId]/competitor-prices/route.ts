import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> }
) {
  try {
    const { skuId } = await params;
    const product = await prisma.product.findUnique({
      where: { skuId },
      include: {
        competitorPrices: {
          orderBy: { competitorPrice: 'asc' },
          include: {
            priceHistory: {
              orderBy: { changedAt: 'desc' },
              take: 10
            }
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product.competitorPrices
    });
  } catch (error: any) {
    console.error('Error fetching competitor prices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch competitor prices' },
      { status: 500 }
    );
  }
}
