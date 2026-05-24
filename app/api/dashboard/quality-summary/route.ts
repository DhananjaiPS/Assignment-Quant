import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const totalProducts = await prisma.product.count();

    const avgScoreResult = await prisma.product.aggregate({
      _avg: { qualityScore: true }
    });
    
    const issues = await prisma.productIssue.groupBy({
      by: ['severity'],
      _count: { severity: true },
      where: { isResolved: false }
    });

    const activeAlerts = await prisma.alert.count({
      where: { isActive: true, isDismissed: false }
    });

    const issueCounts = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };

    issues.forEach(issue => {
      issueCounts[issue.severity] = issue._count.severity;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalProducts,
        averageQualityScore: avgScoreResult._avg.qualityScore || 0,
        issueCounts,
        activeAlerts
      }
    });
  } catch (error: any) {
    console.error('Error fetching dashboard quality summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quality summary' },
      { status: 500 }
    );
  }
}
