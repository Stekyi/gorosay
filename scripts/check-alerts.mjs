import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const sql = neon(process.env.DATABASE_URL);

// Check triggers
const triggers = await sql`
  SELECT trigger_name, event_object_table, action_timing, event_manipulation
  FROM information_schema.triggers
  WHERE trigger_name IN ('trg_alert_customer_insert', 'trg_alert_document_insert')
  ORDER BY trigger_name
`;
console.log("\n── Triggers ──────────────────────────────────────────");
for (const t of triggers) {
  console.log(`  ✓ ${t.trigger_name} on ${t.event_object_table}`);
}

// Check recent alerts
const recentAlerts = await sql`
  SELECT id, type, status, recipient_email, created_at, processed_at, error_message
  FROM alerts ORDER BY created_at DESC LIMIT 10
`;
console.log("\n── Recent alerts (last 10) ────────────────────────────");
if (recentAlerts.length === 0) {
  console.log("  ⛔ NO ALERTS — triggers are not firing");
} else {
  for (const a of recentAlerts) {
    const age = Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000);
    const proc = a.processed_at ? "processed" : "unprocessed";
    console.log(`  [${a.status.padEnd(7)}] ${a.type.padEnd(12)} to ${(a.recipient_email ?? "(no email)").padEnd(30)} ${age}m ago (${proc})${a.error_message ? "\n    ERR: " + a.error_message : ""}`);
  }
}

// Check all email settings
const allSettings = await sql`SELECT key, value FROM settings ORDER BY key`;
console.log("\n── All settings ───────────────────────────────────────");
for (const s of allSettings) {
  const val = s.key.includes("password") || s.key.includes("api_key")
    ? (s.value ? `SET (${s.value.length} chars)` : "⛔ EMPTY")
    : s.value;
  console.log(`  ${s.key.padEnd(30)} = ${val}`);
}

process.exit(0);
