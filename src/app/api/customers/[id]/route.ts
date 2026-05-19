import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  customers, cities, suburbs, vehicles, drivers,
  documents, documentTypes, serviceCharges, paymentRecords
} from "@/lib/db/schema";
import { eq, and, sum, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [customer] = await db
    .select({
      id: customers.id,
      customerNumber: customers.customerNumber,
      customerType: customers.customerType,
      name: customers.name,
      tel: customers.tel,
      email: customers.email,
      location: customers.location,
      cityId: customers.cityId,
      suburbId: customers.suburbId,
      cityName: cities.name,
      suburbName: suburbs.name,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(cities, eq(customers.cityId, cities.id))
    .leftJoin(suburbs, eq(customers.suburbId, suburbs.id))
    .where(eq(customers.id, id))
    .limit(1);

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [customerVehicles, customerDrivers, chargesSum, paymentsSum] =
    await Promise.all([
      db
        .select({
          id: vehicles.id,
          vehicleNumber: vehicles.vehicleNumber,
          registrationNumber: vehicles.registrationNumber,
          make: vehicles.make,
          model: vehicles.model,
          year: vehicles.year,
          vehicleType: vehicles.vehicleType,
          color: vehicles.color,
          isActive: vehicles.isActive,
        })
        .from(vehicles)
        .where(and(eq(vehicles.customerId, id), eq(vehicles.isActive, true))),

      db
        .select({
          id: drivers.id,
          driverNumber: drivers.driverNumber,
          fullName: drivers.fullName,
          tel: drivers.tel,
          dateOfBirth: drivers.dateOfBirth,
          isActive: drivers.isActive,
        })
        .from(drivers)
        .where(and(eq(drivers.customerId, id), eq(drivers.isActive, true))),

      db
        .select({ total: sum(serviceCharges.amountGhs) })
        .from(serviceCharges)
        .where(eq(serviceCharges.customerId, id)),

      db
        .select({ total: sum(paymentRecords.amountGhs) })
        .from(paymentRecords)
        .where(eq(paymentRecords.customerId, id)),
    ]);

  const totalCharged = parseFloat(chargesSum[0]?.total ?? "0");
  const totalPaid = parseFloat(paymentsSum[0]?.total ?? "0");

  return NextResponse.json({
    customer,
    vehicles: customerVehicles,
    drivers: customerDrivers,
    balance: { totalCharged, totalPaid, outstanding: totalCharged - totalPaid },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(customers)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();

  return NextResponse.json(updated);
}
