/**
 * Run once to seed initial data: settings defaults, document types, Ghana cities.
 * Usage: npx tsx src/lib/db/seed.ts
 */
import { db } from "./index";
import { settings, documentTypes, cities } from "./schema";

const DEFAULT_SETTINGS = [
  { key: "price_new_vehicle", value: process.env.SEED_PRICE_NEW_VEHICLE ?? "50" },
  { key: "price_new_driver", value: process.env.SEED_PRICE_NEW_DRIVER ?? "15" },
  { key: "price_renewal", value: process.env.SEED_PRICE_RENEWAL ?? "20" },
  { key: "sms_provider", value: "arkesel" },
  { key: "sms_api_key", value: "" },
  { key: "sms_sender_id", value: "GOROSAY" },
  { key: "sms_enabled", value: "true" },
  { key: "email_from_name", value: "Gorosay" },
  { key: "email_from_address", value: "asamoahtekyi@gmail.com" },
  { key: "email_app_password", value: "" },
  { key: "email_smtp_username", value: "" },
  { key: "email_smtp_host", value: "smtp.gmail.com" },
  { key: "email_smtp_port", value: "465" },
  { key: "email_enabled", value: "true" },
  { key: "notify_days_before", value: "5,1" },
];

const DEFAULT_DOCUMENT_TYPES = [
  { name: "Motor Insurance", slug: "motor_insurance", appliesTo: "vehicle" as const, sortOrder: 1 },
  { name: "Road Worthy Certificate", slug: "road_worthy", appliesTo: "vehicle" as const, sortOrder: 2 },
  { name: "Goods Carrying Permit", slug: "goods_carrying_permit", appliesTo: "vehicle" as const, sortOrder: 3 },
  { name: "Driver's License", slug: "drivers_license", appliesTo: "driver" as const, sortOrder: 4 },
  { name: "Road License", slug: "road_license", appliesTo: "vehicle" as const, sortOrder: 5 },
];

const GHANA_CITIES = [
  "Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast",
  "Koforidua", "Sunyani", "Bolgatanga", "Wa", "Ho",
  "Techiman", "Obuasi", "Tarkwa", "Tema", "Ashaiman",
  "Kasoa", "Madina", "Nungua", "Dansoman", "Spintex",
];

async function seed() {
  console.log("Seeding settings...");
  for (const s of DEFAULT_SETTINGS) {
    await db.insert(settings).values(s).onConflictDoNothing();
  }

  console.log("Seeding document types...");
  for (const dt of DEFAULT_DOCUMENT_TYPES) {
    await db.insert(documentTypes).values(dt).onConflictDoNothing();
  }

  console.log("Seeding Ghana cities...");
  for (const name of GHANA_CITIES) {
    await db.insert(cities).values({ name }).onConflictDoNothing();
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
