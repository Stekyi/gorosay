import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { customers, vehicles, drivers, documents, documentTypes } from "@/lib/db/schema";
import { eq, and, gte, lte, count, inArray } from "drizzle-orm";
import { addDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; tenantId?: string | null };
  const today = new Date();
  const in30Days = addDays(today, 30);
  const todayStr = format(today, "yyyy-MM-dd");
  const in30DaysStr = format(in30Days, "yyyy-MM-dd");

  // For clerks, restrict to their tenant's customers
  const customerFilter = user.role !== "ADMIN" && user.tenantId
    ? and(eq(customers.isActive, true), eq(customers.tenantId, user.tenantId))
    : eq(customers.isActive, true);

  const tenantCustomerIds = user.role !== "ADMIN" && user.tenantId
    ? (await db.select({ id: customers.id }).from(customers)
        .where(and(eq(customers.isActive, true), eq(customers.tenantId, user.tenantId))))
        .map((r) => r.id)
    : null;

  const vehicleFilter = tenantCustomerIds
    ? and(eq(vehicles.isActive, true), inArray(vehicles.customerId, tenantCustomerIds.length ? tenantCustomerIds : ["__none__"]))
    : eq(vehicles.isActive, true);

  const driverFilter = tenantCustomerIds
    ? and(eq(drivers.isActive, true), inArray(drivers.customerId, tenantCustomerIds.length ? tenantCustomerIds : ["__none__"]))
    : eq(drivers.isActive, true);

  const tenantVehicleIds = tenantCustomerIds
    ? (await db.select({ id: vehicles.id }).from(vehicles).where(vehicleFilter)).map((r) => r.id)
    : null;
  const tenantDriverIds = tenantCustomerIds
    ? (await db.select({ id: drivers.id }).from(drivers).where(driverFilter)).map((r) => r.id)
    : null;

  const docBaseFilter = and(eq(documents.status, "ACTIVE"), eq(documents.version, 1));
  const docTenantFilter = tenantVehicleIds || tenantDriverIds
    ? and(
        docBaseFilter,
        // vehicle or driver must belong to tenant
        ...(tenantVehicleIds || tenantDriverIds ? [] : [])
      )
    : docBaseFilter;

  // Simpler approach: fetch docs and filter by tenant ownership via subquery
  const allDocConditions = [eq(documents.status, "ACTIVE"), eq(documents.version, 1)];
  if (tenantVehicleIds !== null || tenantDriverIds !== null) {
    // We'll filter in-memory for dashboard — it's a small result set
  }

  const [customerCount, vehicleCount, driverCount, docCount, expiringDocs] = await Promise.all([
    db.select({ count: count() }).from(customers).where(customerFilter),
    db.select({ count: count() }).from(vehicles).where(vehicleFilter),
    db.select({ count: count() }).from(drivers).where(driverFilter),
    db.select({ count: count() }).from(documents).where(docBaseFilter),
    db
      .select({
        id: documents.id,
        expiryDate: documents.expiryDate,
        entityRef: documents.entityRef,
        documentTypeName: documentTypes.name,
        vehicleId: documents.vehicleId,
        driverId: documents.driverId,
      })
      .from(documents)
      .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
      .where(and(eq(documents.status, "ACTIVE"), eq(documents.version, 1), gte(documents.expiryDate, todayStr), lte(documents.expiryDate, in30DaysStr)))
      .orderBy(documents.expiryDate)
      .limit(200),
  ]);

  // Filter expiring docs to tenant scope
  const filteredExpiring = tenantVehicleIds !== null || tenantDriverIds !== null
    ? expiringDocs.filter((d) =>
        (d.vehicleId && tenantVehicleIds?.includes(d.vehicleId)) ||
        (d.driverId && tenantDriverIds?.includes(d.driverId))
      )
    : expiringDocs;

  return NextResponse.json({
    stats: {
      customers: customerCount[0].count,
      vehicles: vehicleCount[0].count,
      drivers: driverCount[0].count,
      activeDocuments: docCount[0].count,
      expiringIn30Days: filteredExpiring.length,
    },
    expiringDocs: filteredExpiring.slice(0, 50),
  });
}
