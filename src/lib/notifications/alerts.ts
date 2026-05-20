import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getPublicDownloadUrl } from "@/lib/storage/r2";
import { sendWelcomeEmail, sendDocumentUploadEmail } from "./email";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";

export async function processAlerts(): Promise<void> {
  const emailEnabled = await getSetting(SETTING_KEYS.EMAIL_ENABLED);
  if (emailEnabled === "false") return;

  const pending = await db
    .select()
    .from(alerts)
    .where(eq(alerts.status, "pending"))
    .orderBy(asc(alerts.createdAt))
    .limit(20);

  await Promise.all(pending.map(processOne));
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
  const p = alert.payload as { name?: string; customerNumber?: string };
  try {
    await sendWelcomeEmail({
      name: p.name ?? alert.recipientName ?? "",
      email: alert.recipientEmail,
      customerNumber: p.customerNumber ?? "",
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
    docTypeName?: string;
    entityRef?: string;
    fileKey?: string;
    issueDate?: string | null;
    expiryDate?: string | null;
  };
  try {
    const downloadUrl = await getPublicDownloadUrl(p.fileKey!);
    await sendDocumentUploadEmail({
      customerEmail: alert.recipientEmail,
      customerName: alert.recipientName ?? "Customer",
      documentType: p.docTypeName ?? "Document",
      entityRef: p.entityRef ?? "",
      issueDate: p.issueDate ?? null,
      expiryDate: p.expiryDate ?? null,
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
