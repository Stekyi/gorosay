import nodemailer from "nodemailer";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";

async function getTransport() {
  const [fromAddress, appPassword] = await Promise.all([
    getSetting(SETTING_KEYS.EMAIL_FROM_ADDRESS),
    getSetting(SETTING_KEYS.EMAIL_APP_PASSWORD),
  ]);

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: fromAddress ?? "",
      pass: appPassword ?? "",
    },
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

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1e40af;color:white;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">Gorosay Document Tracker</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="font-size:14px;color:#6b7280;margin-top:0;">${urgency} NOTICE</p>
    <h2 style="color:#111827;margin-top:0;">Document ${isRenewal ? "Renewal" : "Expiry"} Alert</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p>This is a reminder that the following document has an upcoming <strong>${action}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px;font-weight:bold;border:1px solid #e5e7eb;">Document Type</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${documentType}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold;border:1px solid #e5e7eb;">Vehicle / Driver</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${entityRef}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px;font-weight:bold;border:1px solid #e5e7eb;">Due Date</td>
        <td style="padding:10px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${targetDate}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold;border:1px solid #e5e7eb;">Days Remaining</td>
        <td style="padding:10px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${daysBefore} day${daysBefore !== 1 ? "s" : ""}</td>
      </tr>
    </table>
    <p>Please contact us to arrange renewal before this date.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;">This is an automated message from Gorosay Document Management System.</p>
  </div>
</body>
</html>`;
}
