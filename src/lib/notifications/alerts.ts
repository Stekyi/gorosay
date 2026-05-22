import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getPublicDownloadUrl } from "@/lib/storage/r2";
import { sendWelcomeEmail, sendDocumentUploadEmail } from "./email";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";

export async function processAlerts(): Promise<void> {
  let emailEnabled: string | null;
  try {
    emailEnabled = await getSetting(SETTING_KEYS.EMAIL_ENABLED);
  } catch (err) {
    console.error("[processAlerts] getSetting failed:", err);
    throw err;
  }
  if (emailEnabled === "false") return;

  let pending: (typeof alerts.$inferSelect)[];
  try {
    pending = await db
      .select()
      .from(alerts)
      .where(eq(alerts.status, "pending"))
      .orderBy(asc(alerts.createdAt))
      .limit(20);
  } catch (err) {
    console.error("[processAlerts] DB query failed:", err);
    throw err;
  }

  if (pending.length === 0) return;

  await Promise.allSettled(pending.map(processOne));
}

async function processOne(alert: typeof alerts.$inferSelect): Promise<void> {
  if (alert.type === "welcome") await processWelcome(alert);
  else if (alert.type === "doc_upload") await processDocUpload(alert);
}

async function processWelcome(alert: typeof alerts.$inferSelect): Promise<void> {
  if (!alert.recipientEmail) {
    await db.update(alerts).set({ status: "skipped", processedAt: new Date() }).where(eq(alerts.id, alert.id));
    return;
  }
  const p = alert.payload as { name?: string; customer_number?: string };
  try {
    await sendWelcomeEmail({
      name: p.name ?? alert.recipientName ?? "",
      email: alert.recipientEmail,
      customerNumber: p.customer_number ?? "",
    });
    await db.update(alerts).set({ status: "sent", processedAt: new Date() }).where(eq(alerts.id, alert.id));
  } catch (err) {
    await db.update(alerts).set({
      status: "failed",
      processedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : String(err),
    }).where(eq(alerts.id, alert.id));
  }
}

async function processDocUpload(alert: typeof alerts.$inferSelect): Promise<void> {
  if (!alert.recipientEmail) {
    await db.update(alerts).set({ status: "skipped", processedAt: new Date() }).where(eq(alerts.id, alert.id));
    return;
  }
  const p = alert.payload as {
    doc_type_name?: string;
    entity_ref?: string;
    file_key?: string;
    issue_date?: string | null;
    expiry_date?: string | null;
  };
  try {
    const downloadUrl = await getPublicDownloadUrl(p.file_key!);
    await sendDocumentUploadEmail({
      customerEmail: alert.recipientEmail,
      customerName: alert.recipientName ?? "Customer",
      documentType: p.doc_type_name ?? "Document",
      entityRef: p.entity_ref ?? "",
      issueDate: p.issue_date ?? null,
      expiryDate: p.expiry_date ?? null,
      downloadUrl,
    });
    await db.update(alerts).set({ status: "sent", processedAt: new Date() }).where(eq(alerts.id, alert.id));
  } catch (err) {
    await db.update(alerts).set({
      status: "failed",
      processedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : String(err),
    }).where(eq(alerts.id, alert.id));
  }
}
