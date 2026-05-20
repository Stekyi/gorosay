import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, documentTypes, vehicles, drivers, serviceCharges } from "@/lib/db/schema";
import { eq, and, ilike, ne, isNotNull } from "drizzle-orm";
import { getPrices } from "@/lib/utils/settings";
import { deleteFile, docFileKey, extFromMime, vehicleFolderKey, driverFolderKey, getPublicDownloadUrl } from "@/lib/storage/r2";
import { sendDocumentUploadEmail } from "@/lib/notifications/email";
import { customers, emailLogs } from "@/lib/db/schema";
import { z } from "zod";

const createSchema = z.object({
  documentTypeId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  documentNumber: z.string().optional(),
  placeOfIssue: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  renewalDates: z.array(z.string()).optional(),
  entityRef: z.string().optional(),
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().optional(),
  mimeType: z.string().optional(),
  notes: z.string().optional(),
  isRenewal: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (!data.vehicleId && !data.driverId) {
    return NextResponse.json({ error: "vehicleId or driverId required" }, { status: 400 });
  }

  // Uniqueness: document number must not already exist for a different entity (same doc type)
  if (data.documentNumber?.trim()) {
    const docNumRows = await db
      .select({ vehicleId: documents.vehicleId, driverId: documents.driverId, entityRef: documents.entityRef })
      .from(documents)
      .where(and(
        eq(documents.documentTypeId, data.documentTypeId),
        eq(documents.version, 1),
        ilike(documents.documentNumber, data.documentNumber.trim()),
        isNotNull(documents.documentNumber),
      ));
    const conflict = docNumRows.find((d) =>
      data.vehicleId ? d.vehicleId !== data.vehicleId : d.driverId !== data.driverId
    );
    if (conflict) {
      return NextResponse.json(
        { error: `Document number "${data.documentNumber}" is already registered for ${conflict.entityRef ?? "another entry"}` },
        { status: 409 }
      );
    }
  }

  // Find existing documents for this entity + document type
  const entityCondition = data.vehicleId
    ? eq(documents.vehicleId, data.vehicleId)
    : eq(documents.driverId, data.driverId!);

  // Duplicate guard: same entity + doc type + expiry date already has an active document
  if (data.expiryDate) {
    const [dupExpiry] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.documentTypeId, data.documentTypeId), entityCondition, eq(documents.version, 1), eq(documents.expiryDate, data.expiryDate)))
      .limit(1);
    if (dupExpiry) {
      return NextResponse.json(
        { error: `An active document of this type with expiry date ${data.expiryDate} is already on file` },
        { status: 409 }
      );
    }
  }

  const existing = await db
    .select()
    .from(documents)
    .where(and(eq(documents.documentTypeId, data.documentTypeId), entityCondition))
    .orderBy(documents.version);

  // Version rotation
  for (const doc of existing) {
    if (doc.version === 2) {
      // Delete oldest file from R2 and remove DB row
      await deleteFile(doc.fileKey).catch(() => {});
      await db.delete(documents).where(eq(documents.id, doc.id));
    } else if (doc.version === 1) {
      // Demote current to previous
      await db
        .update(documents)
        .set({ version: 2, status: "EXPIRED", updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }
  }

  // If this is a renewal, record the charge
  let customerId: string | null = null;
  if (data.isRenewal) {
    if (data.vehicleId) {
      const [v] = await db.select({ customerId: vehicles.customerId }).from(vehicles).where(eq(vehicles.id, data.vehicleId)).limit(1);
      customerId = v?.customerId ?? null;
    } else if (data.driverId) {
      const [d] = await db.select({ customerId: drivers.customerId }).from(drivers).where(eq(drivers.id, data.driverId!)).limit(1);
      customerId = d?.customerId ?? null;
    }
    if (customerId) {
      const prices = await getPrices();
      const [docType] = await db.select({ name: documentTypes.name }).from(documentTypes).where(eq(documentTypes.id, data.documentTypeId)).limit(1);
      await db.insert(serviceCharges).values({
        customerId,
        vehicleId: data.vehicleId ?? null,
        driverId: data.driverId ?? null,
        description: `Renewal — ${docType?.name ?? "Document"} for ${data.entityRef ?? ""}`,
        amountGhs: String(prices.renewal),
      });
    }
  }

  const [doc] = await db
    .insert(documents)
    .values({
      documentTypeId: data.documentTypeId,
      vehicleId: data.vehicleId ?? null,
      driverId: data.driverId ?? null,
      version: 1,
      status: "ACTIVE",
      documentNumber: data.documentNumber ?? null,
      placeOfIssue: data.placeOfIssue ?? null,
      issueDate: data.issueDate ?? null,
      expiryDate: data.expiryDate ?? null,
      renewalDates: data.renewalDates ?? [],
      entityRef: data.entityRef ?? null,
      fileKey: data.fileKey,
      fileName: data.fileName,
      fileSizeBytes: data.fileSizeBytes ?? null,
      mimeType: data.mimeType ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  // Pre-fetch email data now (same pattern as welcome email — no DB queries inside after())
  let notifyEmail: string | null = null;
  let notifyName: string | null = null;
  if (data.vehicleId) {
    const [row] = await db
      .select({ email: customers.email, name: customers.name })
      .from(vehicles)
      .innerJoin(customers, eq(vehicles.customerId, customers.id))
      .where(eq(vehicles.id, data.vehicleId))
      .limit(1);
    notifyEmail = row?.email ?? null;
    notifyName = row?.name ?? null;
  } else if (data.driverId) {
    const [row] = await db
      .select({ email: customers.email, name: customers.name })
      .from(drivers)
      .innerJoin(customers, eq(drivers.customerId, customers.id))
      .where(eq(drivers.id, data.driverId!))
      .limit(1);
    notifyEmail = row?.email ?? null;
    notifyName = row?.name ?? null;
  }
  const [docTypeRow] = await db
    .select({ name: documentTypes.name })
    .from(documentTypes)
    .where(eq(documentTypes.id, data.documentTypeId))
    .limit(1);
  const docTypeName = docTypeRow?.name ?? "Document";

  // After response: only R2 URL generation + email send — no DB selects
  const emailSnap = {
    email: notifyEmail,
    name: notifyName ?? "Customer",
    docTypeName,
    entityRef: data.entityRef ?? "",
    issueDate: data.issueDate ?? null,
    expiryDate: data.expiryDate ?? null,
    fileKey: data.fileKey,
  };
  after(async () => {
    if (!emailSnap.email) {
      await db.insert(emailLogs).values({
        type: "document_upload",
        recipient: "—",
        subject: `${emailSnap.docTypeName} for ${emailSnap.entityRef} — no customer email on file`,
        status: "skipped",
      }).catch(() => {});
      return;
    }
    try {
      const downloadUrl = await getPublicDownloadUrl(emailSnap.fileKey);
      await sendDocumentUploadEmail({
        customerEmail: emailSnap.email,
        customerName: emailSnap.name,
        documentType: emailSnap.docTypeName,
        entityRef: emailSnap.entityRef,
        issueDate: emailSnap.issueDate,
        expiryDate: emailSnap.expiryDate,
        downloadUrl,
      });
    } catch {
      // sendEmail already logs the failure to email_logs via its finally block
    }
  });

  return NextResponse.json(doc, { status: 201 });
}
