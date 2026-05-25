import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Welcome to the Quantacus API Services Hub",
    interactive_docs: "/api-docs",
    version: "1.0.0",
    endpoints: {
      alerts: {
        feed: "/api/alerts",
        config: "/api/alerts/config",
        rules: "/api/alerts/rules",
        test_email: "/api/alerts/test-email"
      },
      catalog: {
        products: "/api/products",
        detail: "/api/products/[skuId]",
        enhance_title: "/api/products/[skuId]/enhance-title",
        competitor_prices: "/api/products/[skuId]/competitor-prices"
      },
      jobs: {
        queue: "/api/jobs",
        status: "/api/jobs/[jobId]"
      },
      uploads: {
        video: "/api/upload-video",
        products_csv: "/api/upload-products-csv"
      }
    }
  });
}
