import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { paymentRecords, serviceCharges, customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string().uuid(),
  amountGhs: z.number().positive(),
  paidAt: z.string().min(1),
  method: z.enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const [record] = await db
    .insert(paymentRecords)
    .values({
      customerId: data.customerId,
      amountGhs: String(data.amountGhs),
      paidAt: data.paidAt,
      method: data.method,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      recordedBy: session.user.id,
    })
    .returning();

  return NextResponse.json(record, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  // Verify tenant ownership
  const user = session.user as { role?: string; tenantId?: string | null };
  if (user.role !== "ADMIN" && user.tenantId) {
    const [c] = await db.select({ tenantId: customers.tenantId }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!c || c.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const [payments, charges] = await Promise.all([
    db.select().from(paymentRecords).where(eq(paymentRecords.customerId, customerId)).orderBy(paymentRecords.paidAt),
    db.select().from(serviceCharges).where(eq(serviceCharges.customerId, customerId)).orderBy(serviceCharges.chargedAt),
  ]);

  const totalCharged = charges.reduce((acc, c) => acc + parseFloat(c.amountGhs), 0);
  const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amountGhs), 0);

  return NextResponse.json({
    payments,
    charges,
    summary: { totalCharged, totalPaid, outstanding: totalCharged - totalPaid },
  });
}
