import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { customers, cities, suburbs } from "@/lib/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { nextCustomerNumber } from "@/lib/utils/id-generator";
import { processAlerts } from "@/lib/notifications/alerts";
import { z } from "zod";

const createSchema = z.object({
  customerType: z.enum(["INDIVIDUAL", "AGENCY"]),
  name: z.string().min(1),
  tel: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().optional(),
  cityId: z.string().uuid().optional(),
  suburbId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; tenantId?: string | null };
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const cityId = searchParams.get("cityId") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(customers.isActive, true)];
  // Clerks only see their tenant's customers
  if (user.role !== "ADMIN" && user.tenantId) {
    conditions.push(eq(customers.tenantId, user.tenantId));
  }
  if (search) {
    conditions.push(
      or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.tel, `%${search}%`),
        ilike(customers.customerNumber, `%${search}%`)
      )!
    );
  }
  if (type === "INDIVIDUAL" || type === "AGENCY") {
    conditions.push(eq(customers.customerType, type));
  }
  if (cityId) {
    conditions.push(eq(customers.cityId, cityId));
  }

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: customers.id,
        customerNumber: customers.customerNumber,
        customerType: customers.customerType,
        name: customers.name,
        tel: customers.tel,
        email: customers.email,
        cityName: cities.name,
        suburbName: suburbs.name,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .leftJoin(cities, eq(customers.cityId, cities.id))
      .leftJoin(suburbs, eq(customers.suburbId, suburbs.id))
      .where(and(...conditions))
      .orderBy(customers.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(and(...conditions)),
  ]);

  return NextResponse.json({ data: rows, total: Number(countResult[0].count), page, limit });
}

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
  const customerNumber = await nextCustomerNumber(user.tenantId, user.tenantCode);

  const [customer] = await db
    .insert(customers)
    .values({
      tenantId: user.tenantId,
      customerNumber,
      customerType: data.customerType,
      name: data.name,
      tel: data.tel,
      email: data.email || null,
      location: data.location || null,
      cityId: data.cityId ?? null,
      suburbId: data.suburbId ?? null,
    })
    .returning();

  after(() => processAlerts().catch(() => {}));
  return NextResponse.json(customer, { status: 201 });
}
