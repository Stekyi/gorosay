import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { vehicles, serviceCharges } from "@/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import { nextVehicleNumber } from "@/lib/utils/id-generator";
import { getPrices } from "@/lib/utils/settings";
import { vehicleFolderKey } from "@/lib/storage/r2";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string().uuid(),
  registrationNumber: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  vehicleType: z.string().optional(),
  color: z.string().optional(),
  chassisNumber: z.string().optional(),
  engineNumber: z.string().optional(),
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

  if (data.registrationNumber) {
    const [dup] = await db
      .select({ vehicleNumber: vehicles.vehicleNumber })
      .from(vehicles)
      .where(ilike(vehicles.registrationNumber, data.registrationNumber.trim()))
      .limit(1);
    if (dup) {
      return NextResponse.json(
        { error: `Registration number already registered under vehicle ${dup.vehicleNumber}` },
        { status: 409 }
      );
    }
  }

  const vehicleNumber = await nextVehicleNumber();
  const prices = await getPrices();

  const [vehicle] = await db
    .insert(vehicles)
    .values({
      vehicleNumber,
      customerId: data.customerId,
      registrationNumber: data.registrationNumber ?? null,
      make: data.make ?? null,
      model: data.model ?? null,
      year: data.year ?? null,
      vehicleType: data.vehicleType ?? null,
      color: data.color ?? null,
      chassisNumber: data.chassisNumber ?? null,
      engineNumber: data.engineNumber ?? null,
      storageFolder: vehicleFolderKey(data.customerId, "PLACEHOLDER"),
    })
    .returning();

  // Update storage folder with real vehicle ID
  const folder = vehicleFolderKey(data.customerId, vehicle.id);
  await db.update(vehicles).set({ storageFolder: folder }).where(eq(vehicles.id, vehicle.id));

  // Auto-record the service charge
  await db.insert(serviceCharges).values({
    customerId: data.customerId,
    vehicleId: vehicle.id,
    description: `New vehicle package — ${vehicle.vehicleNumber}`,
    amountGhs: String(prices.newVehicle),
  });

  return NextResponse.json({ ...vehicle, storageFolder: folder }, { status: 201 });
}
