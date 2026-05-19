import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { invalidateSetting } from "@/lib/utils/settings";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.select().from(settings).orderBy(settings.key);

  // Mask sensitive values
  const masked = rows.map((r) => ({
    ...r,
    value:
      r.key.includes("password") || r.key.includes("api_key")
        ? r.value
          ? "••••••••"
          : ""
        : r.value,
  }));

  return NextResponse.json(masked);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: Record<string, string> = await req.json();

  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") continue;
    // Don't overwrite secrets with masked values
    if (["••••••••"].includes(value)) continue;
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    invalidateSetting(key);
  }

  return NextResponse.json({ ok: true });
}
