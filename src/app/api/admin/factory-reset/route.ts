import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  customers, vehicles, drivers, documents,
  serviceCharges, paymentRecords, alerts,
  notificationLogs, emailLogs, idCounters,
} from "@/lib/db/schema";

export async function POST() {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete in dependency order (children before parents)
  await db.delete(notificationLogs);
  await db.delete(emailLogs);
  await db.delete(alerts);
  await db.delete(documents);
  await db.delete(serviceCharges);
  await db.delete(paymentRecords);
  await db.delete(vehicles);
  await db.delete(drivers);
  await db.delete(customers);
  await db.delete(idCounters);

  return NextResponse.json({ ok: true });
}
