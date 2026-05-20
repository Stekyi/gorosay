import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 60_000; // 1 minute cache

export async function getSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  if (!row) return null;
  cache.set(key, { value: row.value, expiresAt: now + TTL_MS });
  return row.value;
}

export async function getSettings(
  keys: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    keys.map(async (k) => {
      const v = await getSetting(k);
      if (v !== null) result[k] = v;
    })
  );
  return result;
}

export function invalidateSetting(key: string) {
  cache.delete(key);
}

// Typed accessors
export const SETTING_KEYS = {
  PRICE_NEW_VEHICLE: "price_new_vehicle",
  PRICE_NEW_DRIVER: "price_new_driver",
  PRICE_RENEWAL: "price_renewal",
  SMS_PROVIDER: "sms_provider",
  SMS_API_KEY: "sms_api_key",
  SMS_SENDER_ID: "sms_sender_id",
  SMS_ENABLED: "sms_enabled",
  EMAIL_FROM_NAME: "email_from_name",
  EMAIL_FROM_ADDRESS: "email_from_address",
  EMAIL_APP_PASSWORD: "email_app_password",
  EMAIL_SMTP_HOST: "email_smtp_host",
  EMAIL_SMTP_PORT: "email_smtp_port",
  EMAIL_ENABLED: "email_enabled",
  NOTIFY_DAYS_BEFORE: "notify_days_before",
} as const;

export async function getPrices() {
  const s = await getSettings([
    SETTING_KEYS.PRICE_NEW_VEHICLE,
    SETTING_KEYS.PRICE_NEW_DRIVER,
    SETTING_KEYS.PRICE_RENEWAL,
  ]);
  return {
    newVehicle: parseFloat(s[SETTING_KEYS.PRICE_NEW_VEHICLE] ?? "50"),
    newDriver: parseFloat(s[SETTING_KEYS.PRICE_NEW_DRIVER] ?? "15"),
    renewal: parseFloat(s[SETTING_KEYS.PRICE_RENEWAL] ?? "20"),
  };
}

export async function getNotifyDays(): Promise<number[]> {
  const v = await getSetting(SETTING_KEYS.NOTIFY_DAYS_BEFORE);
  return (v ?? "5,1")
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((n) => !isNaN(n));
}
