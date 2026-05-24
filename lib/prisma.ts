import { PrismaClient } from '@prisma/client';
import { sendAlertEmail, AlertEmailPayload } from './email';

// ─── Prisma Singleton ─────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── Alert Email Middleware ───────────────────────────────────────────────────
//
// Intercepts every `prisma.alert.create(...)` call.
// When the newly created alert is HIGH or MEDIUM severity, we kick off an
// async email notification — completely non-blocking so it never slows down
// the primary request.



prisma.$use(async (params: any, next: any) => {
  const result = await next(params);

  if (
    params.model === 'Alert' &&
    params.action === 'create' &&
    result &&
    (result.severity === 'HIGH' || result.severity === 'MEDIUM')
  ) {
    // Non-blocking — fire and forget
    (async () => {
      try {
        let product: any = null;

        if (result.productId) {
          product = await prisma.product.findUnique({
            where: { id: result.productId },
            select: {
              skuId: true,
              productTitle: true,
              price: true,
              mrp: true,
            },
          });
        }

        const payload: AlertEmailPayload = {
          id: result.id,
          alertType: result.alertType,
          severity: result.severity,
          title: result.title,
          message: result.message,
          contextData: result.contextData as Record<string, unknown> | null,
          product: product
            ? {
                skuId: product.skuId,
                title: product.productTitle ?? 'Untitled SKU',
                flipkartPrice: product.price ? Number(product.price) : null,
                mrp: product.mrp ? Number(product.mrp) : null,
              }
            : null,
        };

        await sendAlertEmail(payload);
      } catch (err) {
        console.error('[Prisma Middleware] Alert email dispatch failed:', err);
      }
    })();
  }

  return result;
});

