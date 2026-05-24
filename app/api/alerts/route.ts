import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = await prisma.alert.findMany({
      where: {
        isActive: true,
        isDismissed: false,
      },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, alerts });
  } catch (error: any) {
    console.error('Alerts API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { alertId, action } = body; // action: 'read' | 'dismiss'

    if (!alertId) {
      return NextResponse.json({ success: false, error: 'Alert ID is required.' }, { status: 400 });
    }

    let updatedAlert;
    if (action === 'read') {
      updatedAlert = await prisma.alert.update({
        where: { id: alertId },
        data: { isRead: true },
      });
    } else if (action === 'dismiss') {
      updatedAlert = await prisma.alert.update({
        where: { id: alertId },
        data: { isDismissed: true, isActive: false },
      });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action parameter.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, alert: updatedAlert });
  } catch (error: any) {
    console.error('Alert Update API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
