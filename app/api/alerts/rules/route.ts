import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rules = await prisma.alertRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    console.error('Error fetching alert rules:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch alert rules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, alertType, threshold, isActive } = body;

    if (!name || !alertType) {
      return NextResponse.json({ success: false, error: 'Name and alertType are required' }, { status: 400 });
    }

    let rule;
    if (id) {
      // Update existing rule
      rule = await prisma.alertRule.update({
        where: { id },
        data: {
          name,
          alertType,
          threshold: threshold ? parseFloat(threshold) : null,
          isActive: isActive !== undefined ? isActive : true
        }
      });
    } else {
      // Create new rule
      rule = await prisma.alertRule.create({
        data: {
          name,
          alertType,
          threshold: threshold ? parseFloat(threshold) : null,
          isActive: isActive !== undefined ? isActive : true
        }
      });
    }

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    console.error('Error saving alert rule:', error);
    return NextResponse.json({ success: false, error: 'Failed to save alert rule' }, { status: 500 });
  }
}
