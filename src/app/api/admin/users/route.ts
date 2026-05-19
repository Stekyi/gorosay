import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { staffUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db
    .select({
      id: staffUsers.id,
      name: staffUsers.name,
      email: staffUsers.email,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      createdAt: staffUsers.createdAt,
    })
    .from(staffUsers)
    .orderBy(staffUsers.createdAt);

  return NextResponse.json(users);
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(staffUsers)
    .values({ name, email, passwordHash, role: "CLERK" })
    .returning({
      id: staffUsers.id,
      name: staffUsers.name,
      email: staffUsers.email,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      createdAt: staffUsers.createdAt,
    });

  return NextResponse.json(user, { status: 201 });
}

const patchSchema = z.union([
  z.object({ id: z.string().uuid(), isActive: z.boolean() }),
  z.object({ id: z.string().uuid(), password: z.string().min(8) }),
]);

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = parsed.data;

  if ("isActive" in parsed.data) {
    await db.update(staffUsers).set({ isActive: parsed.data.isActive }).where(eq(staffUsers.id, id));
  } else {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db.update(staffUsers).set({ passwordHash }).where(eq(staffUsers.id, id));
  }

  return NextResponse.json({ ok: true });
}
