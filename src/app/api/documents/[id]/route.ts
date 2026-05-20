import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, and, ilike, ne, isNotNull } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  documentNumber: z.string().nullable().optional(),
  placeOfIssue: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  renewalDates: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // If document number is being changed, check it isn't already used by a different entity
  if (parsed.data.documentNumber?.trim()) {
    const [current] = await db.select({ documentTypeId: documents.documentTypeId, vehicleId: documents.vehicleId, driverId: documents.driverId }).from(documents).where(eq(documents.id, id)).limit(1);
    if (current) {
      const [conflict] = await db
        .select({ entityRef: documents.entityRef })
        .from(documents)
        .where(and(
          eq(documents.documentTypeId, current.documentTypeId),
          eq(documents.version, 1),
          ilike(documents.documentNumber, parsed.data.documentNumber.trim()),
          isNotNull(documents.documentNumber),
          ne(documents.id, id),
          current.vehicleId ? ne(documents.vehicleId, current.vehicleId) : ne(documents.driverId, current.driverId!),
        ))
        .limit(1);
      if (conflict) {
        return NextResponse.json(
          { error: `Document number "${parsed.data.documentNumber}" is already registered for ${conflict.entityRef ?? "another entry"}` },
          { status: 409 }
        );
      }
    }
  }

  const [doc] = await db
    .update(documents)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}
