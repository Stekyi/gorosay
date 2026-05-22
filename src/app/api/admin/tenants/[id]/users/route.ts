import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { staffUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tenantId } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password } = parsed.data;
  const [existing] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: `Email "${email}" is already in use` }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(staffUsers).values({ tenantId, name, email, passwordHash, role: "CLERK" }).returning({
    id: staffUsers.id,
    name: staffUsers.name,
    email: staffUsers.email,
    role: staffUsers.role,
    isActive: staffUsers.isActive,
    createdAt: staffUsers.createdAt,
  });

  return NextResponse.json(user, { status: 201 });
}
