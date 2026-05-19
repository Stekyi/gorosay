import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, documentTypes, vehicles, drivers, customers } from "@/lib/db/schema";
import { eq, and, or, ilike, gte, lte, inArray, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const tel = searchParams.get("tel") ?? "";
  const dateType = searchParams.get("dateType") ?? "expiry";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const docTypesParam = searchParams.get("docTypes") ?? "";
  const vehicleTypeFilter = searchParams.get("vehicleType") ?? "";
  const makeFilter = searchParams.get("make") ?? "";
  const yearFilter = searchParams.get("year") ?? "";
  const placeOfIssueFilter = searchParams.get("placeOfIssue") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const entityTypeFilter = searchParams.get("entityType") ?? "all";
  const customerTypeFilter = searchParams.get("customerType") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10));

  const docTypeIds = docTypesParam ? docTypesParam.split(",").filter(Boolean) : [];

  function buildDocConds() {
    const conds = [eq(documents.version, 1)];
    if (statusFilter === "ACTIVE") conds.push(eq(documents.status, "ACTIVE"));
    if (statusFilter === "EXPIRED") conds.push(eq(documents.status, "EXPIRED"));
    if (docTypeIds.length > 0) conds.push(inArray(documents.documentTypeId, docTypeIds));
    if (placeOfIssueFilter) conds.push(ilike(documents.placeOfIssue, `%${placeOfIssueFilter}%`));

    if (dateFrom || dateTo) {
      if (dateType === "expiry") {
        if (dateFrom) conds.push(gte(documents.expiryDate, dateFrom));
        if (dateTo) conds.push(lte(documents.expiryDate, dateTo));
      } else if (dateType === "issue") {
        if (dateFrom) conds.push(gte(documents.issueDate, dateFrom));
        if (dateTo) conds.push(lte(documents.issueDate, dateTo));
      } else if (dateType === "renewal") {
        const parts: ReturnType<typeof sql>[] = [];
        if (dateFrom) parts.push(sql`rd.val::date >= ${dateFrom}::date`);
        if (dateTo) parts.push(sql`rd.val::date <= ${dateTo}::date`);
        if (parts.length > 0) {
          const innerWhere = parts.reduce((a, b) => sql`${a} AND ${b}`);
          conds.push(
            sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${documents.renewalDates}) AS rd(val) WHERE ${innerWhere})`
          );
        }
      }
    }
    return conds;
  }

  function buildCustomerConds() {
    const conds: ReturnType<typeof and>[] = [];
    if (customerTypeFilter === "INDIVIDUAL") conds.push(eq(customers.customerType, "INDIVIDUAL"));
    if (customerTypeFilter === "AGENCY") conds.push(eq(customers.customerType, "AGENCY"));
    if (q) conds.push(or(ilike(customers.name, `%${q}%`), ilike(customers.customerNumber, `%${q}%`))!);
    return conds;
  }

  const vRows =
    entityTypeFilter !== "driver"
      ? await db
          .select({
            docId: documents.id,
            docTypeName: documentTypes.name,
            documentNumber: documents.documentNumber,
            placeOfIssue: documents.placeOfIssue,
            issueDate: documents.issueDate,
            expiryDate: documents.expiryDate,
            renewalDates: documents.renewalDates,
            fileKey: documents.fileKey,
            fileName: documents.fileName,
            status: documents.status,
            entityRef: documents.entityRef,
            vehicleType: vehicles.vehicleType,
            make: vehicles.make,
            model: vehicles.model,
            year: vehicles.year,
            customerId: customers.id,
            customerName: customers.name,
            customerNumber: customers.customerNumber,
            customerType: customers.customerType,
            customerTel: customers.tel,
          })
          .from(documents)
          .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
          .innerJoin(vehicles, eq(documents.vehicleId, vehicles.id))
          .innerJoin(customers, eq(vehicles.customerId, customers.id))
          .where(
            and(
              ...buildDocConds(),
              ...buildCustomerConds(),
              tel ? ilike(customers.tel, `%${tel}%`) : undefined,
              vehicleTypeFilter ? ilike(vehicles.vehicleType, `%${vehicleTypeFilter}%`) : undefined,
              makeFilter ? ilike(vehicles.make, `%${makeFilter}%`) : undefined,
              yearFilter ? eq(vehicles.year, parseInt(yearFilter, 10)) : undefined,
              eq(vehicles.isActive, true)
            )
          )
      : [];

  const dRows =
    entityTypeFilter !== "vehicle"
      ? await db
          .select({
            docId: documents.id,
            docTypeName: documentTypes.name,
            documentNumber: documents.documentNumber,
            placeOfIssue: documents.placeOfIssue,
            issueDate: documents.issueDate,
            expiryDate: documents.expiryDate,
            renewalDates: documents.renewalDates,
            fileKey: documents.fileKey,
            fileName: documents.fileName,
            status: documents.status,
            entityRef: documents.entityRef,
            customerId: customers.id,
            customerName: customers.name,
            customerNumber: customers.customerNumber,
            customerType: customers.customerType,
            customerTel: customers.tel,
          })
          .from(documents)
          .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
          .innerJoin(drivers, eq(documents.driverId, drivers.id))
          .innerJoin(customers, eq(drivers.customerId, customers.id))
          .where(
            and(
              ...buildDocConds(),
              ...buildCustomerConds(),
              tel ? or(ilike(customers.tel, `%${tel}%`), ilike(drivers.tel, `%${tel}%`)) : undefined,
              eq(drivers.isActive, true)
            )
          )
      : [];

  const combined = [
    ...vRows.map((r) => ({ ...r, entityType: "vehicle" as const, vehicleType: r.vehicleType, make: r.make, model: r.model, year: r.year })),
    ...dRows.map((r) => ({ ...r, entityType: "driver" as const, vehicleType: null as string | null, make: null as string | null, model: null as string | null, year: null as number | null })),
  ].sort((a, b) => (a.expiryDate ?? "9999") < (b.expiryDate ?? "9999") ? -1 : 1);

  const total = combined.length;
  const data = combined.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ data, total, page, limit });
}
