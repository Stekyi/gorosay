import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenants, staffUsers, customers, serviceCharges, paymentRecords, vehicles, drivers, documents } from "@/lib/db/schema";
import { eq, sql, inArray, or } from "drizzle-orm";
import { deleteFile } from "@/lib/storage/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const users = await db
    .select({
      id: staffUsers.id,
      name: staffUsers.name,
      email: staffUsers.email,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      createdAt: staffUsers.createdAt,
    })
    .from(staffUsers)
    .where(eq(staffUsers.tenantId, id))
    .orderBy(staffUsers.createdAt);

  const [chargeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${serviceCharges.amountGhs}), 0)` })
    .from(serviceCharges)
    .innerJoin(customers, eq(serviceCharges.customerId, customers.id))
    .where(eq(customers.tenantId, id));

  const [paymentRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${paymentRecords.amountGhs}), 0)` })
    .from(paymentRecords)
    .innerJoin(customers, eq(paymentRecords.customerId, customers.id))
    .where(eq(customers.tenantId, id));

  const totalCharged = parseFloat(chargeRow?.total ?? "0");
  const totalPaid = parseFloat(paymentRow?.total ?? "0");

  return NextResponse.json({
    tenant,
    users,
    revenue: { totalCharged, totalPaid, outstanding: totalCharged - totalPaid },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tenantId } = await params;

  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 1. Collect IDs for cascading manual deletions
  const customerRows = await db.select({ id: customers.id }).from(customers).where(eq(customers.tenantId, tenantId));
  const customerIds = customerRows.map((c) => c.id);

  if (customerIds.length > 0) {
    const vehicleRows = await db.select({ id: vehicles.id }).from(vehicles).where(inArray(vehicles.customerId, customerIds));
    const driverRows = await db.select({ id: drivers.id }).from(drivers).where(inArray(drivers.customerId, customerIds));
    const vehicleIds = vehicleRows.map((v) => v.id);
    const driverIds = driverRows.map((d) => d.id);

    // 2. Delete R2 files for all documents
    const docConditions = [];
    if (vehicleIds.length > 0) docConditions.push(inArray(documents.vehicleId, vehicleIds));
    if (driverIds.length > 0) docConditions.push(inArray(documents.driverId, driverIds));
    if (docConditions.length > 0) {
      const docRows = await db.select({ fileKey: documents.fileKey }).from(documents).where(or(...docConditions));
      await Promise.allSettled(docRows.map((d) => deleteFile(d.fileKey)));

      // 3. Delete documents (notification_logs cascade automatically)
      await db.delete(documents).where(or(...docConditions));
    }

    // 4. Delete service_charges and payment_records
    await db.delete(serviceCharges).where(inArray(serviceCharges.customerId, customerIds));
    await db.delete(paymentRecords).where(inArray(paymentRecords.customerId, customerIds));

    // 5. Delete vehicles and drivers
    if (vehicleIds.length > 0) await db.delete(vehicles).where(inArray(vehicles.id, vehicleIds));
    if (driverIds.length > 0) await db.delete(drivers).where(inArray(drivers.id, driverIds));

    // 6. Delete customers
    await db.delete(customers).where(inArray(customers.id, customerIds));
  }

  // 7. Delete tenant — cascades staffUsers, alerts, idCounters
  await db.delete(tenants).where(eq(tenants.id, tenantId));

  return NextResponse.json({ ok: true });
}
