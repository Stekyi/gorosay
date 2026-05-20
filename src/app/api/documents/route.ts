import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, documentTypes, vehicles, drivers, serviceCharges } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  // Find existing documents for this entity + document type
  const entityCondition = data.vehicleId
    ? eq(documents.vehicleId, data.vehicleId)
    : eq(documents.driverId, data.driverId!);

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

  // Send document upload notification email after response is returned
  const emailData = { ...data };
  after(async () => {
    try {
      let customerEmail: string | null = null;
      let customerName: string | null = null;

      if (emailData.vehicleId) {
        const [row] = await db
          .select({ email: customers.email, name: customers.name })
          .from(vehicles)
          .innerJoin(customers, eq(vehicles.customerId, customers.id))
          .where(eq(vehicles.id, emailData.vehicleId))
          .limit(1);
        customerEmail = row?.email ?? null;
        customerName = row?.name ?? null;
      } else if (emailData.driverId) {
        const [row] = await db
          .select({ email: customers.email, name: customers.name })
          .from(drivers)
          .innerJoin(customers, eq(drivers.customerId, customers.id))
          .where(eq(drivers.id, emailData.driverId!))
          .limit(1);
        customerEmail = row?.email ?? null;
        customerName = row?.name ?? null;
      }

      const [docType] = await db
        .select({ name: documentTypes.name })
        .from(documentTypes)
        .where(eq(documentTypes.id, data.documentTypeId))
        .limit(1);
      const docTypeName = docType?.name ?? "Document";

      if (customerEmail) {
        const downloadUrl = await getPublicDownloadUrl(data.fileKey);
        await sendDocumentUploadEmail({
          customerEmail,
          customerName: customerName ?? "Customer",
          documentType: docTypeName,
          entityRef: data.entityRef ?? "",
          issueDate: data.issueDate ?? null,
          expiryDate: data.expiryDate ?? null,
          downloadUrl,
        });
      } else {
        // No email on file — log as skipped so it's visible in the admin log
        await db.insert(emailLogs).values({
          type: "document_upload",
          recipient: "—",
          subject: `${docTypeName} for ${data.entityRef ?? ""} — no customer email on file`,
          status: "skipped",
        }).catch(() => {});
      }
    } catch {
      // Email failure must not affect the document save response
    }
  });

  return NextResponse.json(doc, { status: 201 });
}
