import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { drivers, serviceCharges } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nextDriverNumber } from "@/lib/utils/id-generator";
import { getPrices } from "@/lib/utils/settings";
import { driverFolderKey } from "@/lib/storage/r2";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string().uuid(),
  fullName: z.string().min(1),
  tel: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
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
  const driverNumber = await nextDriverNumber();
  const prices = await getPrices();

  const [driver] = await db
    .insert(drivers)
    .values({
      driverNumber,
      customerId: data.customerId,
      fullName: data.fullName,
      tel: data.tel ?? null,
      email: data.email || null,
      dateOfBirth: data.dateOfBirth ?? null,
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
