import { NextResponse } from 'next/server';
import { sendAlertEmail, AlertEmailPayload } from '@/lib/email';

export async function POST() {
  try {
    const simulatedAlert: AlertEmailPayload = {
      id: `test_${Math.random().toString(36).substring(2, 9)}`,
      alertType: 'PRICE_GAP_EXCEEDED',
      severity: 'HIGH',
      title: 'Nike Zoom Pegasus Running Shoes (SKU: SHOE001)',
      message: 'Our Flipkart selling price is highly uncompetitive (+14.3%) compared to Amazon.',
      contextData: {
        flipkartPrice: 'INR 3,999.00',
        lowestCompetitorPrice: 'INR 3,499.00 (Amazon)',
        priceGapPercent: '+14.3% (+INR 500.00)',
        actionRecommendation: 'Urgent! Price gap is high. Matching lowest competitor Amazon price to INR 3,499.00 is highly recommended to recover search discoverability.',
      },
      product: {
        skuId: 'SHOE001',
        title: 'Nike Zoom Pegasus Running Shoes',
        flipkartPrice: 3999.00,
        mrp: 4999.00,
      },
    };

    // Dispatch email
    await sendAlertEmail(simulatedAlert);

    return NextResponse.json({
      success: true,
      message: 'Test alert email dispatched successfully!',
      alert: simulatedAlert,
    });
  } catch (error: any) {
    console.error('Test Alert Email Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
