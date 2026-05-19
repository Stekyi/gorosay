import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { customers, vehicles, drivers, documents, documentTypes } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { addDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const in30Days = addDays(today, 30);
  const todayStr = format(today, "yyyy-MM-dd");
  const in30DaysStr = format(in30Days, "yyyy-MM-dd");

  const [
    customerCount,
    vehicleCount,
    driverCount,
    docCount,
    expiringDocs,
  ] = await Promise.all([
    db.select({ count: count() }).from(customers).where(eq(customers.isActive, true)),
    db.select({ count: count() }).from(vehicles).where(eq(vehicles.isActive, true)),
    db.select({ count: count() }).from(drivers).where(eq(drivers.isActive, true)),
    db.select({ count: count() }).from(documents).where(and(eq(documents.status, "ACTIVE"), eq(documents.version, 1))),
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
      .where(
        and(
          eq(documents.status, "ACTIVE"),
          eq(documents.version, 1),
          gte(documents.expiryDate, todayStr),
          lte(documents.expiryDate, in30DaysStr)
        )
      )
      .orderBy(documents.expiryDate)
      .limit(50),
  ]);

  return NextResponse.json({
    stats: {
      customers: customerCount[0].count,
      vehicles: vehicleCount[0].count,
      drivers: driverCount[0].count,
      activeDocuments: docCount[0].count,
      expiringIn30Days: expiringDocs.length,
    },
    expiringDocs,
  });
}
