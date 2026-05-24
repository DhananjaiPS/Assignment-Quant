import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRecipientEmail } from '@/lib/email';

export async function GET() {
  try {
    const recipientEmail = getRecipientEmail();
    const hasSmtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

    // Read last email preview if exists
    let lastPreview = null;
    try {
      const previewPath = path.join(process.cwd(), 'lib', 'email_last_preview.json');
      if (fs.existsSync(previewPath)) {
        lastPreview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }

    return NextResponse.json({
      success: true,
      recipientEmail,
      hasSmtpConfigured,
      smtpHost: process.env.SMTP_HOST || 'Ethereal Mail (Sandbox)',
      lastPreview,
    });
  } catch (error: any) {
    console.error('Email Config GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipientEmail } = body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const configPath = path.join(process.cwd(), 'lib', 'email_recipient.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ recipientEmail, updatedAt: new Date().toISOString() }, null, 2)
    );

    return NextResponse.json({
      success: true,
      message: 'Email address connected successfully!',
      recipientEmail,
    });
  } catch (error: any) {
    console.error('Email Config POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
