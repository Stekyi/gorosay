import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { processAlerts } from "@/lib/notifications/alerts";

export async function POST() {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const failed = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(eq(alerts.status, "failed"));

  if (failed.length === 0) {
    return NextResponse.json({ retried: 0 });
  }

  await db
    .update(alerts)
    .set({ status: "pending", processedAt: null, errorMessage: null })
    .where(inArray(alerts.id, failed.map((r) => r.id)));

  await processAlerts();

  return NextResponse.json({ retried: failed.length });
}
