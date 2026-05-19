import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documentTypes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeOnly = req.nextUrl.searchParams.get("active") !== "false";
  const rows = activeOnly
    ? await db.select().from(documentTypes).where(eq(documentTypes.isActive, true)).orderBy(documentTypes.sortOrder)
    : await db.select().from(documentTypes).orderBy(documentTypes.sortOrder);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const slug = (body.name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const [dt] = await db
    .insert(documentTypes)
    .values({ ...body, slug })
    .returning();

  return NextResponse.json(dt, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, ...updates } = await req.json();
  const [dt] = await db
    .update(documentTypes)
    .set(updates)
    .where(eq(documentTypes.id, id))
    .returning();

  return NextResponse.json(dt);
}
