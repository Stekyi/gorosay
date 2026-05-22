import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { processAlerts } from "@/lib/notifications/alerts";

export async function POST() {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Collect both failed AND stuck-pending alerts
  const unprocessed = await db
    .select({ id: alerts.id, status: alerts.status })
    .from(alerts)
    .where(or(eq(alerts.status, "failed"), eq(alerts.status, "pending")));

  if (unprocessed.length === 0) {
    return NextResponse.json({ retried: 0 });
  }

  // Reset all to pending so processAlerts picks them up
  await db
    .update(alerts)
    .set({ status: "pending", processedAt: null, errorMessage: null })
    .where(inArray(alerts.id, unprocessed.map((r) => r.id)));

  await processAlerts();

  return NextResponse.json({ retried: unprocessed.length });
}
