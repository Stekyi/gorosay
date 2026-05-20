import nodemailer from "nodemailer";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";

async function getTransport() {
  const [fromAddress, appPassword, smtpHost, smtpPort, smtpUsername] = await Promise.all([
    getSetting(SETTING_KEYS.EMAIL_FROM_ADDRESS),
    getSetting(SETTING_KEYS.EMAIL_APP_PASSWORD),
    getSetting(SETTING_KEYS.EMAIL_SMTP_HOST),
    getSetting(SETTING_KEYS.EMAIL_SMTP_PORT),
    getSetting(SETTING_KEYS.EMAIL_SMTP_USERNAME),
  ]);

  const host = smtpHost || "smtp.gmail.com";
  const port = parseInt(smtpPort || "587", 10);
  const user = smtpUsername || fromAddress || "";

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465, // enforce STARTTLS on port 587
    auth: { user, pass: appPassword ?? "" },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 7000,
    tls: { minVersion: "TLSv1.2" },
  });
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const enabled = await getSetting(SETTING_KEYS.EMAIL_ENABLED);
  if (enabled === "false") return;

  const [fromName, fromAddress] = await Promise.all([
    getSetting(SETTING_KEYS.EMAIL_FROM_NAME),
    getSetting(SETTING_KEYS.EMAIL_FROM_ADDRESS),
  ]);

  const transport = await getTransport();
  await transport.sendMail({
    from: `"${fromName ?? "Gorosay"}" <${fromAddress}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

// ── Email templates ──────────────────────────────────────────────────────────

function emailWrapper(content: string, fromName = "Gorosay") {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e40af;padding:20px 28px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">${fromName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated message. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(customer: {
  name: string;
  email: string;
  customerNumber: string;
}): Promise<void> {
  const fromName = (await getSetting(SETTING_KEYS.EMAIL_FROM_NAME)) ?? "Gorosay";

  const content = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;">Hi <strong>${customer.name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Welcome! You've been successfully registered on our document management platform.
      We'll keep track of your vehicle and driver documents and alert you before anything expires.
    </p>
    <table style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#0369a1;">
          <strong>Your Account ID:</strong> ${customer.customerNumber}
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      If you have any questions, feel free to contact us. We're glad to have you on board.
    </p>`;

  await sendEmail({
    to: customer.email,
    subject: `Welcome to ${fromName} — You're all set!`,
    html: emailWrapper(content, fromName),
    text: `Hi ${customer.name}, welcome! Your account ID is ${customer.customerNumber}. We'll alert you before your documents expire.`,
  });
}

export async function sendDocumentUploadEmail(params: {
  customerEmail: string;
  customerName: string;
  documentType: string;
  entityRef: string;
  issueDate: string | null;
  expiryDate: string | null;
  downloadUrl: string;
}): Promise<void> {
  const { customerEmail, customerName, documentType, entityRef, issueDate, expiryDate, downloadUrl } = params;
  const fromName = (await getSetting(SETTING_KEYS.EMAIL_FROM_NAME)) ?? "Gorosay";

  const rows = [
    ["Document Type", documentType],
    ["Vehicle / Driver", entityRef],
    issueDate ? ["Issue Date", issueDate] : null,
    expiryDate ? ["Expiry Date", `<span style="color:#dc2626;font-weight:bold;">${expiryDate}</span>`] : null,
  ].filter(Boolean) as [string, string][];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#374151;border:1px solid #e5e7eb;background:#f9fafb;width:40%;">${label}</td>
      <td style="padding:9px 12px;font-size:13px;color:#111827;border:1px solid #e5e7eb;">${value}</td>
    </tr>`).join("");

  const content = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;">Hi <strong>${customerName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      A new document has been uploaded to your account. Here are the details:
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${tableRows}</table>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">
      Click the button below to download your copy of this document:
    </p>
    <a href="${downloadUrl}" target="_blank"
       style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
      Download Document
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
      This download link is valid for 6 days. Contact us if you need a new link after it expires.
    </p>`;

  await sendEmail({
    to: customerEmail,
    subject: `Document uploaded — ${documentType} for ${entityRef}`,
    html: emailWrapper(content, fromName),
    text: `Hi ${customerName}, a new ${documentType} document has been uploaded for ${entityRef}. Download here: ${downloadUrl}`,
  });
}

export function buildExpiryEmailHtml(params: {
  customerName: string;
  documentType: string;
  entityRef: string;
  targetDate: string;
  daysBefore: number;
  isRenewal: boolean;
}): string {
  const { customerName, documentType, entityRef, targetDate, daysBefore, isRenewal } = params;
  const urgency = daysBefore <= 1 ? "CRITICAL" : daysBefore <= 5 ? "URGENT" : "REMINDER";
  const action = isRenewal ? "renewal date" : "expiry date";

  const content = `
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;">${urgency}</p>
    <h2 style="margin:0 0 20px;font-size:20px;color:#111827;">Document ${isRenewal ? "Renewal" : "Expiry"} Alert</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Dear <strong>${customerName}</strong>, the following document has an upcoming <strong>${action}</strong>:
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#374151;border:1px solid #e5e7eb;background:#f9fafb;width:40%;">Document Type</td>
        <td style="padding:9px 12px;font-size:13px;color:#111827;border:1px solid #e5e7eb;">${documentType}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#374151;border:1px solid #e5e7eb;background:#f9fafb;">Vehicle / Driver</td>
        <td style="padding:9px 12px;font-size:13px;color:#111827;border:1px solid #e5e7eb;">${entityRef}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#374151;border:1px solid #e5e7eb;background:#f9fafb;">Due Date</td>
        <td style="padding:9px 12px;font-size:13px;font-weight:bold;color:#dc2626;border:1px solid #e5e7eb;">${targetDate}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#374151;border:1px solid #e5e7eb;background:#f9fafb;">Days Remaining</td>
        <td style="padding:9px 12px;font-size:13px;font-weight:bold;color:#dc2626;border:1px solid #e5e7eb;">${daysBefore} day${daysBefore !== 1 ? "s" : ""}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#374151;">Please contact us to arrange renewal before this date.</p>`;

  return emailWrapper(content);
}
