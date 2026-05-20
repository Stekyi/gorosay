import { db } from "@/lib/db";
import { documents, notificationLogs, emailLogs, customers, vehicles, drivers, documentTypes } from "@/lib/db/schema";
import { processAlerts } from "./alerts";
import { and, eq, gte, lte, isNotNull, lt, or } from "drizzle-orm";
import { addDays, subDays, format, parseISO, differenceInCalendarDays } from "date-fns";
import { sendEmail, buildExpiryEmailHtml } from "./email";
import { sendSms, buildExpiryMessage } from "./sms";
import { getSetting, getNotifyDays, SETTING_KEYS } from "@/lib/utils/settings";

interface NotifTarget {
  documentId: string;
  targetDate: string; // ISO date string
  isRenewal: boolean;
  customerName: string;
  customerEmail: string | null;
  customerTel: string;
  documentTypeName: string;
  entityRef: string;
}

export async function runNotificationJob(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  // Process any pending/failed transactional alerts first (welcome + doc_upload)
  await processAlerts().catch(() => {});

  const notifyDays = await getNotifyDays();
  const maxDays = Math.max(...notifyDays);
  const today = new Date();
  const windowEnd = addDays(today, maxDays + 1);

  const [senderName, emailEnabled, smsEnabled] = await Promise.all([
    getSetting(SETTING_KEYS.SMS_SENDER_ID),
    getSetting(SETTING_KEYS.EMAIL_ENABLED),
    getSetting(SETTING_KEYS.SMS_ENABLED),
  ]);

  // Fetch all active documents with expiry in window
  const activeDocs = await db
    .select({
      id: documents.id,
      expiryDate: documents.expiryDate,
      renewalDates: documents.renewalDates,
      entityRef: documents.entityRef,
      vehicleId: documents.vehicleId,
      driverId: documents.driverId,
      documentTypeName: documentTypes.name,
      customerName: customers.name,
      customerEmail: customers.email,
      customerTel: customers.tel,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .leftJoin(vehicles, eq(documents.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(documents.driverId, drivers.id))
    .innerJoin(
      customers,
      or(
        eq(vehicles.customerId, customers.id),
        eq(drivers.customerId, customers.id)
      )
    )
    .where(
      and(
        eq(documents.status, "ACTIVE"),
        eq(documents.version, 1)
      )
    );

  const targets: NotifTarget[] = [];

  for (const doc of activeDocs) {
    // Add expiry date as a target
    if (doc.expiryDate) {
      targets.push({
        documentId: doc.id,
        targetDate: doc.expiryDate,
        isRenewal: false,
        customerName: doc.customerName,
        customerEmail: doc.customerEmail,
        customerTel: doc.customerTel,
        documentTypeName: doc.documentTypeName,
        entityRef: doc.entityRef ?? "",
      });
    }
    // Add each renewal date as a target
    const renewalDates = (doc.renewalDates as string[]) ?? [];
    for (const rd of renewalDates) {
      targets.push({
        documentId: doc.id,
        targetDate: rd,
        isRenewal: true,
        customerName: doc.customerName,
        customerEmail: doc.customerEmail,
        customerTel: doc.customerTel,
        documentTypeName: doc.documentTypeName,
        entityRef: doc.entityRef ?? "",
      });
    }
  }

  let sent = 0;
  const errors: string[] = [];

  for (const target of targets) {
    const targetDateObj = parseISO(target.targetDate);
    const daysLeft = differenceInCalendarDays(targetDateObj, today);

    for (const threshold of notifyDays) {
      if (daysLeft !== threshold) continue;

      // Check deduplication for email
      if (emailEnabled !== "false" && target.customerEmail) {
        const alreadySent = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.documentId, target.documentId),
              eq(notificationLogs.targetDate, target.targetDate),
              eq(notificationLogs.channel, "email"),
              eq(notificationLogs.daysBefore, threshold)
            )
          )
          .limit(1);

        if (alreadySent.length === 0) {
          try {
            await sendEmail({
              to: target.customerEmail,
              subject: `[Gorosay] ${target.documentTypeName} for ${target.entityRef} — ${threshold === 1 ? "EXPIRES TOMORROW" : `${threshold} days to ${target.isRenewal ? "renewal" : "expiry"}`}`,
              html: buildExpiryEmailHtml({
                customerName: target.customerName,
                documentType: target.documentTypeName,
                entityRef: target.entityRef,
                targetDate: format(targetDateObj, "dd MMM yyyy"),
                daysBefore: threshold,
                isRenewal: target.isRenewal,
              }),
            });
            await db.insert(notificationLogs).values({
              documentId: target.documentId,
              targetDate: target.targetDate,
              channel: "email",
              daysBefore: threshold,
              recipient: target.customerEmail,
              status: "sent",
            });
            sent++;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`email to ${target.customerEmail}: ${msg}`);
            await db.insert(notificationLogs).values({
              documentId: target.documentId,
              targetDate: target.targetDate,
              channel: "email",
              daysBefore: threshold,
              recipient: target.customerEmail,
              status: "failed",
              errorMessage: msg,
            }).onConflictDoNothing();
          }
        }
      }

      // Check deduplication for SMS
      if (smsEnabled !== "false" && target.customerTel) {
        const alreadySent = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.documentId, target.documentId),
              eq(notificationLogs.targetDate, target.targetDate),
              eq(notificationLogs.channel, "sms"),
              eq(notificationLogs.daysBefore, threshold)
            )
          )
          .limit(1);

        if (alreadySent.length === 0) {
          try {
            await sendSms(
              target.customerTel,
              buildExpiryMessage({
                documentType: target.documentTypeName,
                entityRef: target.entityRef,
                targetDate: format(targetDateObj, "dd MMM yyyy"),
                daysBefore: threshold,
                isRenewal: target.isRenewal,
                senderName: senderName ?? "GOROSAY",
              })
            );
            await db.insert(notificationLogs).values({
              documentId: target.documentId,
              targetDate: target.targetDate,
              channel: "sms",
              daysBefore: threshold,
              recipient: target.customerTel,
              status: "sent",
            });
            sent++;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`sms to ${target.customerTel}: ${msg}`);
            await db.insert(notificationLogs).values({
              documentId: target.documentId,
              targetDate: target.targetDate,
              channel: "sms",
              daysBefore: threshold,
              recipient: target.customerTel,
              status: "failed",
              errorMessage: msg,
            }).onConflictDoNothing();
          }
        }
      }
    }
  }

  // Purge logs older than 14 days
  const cutoff = subDays(today, 14);
  await Promise.all([
    db.delete(notificationLogs).where(lt(notificationLogs.sentAt, cutoff)),
    db.delete(emailLogs).where(lt(emailLogs.sentAt, cutoff)),
  ]);

  return { processed: targets.length, sent, errors };
}
