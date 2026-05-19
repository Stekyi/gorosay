import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, documentTypes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rows = await db
    .select({
      id: documents.id,
      version: documents.version,
      status: documents.status,
      documentTypeName: documentTypes.name,
      documentTypeSlug: documentTypes.slug,
      documentNumber: documents.documentNumber,
      placeOfIssue: documents.placeOfIssue,
      issueDate: documents.issueDate,
      expiryDate: documents.expiryDate,
      renewalDates: documents.renewalDates,
      entityRef: documents.entityRef,
      fileName: documents.fileName,
      fileKey: documents.fileKey,
      uploadedAt: documents.uploadedAt,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .where(eq(documents.driverId, id))
    .orderBy(documentTypes.sortOrder, documents.version);

  return NextResponse.json(rows);
}
