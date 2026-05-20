import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { alerts, notificationLogs, documents, documentTypes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const [transactional, cronAlerts] = await Promise.all([
    db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(limit),
    db
      .select({
        id: notificationLogs.id,
        sentAt: notificationLogs.sentAt,
        channel: notificationLogs.channel,
        recipient: notificationLogs.recipient,
        daysBefore: notificationLogs.daysBefore,
        targetDate: notificationLogs.targetDate,
        status: notificationLogs.status,
        errorMessage: notificationLogs.errorMessage,
        documentTypeName: documentTypes.name,
        entityRef: documents.entityRef,
      })
      .from(notificationLogs)
      .innerJoin(documents, eq(notificationLogs.documentId, documents.id))
      .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
      .orderBy(desc(notificationLogs.sentAt))
      .limit(limit),
  ]);

  type LogEntry = {
    id: string;
    sentAt: string;
    type: string;
    channel: "email" | "sms";
    recipient: string;
    subject: string;
    status: string;
    errorMessage: string | null;
  };

  const rows: LogEntry[] = [
    ...transactional.map((r) => ({
      id: r.id,
      sentAt: r.createdAt.toISOString(),
      type: r.type,
      channel: "email" as const,
      recipient: r.recipientEmail ?? "—",
      subject:
        r.type === "welcome"
          ? `Welcome to Gorosay — ${r.recipientName ?? ""}`
          : (() => {
              const p = r.payload as { docTypeName?: string; entityRef?: string };
              return `${p.docTypeName ?? "Document"} uploaded for ${p.entityRef ?? ""}`;
            })(),
      status: r.status,
      errorMessage: r.errorMessage,
    })),
    ...cronAlerts.map((r) => ({
      id: r.id,
      sentAt: r.sentAt.toISOString(),
      type: r.channel === "sms" ? "sms_alert" : "expiry_alert",
      channel: r.channel as "email" | "sms",
      recipient: r.recipient,
      subject: `${r.documentTypeName ?? "Document"} — ${r.entityRef ?? ""} (${r.daysBefore}d before)`,
      status: r.status,
      errorMessage: r.errorMessage,
    })),
  ];

  rows.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  return NextResponse.json(rows.slice(0, limit));
}
