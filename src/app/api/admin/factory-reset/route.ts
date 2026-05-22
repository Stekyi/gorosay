import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  customers, vehicles, drivers, documents,
  serviceCharges, paymentRecords, alerts,
  notificationLogs, emailLogs, idCounters,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tenantId } = await req.json().catch(() => ({}));

  if (tenantId) {
    // Scoped reset: only delete this tenant's data
    const tenantCustomers = await db.select({ id: customers.id }).from(customers).where(eq(customers.tenantId, tenantId));
    const customerIds = tenantCustomers.map((c) => c.id);

    if (customerIds.length > 0) {
      const tenantVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(inArray(vehicles.customerId, customerIds));
      const tenantDrivers = await db.select({ id: drivers.id }).from(drivers).where(inArray(drivers.customerId, customerIds));
      const entityIds = [...tenantVehicles.map((v) => v.id), ...tenantDrivers.map((d) => d.id)];

      if (entityIds.length > 0) {
        await db.delete(notificationLogs).where(inArray(notificationLogs.documentId,
          (await db.select({ id: documents.id }).from(documents).where(
            inArray(documents.vehicleId, tenantVehicles.map((v) => v.id))
          )).map((d) => d.id)
        ));
        await db.delete(documents).where(inArray(documents.vehicleId, tenantVehicles.map((v) => v.id)));
        await db.delete(documents).where(inArray(documents.driverId, tenantDrivers.map((d) => d.id)));
      }
      await db.delete(serviceCharges).where(inArray(serviceCharges.customerId, customerIds));
      await db.delete(paymentRecords).where(inArray(paymentRecords.customerId, customerIds));
      await db.delete(vehicles).where(inArray(vehicles.customerId, customerIds));
      await db.delete(drivers).where(inArray(drivers.customerId, customerIds));
      await db.delete(customers).where(inArray(customers.id, customerIds));
    }
    await db.delete(alerts).where(eq(alerts.tenantId, tenantId));
    await db.delete(idCounters).where(eq(idCounters.tenantId, tenantId));
  } else {
    // Full reset (all tenants)
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
  }

  return NextResponse.json({ ok: true });
}
