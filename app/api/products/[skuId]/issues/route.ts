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
        issues: {
          orderBy: [
            { severity: 'desc' },
            { createdAt: 'desc' }
          ]
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
      data: product.issues
    });
  } catch (error: any) {
    console.error('Error fetching product issues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}
