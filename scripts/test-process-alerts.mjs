/**
 * Runs processAlerts equivalent directly against production DB/SMTP.
 * Run: node scripts/test-process-alerts.mjs
 */
import { neon } from "@neondatabase/serverless";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const sql = neon(process.env.DATABASE_URL);

// 1. Fetch settings
const rows = await sql`SELECT key, value FROM settings WHERE key LIKE 'email%'`;
const S = Object.fromEntries(rows.map((r) => [r.key, r.value]));
console.log("\n── Email settings ─────────────────────────────────");
for (const [k, v] of Object.entries(S)) {
  console.log(`  ${k}: ${k.includes("password") ? `SET (${v.length}c)` : v}`);
}

// 2. Fetch pending alerts
const pending = await sql`
  SELECT id, type, status, recipient_email, recipient_name, payload
  FROM alerts WHERE status = 'pending' ORDER BY created_at LIMIT 5
`;
console.log(`\n── Pending alerts: ${pending.length} ───────────────────────────`);
for (const a of pending) {
  console.log(`  [${a.id.slice(0,8)}] ${a.type} → ${a.recipient_email}`);
}

if (pending.length === 0) {
  console.log("  No pending alerts. Nothing to process."); process.exit(0);
}

// 3. Test SMTP connection
console.log("\n── Testing SMTP connection ─────────────────────────");
const host = S.email_smtp_host || "smtp.gmail.com";
const port = parseInt(S.email_smtp_port || "587", 10);
const user = S.email_smtp_username || S.email_from_address || "";
const pass = S.email_app_password || "";

console.log(`  host: ${host}:${port}  user: ${user}  pass: SET (${pass.length}c)`);

let transport;
try {
  transport = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: { minVersion: "TLSv1.2" },
  });
  await transport.verify();
  console.log("  ✓ SMTP connection verified");
} catch (err) {
  console.error("  ✗ SMTP FAILED:", err.message);
  process.exit(1);
}

// 4. Process first pending welcome alert (send test email)
const first = pending.find((a) => a.type === "welcome" && a.recipient_email);
if (!first) {
  console.log("\nNo welcome alert with email to test. Skipping send test.");
  process.exit(0);
}

console.log(`\n── Sending test email to ${first.recipient_email} ─────`);
const p = first.payload;
try {
  const info = await transport.sendMail({
    from: `"${S.email_from_name || "Gorosay"}" <${S.email_from_address}>`,
    to: first.recipient_email,
    subject: `[TEST] Welcome to Gorosay — ${first.recipient_name}`,
    html: `<p>Hi ${first.recipient_name}, this is a test send from the diagnostic script.</p><p>Customer: ${p.customer_number}</p>`,
    text: `Hi ${first.recipient_name}, test email. Customer: ${p.customer_number}`,
  });
  console.log("  ✓ Email sent! MessageId:", info.messageId);

  // Mark as sent in DB
  await sql`UPDATE alerts SET status = 'sent', processed_at = NOW() WHERE id = ${first.id}`;
  console.log("  ✓ Alert marked as sent in DB");
} catch (err) {
  console.error("  ✗ Send FAILED:", err.message);
  await sql`UPDATE alerts SET status = 'failed', processed_at = NOW(), error_message = ${err.message} WHERE id = ${first.id}`;
}

process.exit(0);
