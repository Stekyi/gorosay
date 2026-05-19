import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, documentTypes, vehicles, drivers, customers, cities } from "@/lib/db/schema";
import { eq, and, gte, lte, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const customerType = searchParams.get("customerType") ?? "";
  const customerSearch = searchParams.get("customer") ?? "";
  const cityId = searchParams.get("cityId") ?? "";

  const conditions = [
    eq(documents.status, "ACTIVE"),
    eq(documents.version, 1),
  ];
  if (from) conditions.push(gte(documents.expiryDate, from));
  if (to) conditions.push(lte(documents.expiryDate, to));

  const rows = await db
    .select({
      id: documents.id,
      expiryDate: documents.expiryDate,
      renewalDates: documents.renewalDates,
      entityRef: documents.entityRef,
      documentTypeName: documentTypes.name,
      customerName: customers.name,
      customerTel: customers.tel,
      customerType: customers.customerType,
      cityId: customers.cityId,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .leftJoin(vehicles, eq(documents.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(documents.driverId, drivers.id))
    .innerJoin(
      customers,
      or(
        eq(vehicles.customerId, customers.id),
        eq(drivers.customerId, customers.id)
      )
    )
    .where(and(...conditions));

  // Client-side filters on result (search is fuzzy by name/tel)
  let filtered = rows;
  if (customerType === "INDIVIDUAL" || customerType === "AGENCY") {
    filtered = filtered.filter((r) => r.customerType === customerType);
  }
  if (customerSearch) {
    const q = customerSearch.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.customerTel.includes(q)
    );
  }
  if (cityId) {
    filtered = filtered.filter((r) => r.cityId === cityId);
  }

  // Expand renewal dates into separate events
  const events = filtered.flatMap((doc) => {
    const base = {
      documentId: doc.id,
      documentType: doc.documentTypeName,
      entityRef: doc.entityRef,
      customerName: doc.customerName,
    };
    const items = [];
    if (doc.expiryDate) {
      items.push({ ...base, date: doc.expiryDate, kind: "expiry" as const });
    }
    for (const rd of (doc.renewalDates as string[]) ?? []) {
      items.push({ ...base, date: rd, kind: "renewal" as const });
    }
    return items;
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json(events);
}
