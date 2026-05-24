/**
 * lib/email.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised Nodemailer email service for Quantaculas alert notifications.
 *
 * • Reads SMTP credentials from environment variables.
 * • Falls back to Ethereal Mail (fake SMTP sandbox) when env vars are missing
 *   — prints a live preview URL to the server console so you can inspect the
 *   rendered HTML immediately in development without any real mail server.
 * • Exposes a single `sendAlertEmail(alert, product?)` function that builds a
 *   premium, brand-aligned HTML email and fires it asynchronously.
 */

import fs from 'fs';
import path from 'path';


// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertEmailPayload {
  id: string;
  alertType: string;   // e.g. 'PRICE_GAP_EXCEEDED'
  severity: string;    // 'HIGH' | 'MEDIUM' | 'LOW'
  title: string;
  message: string;
  contextData?: Record<string, unknown> | null;
  product?: {
    skuId: string;
    title: string;
    flipkartPrice?: number | null;
    mrp?: number | null;
  } | null;
}

// ─── Transport Singleton ──────────────────────────────────────────────────────

let _transporter: any = null;

async function getTransporter(): Promise<any> {
  if (_transporter) return _transporter;

  const nodemailer = eval("require")("nodemailer");
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    // ── Production / configured SMTP ──────────────────────────────────────────
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT ?? '587', 10),
      secure: parseInt(SMTP_PORT ?? '587', 10) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log(`[Email] 📬  SMTP transporter configured → ${SMTP_HOST}:${SMTP_PORT ?? 587}`);
  } else {
    // ── Ethereal Mail sandbox (auto-create a free test account) ───────────────
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('\n[Email] ⚠️  No SMTP env vars found — using Ethereal sandbox.');
    console.log(`[Email]    Ethereal account: ${testAccount.user}`);
    console.log('[Email]    Emails will NOT be delivered. Preview URLs will be printed below.\n');
  }

  if (!_transporter) {
    throw new Error('Nodemailer transporter failed to initialize');
  }
  return _transporter;
}

// ─── HTML Template Builder ────────────────────────────────────────────────────

function buildAlertHtml(alert: AlertEmailPayload): string {
  const isHigh = alert.severity === 'HIGH';
  const isMedium = alert.severity === 'MEDIUM';

  const severityColor   = isHigh ? '#EF4444' : isMedium ? '#F59E0B' : '#64748B';
  const severityBg      = isHigh ? '#FEF2F2' : isMedium ? '#FFFBEB' : '#F8FAFC';
  const severityLabel   = alert.severity;
  const severityEmoji   = isHigh ? '🚨' : isMedium ? '⚠️' : 'ℹ️';

  // Format alert type for display
  const alertTypeLabel = alert.alertType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Context data rows
  const ctx = alert.contextData ?? {};
  const contextRows = Object.entries(ctx)
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      return `
        <tr>
          <td style="padding:6px 12px;font-size:12px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">${label}</td>
          <td style="padding:6px 12px;font-size:12px;color:#0F172A;font-weight:700;border-bottom:1px solid #F1F5F9;">${String(v)}</td>
        </tr>`;
    })
    .join('');

  const productSection = alert.product
    ? `
    <div style="margin-top:20px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px;">
      <p style="margin:0 0 6px 0;font-size:11px;font-weight:800;letter-spacing:0.08em;color:#94A3B8;text-transform:uppercase;">Product</p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#0F172A;">${alert.product.title}</p>
      <p style="margin:4px 0 0 0;font-size:12px;font-weight:600;color:#64748B;">SKU: <span style="color:#3B82F6;">${alert.product.skuId}</span></p>
      ${alert.product.flipkartPrice != null
        ? `<p style="margin:4px 0 0 0;font-size:12px;font-weight:600;color:#64748B;">
             Flipkart Price: <span style="color:#0F172A;font-weight:800;">₹${alert.product.flipkartPrice}</span>
             ${alert.product.mrp != null ? ` &nbsp;|&nbsp; MRP: <span style="color:#0F172A;font-weight:800;">₹${alert.product.mrp}</span>` : ''}
           </p>` : ''}
    </div>`
    : '';

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/alerts`
    : 'http://localhost:3000/alerts';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${severityEmoji} ${alert.title}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0F172A;padding:24px 32px;border-radius:16px 16px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:18px;font-weight:900;color:#FFFFFF;letter-spacing:-0.02em;">Quantaculas</span>
                    <span style="font-size:10px;font-weight:700;color:#3B82F6;background:#1E3A5F;padding:2px 8px;border-radius:99px;margin-left:8px;vertical-align:middle;">PRO</span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;font-weight:700;color:#64748B;letter-spacing:0.06em;text-transform:uppercase;">Alert Engine</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Severity Banner -->
          <tr>
            <td style="background:${severityColor};padding:12px 32px;">
              <p style="margin:0;font-size:12px;font-weight:800;color:#FFFFFF;letter-spacing:0.08em;text-transform:uppercase;">
                ${severityEmoji} ${severityLabel} Severity &mdash; ${alertTypeLabel}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E2E8F0;border-top:none;">

              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:800;color:#0F172A;line-height:1.3;">${alert.title}</h1>
              <p style="margin:0 0 24px 0;font-size:14px;font-weight:500;color:#475569;line-height:1.6;">${alert.message}</p>

              ${contextRows
                ? `<div style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
                     <table width="100%" cellpadding="0" cellspacing="0">${contextRows}</table>
                   </div>`
                : ''}

              ${productSection}

              <!-- CTA -->
              <div style="margin-top:28px;text-align:center;">
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:#3B82F6;color:#FFFFFF;font-size:13px;font-weight:800;padding:12px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.03em;">
                  View in Dashboard &rarr;
                </a>
              </div>

              <!-- Footer note -->
              <p style="margin:28px 0 0 0;font-size:11px;color:#94A3B8;font-weight:600;text-align:center;line-height:1.6;">
                This alert was automatically generated by the Quantaculas Alert Engine.<br/>
                Alert ID: <code style="font-family:monospace;color:#64748B;">${alert.id}</code>
              </p>
            </td>
          </tr>

          <!-- Bottom spacer -->
          <tr><td style="height:32px;"></td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getRecipientEmail(): string {
  try {
    const configPath = path.join(process.cwd(), 'lib', 'email_recipient.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.recipientEmail) {
        return data.recipientEmail;
      }
    }
  } catch (e) {
    console.error('[Email] Failed to read email_recipient.json:', e);
  }
  return process.env.ALERT_EMAIL_RECIPIENT ?? 'seller-admin@yourdomain.com';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends a rich HTML alert email.
 *
 * This is fire-and-forget: it does NOT throw — errors are logged to the console
 * so a failed email delivery never breaks the primary alert creation flow.
 */
export async function sendAlertEmail(alert: AlertEmailPayload): Promise<void> {
  try {
    const transporter = await getTransporter();
    const nodemailer = eval("require")("nodemailer");

    const from    = process.env.SMTP_FROM ?? '"Quantaculas Alerts" <no-reply@quantaculas.com>';
    const to      = getRecipientEmail();
    const subject = `${alert.severity === 'HIGH' ? '🚨' : '⚠️'} [${alert.severity}] ${alert.title}`;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: buildAlertHtml(alert),
    });

    // Ethereal gives us a web preview URL — log it so you can open it instantly
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n[Email] 📧  Alert email preview → ${previewUrl}\n`);
      // Save preview URL to a temporary file so the frontend can display it in dev mode!
      try {
        const previewPath = path.join(process.cwd(), 'lib', 'email_last_preview.json');
        fs.writeFileSync(previewPath, JSON.stringify({ previewUrl, timestamp: new Date().toISOString() }));
      } catch (e) {
        // ignore
      }
    } else {
      console.log(`[Email] ✅  Alert email sent → MessageID: ${info.messageId}`);
      try {
        const previewPath = path.join(process.cwd(), 'lib', 'email_last_preview.json');
        fs.writeFileSync(previewPath, JSON.stringify({ sentDirectly: true, timestamp: new Date().toISOString() }));
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    // Non-blocking — log but never bubble up
    console.error('[Email] ❌  Failed to send alert email:', err);
  }
}

