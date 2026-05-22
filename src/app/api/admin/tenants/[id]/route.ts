import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenants, staffUsers, customers, serviceCharges, paymentRecords } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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
