import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";

export async function sendSms(
  recipient: string,
  message: string
): Promise<void> {
  const enabled = await getSetting(SETTING_KEYS.SMS_ENABLED);
  if (enabled === "false") return;

  const [provider, apiKey, senderId] = await Promise.all([
    getSetting(SETTING_KEYS.SMS_PROVIDER),
    getSetting(SETTING_KEYS.SMS_API_KEY),
    getSetting(SETTING_KEYS.SMS_SENDER_ID),
  ]);

  if (!apiKey) throw new Error("SMS API key not configured");

  switch (provider ?? "arkesel") {
    case "arkesel":
      await sendArkesel({ apiKey, senderId: senderId ?? "GOROSAY", recipient, message });
      break;
    case "mnotify":
      await sendMNotify({ apiKey, senderId: senderId ?? "GOROSAY", recipient, message });
      break;
    default:
      throw new Error(`Unknown SMS provider: ${provider}`);
  }
}

async function sendArkesel(p: {
  apiKey: string;
  senderId: string;
  recipient: string;
  message: string;
}) {
  const res = await fetch("https://sms.arkesel.com/sms/api?action=send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: p.apiKey,
      to: p.recipient,
      from: p.senderId,
      sms: p.message,
    }),
  });
  if (!res.ok) throw new Error(`Arkesel error: ${res.status}`);
}

async function sendMNotify(p: {
  apiKey: string;
  senderId: string;
  recipient: string;
  message: string;
}) {
  const res = await fetch(
    `https://apps.mnotify.net/smsapi?key=${p.apiKey}&to=${encodeURIComponent(p.recipient)}&msg=${encodeURIComponent(p.message)}&sender_id=${encodeURIComponent(p.senderId)}`,
    { method: "GET" }
  );
  if (!res.ok) throw new Error(`mNotify error: ${res.status}`);
}

export function buildExpiryMessage(params: {
  documentType: string;
  entityRef: string;
  targetDate: string;
  daysBefore: number;
  isRenewal: boolean;
  senderName: string;
}): string {
  const { documentType, entityRef, targetDate, daysBefore, isRenewal, senderName } = params;
  const action = isRenewal ? "renewal" : "expiry";
  if (daysBefore <= 1) {
    return `CRITICAL: Your ${documentType} for ${entityRef} ${action === "expiry" ? "EXPIRES" : "renewal date is"} TOMORROW (${targetDate}). Contact us now. - ${senderName}`;
  }
  return `REMINDER: ${documentType} for ${entityRef} ${action} date is ${targetDate} (${daysBefore} days). Please renew. - ${senderName}`;
}
