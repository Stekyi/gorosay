import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { drivers, customers, serviceCharges } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nextDriverNumber } from "@/lib/utils/id-generator";
import { getPrices } from "@/lib/utils/settings";
import { driverFolderKey } from "@/lib/storage/r2";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string().uuid(),
  fullName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; tenantId?: string | null; tenantCode?: string | null };
  if (!user.tenantId || !user.tenantCode) {
    return NextResponse.json({ error: "No tenant assigned to your account" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Verify customer belongs to this tenant
  const [customer] = await db.select({ tenantId: customers.tenantId }).from(customers)
    .where(eq(customers.id, data.customerId)).limit(1);
  if (!customer || (user.role !== "ADMIN" && customer.tenantId !== user.tenantId)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const driverNumber = await nextDriverNumber(user.tenantId, user.tenantCode);
  const prices = await getPrices();

  const [driver] = await db
    .insert(drivers)
    .values({
      driverNumber,
      customerId: data.customerId,
      fullName: data.fullName,
      storageFolder: driverFolderKey(data.customerId, "PLACEHOLDER"),
    })
    .returning();

  const folder = driverFolderKey(data.customerId, driver.id);
  await db.update(drivers).set({ storageFolder: folder }).where(eq(drivers.id, driver.id));

  await db.insert(serviceCharges).values({
    customerId: data.customerId,
    driverId: driver.id,
    description: `Driver license management — ${driver.driverNumber} (${data.fullName})`,
    amountGhs: String(prices.newDriver),
  });

  return NextResponse.json({ ...driver, storageFolder: folder }, { status: 201 });
}
