import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cities, suburbs } from "@/lib/db/schema";
import { eq, ilike } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const withSuburbs = req.nextUrl.searchParams.get("withSuburbs") === "true";

  const rows = q.length >= 2
    ? await db.select().from(cities).where(ilike(cities.name, `%${q}%`)).orderBy(cities.name).limit(20)
    : await db.select().from(cities).orderBy(cities.name);

  if (!withSuburbs) return NextResponse.json(rows);

  const all = await db
    .select({ city: cities, suburb: suburbs })
    .from(cities)
    .leftJoin(suburbs, eq(suburbs.cityId, cities.id))
    .orderBy(cities.name, suburbs.name);

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, cityId } = await req.json();

  if (cityId) {
    // Create suburb
    const [suburb] = await db
      .insert(suburbs)
      .values({ cityId, name })
      .onConflictDoNothing()
      .returning();
    return NextResponse.json(suburb, { status: 201 });
  } else {
    // Create city
    const [city] = await db
      .insert(cities)
      .values({ name })
      .onConflictDoNothing()
      .returning();
    return NextResponse.json(city, { status: 201 });
  }
}
