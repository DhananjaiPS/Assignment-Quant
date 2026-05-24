import { PrismaClient, Severity, JobStatus, JobType, Platform, IssueType, UploadType, ExtractionSource, ExtractionStatus, AvailabilityStatus, AlertType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean existing records to avoid duplicates
  await prisma.jobLog.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.competitorPriceHistory.deleteMany();
  await prisma.competitorPrice.deleteMany();
  await prisma.productIssue.deleteMany();
  await prisma.titleEnhancement.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.product.deleteMany();
  await prisma.processingJob.deleteMany();

  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing tables.');

  // Create default admin user for Clerk matching
  await prisma.user.create({
    data: {
      email: 'dhananjai@gmail.com',
      password: 'clerk-managed', // placeholder, auth managed by Clerk
      role: 'ADMIN',
    }
  });
  console.log('👤 Created default ADMIN user: dhananjai@gmail.com');

  console.log('✅ Database is clean and ready for live production data ingestion.');

  console.log('🌱 Seeding process COMPLETED successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
