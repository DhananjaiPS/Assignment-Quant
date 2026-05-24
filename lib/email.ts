/**
 * lib/email.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium Quantaculas Email Engine
 * Modern White + Blue Enterprise Theme
 */

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertEmailPayload {
  id: string;
  alertType: string;
  severity: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORTER SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

let _transporter: any = null;

async function getTransporter(): Promise<any> {
  if (_transporter) return _transporter;

  const nodemailer = eval('require')('nodemailer');

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  // ─── Production SMTP ──────────────────────────────────────────────────────

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT ?? '587', 10),
      secure: parseInt(SMTP_PORT ?? '587', 10) === 465,

      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log(
      `[Email] ✅ SMTP Connected → ${SMTP_HOST}:${SMTP_PORT ?? 587}`
    );
  }

  // ─── Ethereal Dev Mail ───────────────────────────────────────────────────

  else {
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

    console.log('\n[Email] ⚠️ Using Ethereal Sandbox Mode');
    console.log(`[Email] Account → ${testAccount.user}\n`);
  }

  return _transporter;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function buildAlertHtml(alert: AlertEmailPayload): string {
  const isHigh = alert.severity === 'HIGH';
  const isMedium = alert.severity === 'MEDIUM';

  const severityColor = isHigh
    ? '#2563EB'
    : isMedium
      ? '#3B82F6'
      : '#60A5FA';

  const severityBadgeBg = '#EFF6FF';

  const severityEmoji = isHigh
    ? '🚨'
    : isMedium
      ? '⚠️'
      : 'ℹ️';

  const alertTypeLabel = alert.alertType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // ─── Context Rows ────────────────────────────────────────────────────────

  const ctx = alert.contextData ?? {};

  const contextRows = Object.entries(ctx)
    .map(([k, v]) => {
      const label = k
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase());

      return `
        <tr>
          <td style="
            padding:12px 16px;
            border-bottom:1px solid #E2E8F0;
            color:#64748B;
            font-size:13px;
            font-weight:600;
          ">
            ${label}
          </td>

          <td style="
            padding:12px 16px;
            border-bottom:1px solid #E2E8F0;
            color:#0F172A;
            font-size:13px;
            font-weight:800;
            text-align:right;
          ">
            ${String(v)}
          </td>
        </tr>
      `;
    })
    .join('');

  // ─── Product Card ────────────────────────────────────────────────────────

  const productSection = alert.product
    ? `
      <div style="
        margin-top:24px;
        background:#F8FAFC;
        border:1px solid #E2E8F0;
        border-radius:18px;
        padding:20px;
      ">

        <p style="
          margin:0 0 10px 0;
          font-size:11px;
          color:#3B82F6;
          font-weight:800;
          letter-spacing:0.08em;
          text-transform:uppercase;
        ">
          Product Details
        </p>

        <h3 style="
          margin:0;
          color:#0F172A;
          font-size:18px;
          font-weight:800;
        ">
          ${alert.product.title}
        </h3>

        <p style="
          margin:8px 0 0 0;
          color:#64748B;
          font-size:13px;
          font-weight:600;
        ">
          SKU:
          <span style="color:#2563EB;">
            ${alert.product.skuId}
          </span>
        </p>

        ${alert.product.flipkartPrice != null
      ? `
            <p style="
              margin:10px 0 0 0;
              color:#0F172A;
              font-size:14px;
              font-weight:700;
            ">
              Flipkart Price:
              ₹${alert.product.flipkartPrice}

              ${alert.product.mrp != null
        ? `
                  <span style="color:#94A3B8;">
                    &nbsp;|&nbsp;
                  </span>

                  MRP:
                  ₹${alert.product.mrp}
                `
        : ''
      }
            </p>
          `
      : ''
    }

      </div>
    `
    : '';

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/alerts`
    : 'http://localhost:3000/alerts';

  // ─────────────────────────────────────────────────────────────────────────

  return `
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${alert.title}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#F1F5F9;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
">

<table width="100%" cellpadding="0" cellspacing="0">

<tr>
<td align="center" style="padding:50px 16px;">

<table width="620" cellpadding="0" cellspacing="0"
style="
  max-width:620px;
  width:100%;
  background:#FFFFFF;
  border-radius:24px;
  overflow:hidden;
  border:1px solid #E2E8F0;
  box-shadow:
    0 10px 40px rgba(37,99,235,0.08);
">

<!-- HEADER -->

<tr>
<td style="
  background:linear-gradient(
    135deg,
    #2563EB 0%,
    #3B82F6 100%
  );

  padding:32px;
">

<table width="100%">

<tr>

<td>

<h1 style="
  margin:0;
  color:#FFFFFF;
  font-size:28px;
  font-weight:900;
  letter-spacing:-0.03em;
">
  Quantaculas
</h1>

<p style="
  margin:6px 0 0 0;
  color:rgba(255,255,255,0.8);
  font-size:13px;
  font-weight:500;
">
  Smart Product Intelligence Alerts
</p>

</td>

<td align="right">

<span style="
  background:rgba(255,255,255,0.15);
  color:#FFFFFF;
  padding:10px 14px;
  border-radius:999px;
  font-size:12px;
  font-weight:800;
  letter-spacing:0.08em;
">
  ${severityEmoji} ${alert.severity}
</span>

</td>

</tr>

</table>

</td>
</tr>

<!-- BODY -->

<tr>
<td style="padding:36px;">

<div style="
  display:inline-block;
  background:${severityBadgeBg};
  color:${severityColor};
  padding:8px 14px;
  border-radius:999px;
  font-size:12px;
  font-weight:800;
  letter-spacing:0.06em;
  text-transform:uppercase;
">
  ${alertTypeLabel}
</div>

<h2 style="
  margin:20px 0 12px 0;
  color:#0F172A;
  font-size:28px;
  line-height:1.3;
  font-weight:900;
">
  ${alert.title}
</h2>

<p style="
  margin:0;
  color:#475569;
  font-size:15px;
  line-height:1.8;
  font-weight:500;
">
  ${alert.message}
</p>

${contextRows
      ? `
      <div style="
        margin-top:28px;
        border:1px solid #E2E8F0;
        border-radius:18px;
        overflow:hidden;
      ">

      <table width="100%" cellpadding="0" cellspacing="0">
        ${contextRows}
      </table>

      </div>
    `
      : ''
    }

${productSection}

<!-- CTA -->

<div style="
  margin-top:34px;
  text-align:center;
">

<a
href="${dashboardUrl}"

style="
  display:inline-block;
  background:#2563EB;
  color:#FFFFFF;
  padding:16px 28px;
  border-radius:14px;
  text-decoration:none;
  font-size:14px;
  font-weight:800;
  letter-spacing:0.03em;
  box-shadow:
    0 8px 20px rgba(37,99,235,0.2);
"
>
  Open Dashboard →
</a>

</div>

<!-- FOOTER -->

<div style="
  margin-top:36px;
  padding-top:24px;
  border-top:1px solid #E2E8F0;
  text-align:center;
">

<p style="
  margin:0;
  color:#94A3B8;
  font-size:12px;
  line-height:1.7;
  font-weight:500;
">

This alert was automatically generated by
<strong style="color:#2563EB;">
Quantaculas Alert Engine
</strong>

<br /><br />

Alert ID:
<code style="
  background:#F8FAFC;
  padding:6px 10px;
  border-radius:8px;
  color:#475569;
  font-size:11px;
">
  ${alert.id}
</code>

</p>

</div>

</td>
</tr>

</table>

</td>
</tr>

</table>

</body>
</html>
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIPIENT EMAIL
// ─────────────────────────────────────────────────────────────────────────────

export function getRecipientEmail(): string {
  try {
    const configPath = path.join(
      process.cwd(),
      'lib',
      'email_recipient.json'
    );

    if (fs.existsSync(configPath)) {
      const data = JSON.parse(
        fs.readFileSync(configPath, 'utf8')
      );

      if (data.recipientEmail) {
        return data.recipientEmail;
      }
    }
  } catch (e) {
    console.error('[Email] Failed reading recipient:', e);
  }

  return (
    process.env.ALERT_EMAIL_RECIPIENT ??
    'seller-admin@quantaculas.com'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND EMAIL
// ─────────────────────────────────────────────────────────────────────────────

export async function sendAlertEmail(
  alert: AlertEmailPayload
): Promise<void> {
  try {
    const transporter = await getTransporter();

    const nodemailer = eval('require')('nodemailer');

    const from =
      process.env.SMTP_FROM ??
      '"Quantaculas Alerts" <no-reply@quantaculas.com>';

    const to = getRecipientEmail();

    const subject =
      `${alert.severity === 'HIGH' ? '🚨' : '⚠️'} ` +
      `[${alert.severity}] ${alert.title}`;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: buildAlertHtml(alert),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      console.log(`\n[Email Preview] ${previewUrl}\n`);

      try {
        const previewPath = path.join(
          process.cwd(),
          'lib',
          'email_last_preview.json'
        );

        fs.writeFileSync(
          previewPath,
          JSON.stringify({
            previewUrl,
            timestamp: new Date().toISOString(),
          })
        );
      } catch { }
    } else {
      console.log(
        `[Email] ✅ Sent Successfully → ${info.messageId}`
      );
    }
  } catch (err) {
    console.error(
      '[Email] ❌ Failed to send alert email:',
      err
    );
  }
}