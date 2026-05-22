import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenants, staffUsers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactTel: z.string().optional(),
  clerkName: z.string().min(1),
  clerkEmail: z.string().email(),
  clerkPassword: z.string().min(8),
});

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      code: tenants.code,
      contactEmail: tenants.contactEmail,
      contactTel: tenants.contactTel,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  // Count users per tenant
  const userCounts = await db.select({ tenantId: staffUsers.tenantId }).from(staffUsers);
  const countMap: Record<string, number> = {};
  for (const u of userCounts) {
    if (u.tenantId) countMap[u.tenantId] = (countMap[u.tenantId] ?? 0) + 1;
  }

  return NextResponse.json(rows.map((t) => ({ ...t, userCount: countMap[t.id] ?? 0 })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  // Check code uniqueness
  const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.code, data.code.toUpperCase())).limit(1);
  if (existing) return NextResponse.json({ error: `Tenant code "${data.code}" is already taken` }, { status: 409 });

  // Check clerk email uniqueness
  const [existingUser] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, data.clerkEmail)).limit(1);
  if (existingUser) return NextResponse.json({ error: `Email "${data.clerkEmail}" is already in use` }, { status: 409 });

  const [tenant] = await db.insert(tenants).values({
    name: data.name,
    code: data.code.toUpperCase(),
    contactEmail: data.contactEmail || null,
    contactTel: data.contactTel || null,
  }).returning();

  const passwordHash = await bcrypt.hash(data.clerkPassword, 12);
  await db.insert(staffUsers).values({
    tenantId: tenant.id,
    name: data.clerkName,
    email: data.clerkEmail,
    passwordHash,
    role: "CLERK",
  });

  return NextResponse.json(tenant, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, isActive } = await req.json();
  await db.update(tenants).set({ isActive }).where(eq(tenants.id, id));
  return NextResponse.json({ ok: true });
}
