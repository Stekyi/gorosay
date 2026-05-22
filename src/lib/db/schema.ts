import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const customerTypeEnum = pgEnum("customer_type", [
  "INDIVIDUAL",
  "AGENCY",
]);
export const staffRoleEnum = pgEnum("staff_role", ["ADMIN", "CLERK"]);
export const documentStatusEnum = pgEnum("document_status", [
  "ACTIVE",
  "EXPIRED",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
]);
export const docAppliesToEnum = pgEnum("doc_applies_to", [
  "vehicle",
  "driver",
  "both",
]);

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(), // prefix for IDs e.g. "MTN"
  contactEmail: varchar("contact_email", { length: 200 }),
  contactTel: varchar("contact_tel", { length: 30 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Staff Users ──────────────────────────────────────────────────────────────

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // NULL = super-admin
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: staffRoleEnum("role").notNull().default("CLERK"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Cities & Suburbs ─────────────────────────────────────────────────────────

export const cities = pgTable("cities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suburbs = pgTable(
  "suburbs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("suburbs_city_name_idx").on(t.cityId, t.name)]
);

// ─── Document Types ───────────────────────────────────────────────────────────

export const documentTypes = pgTable("document_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  appliesTo: docAppliesToEnum("applies_to").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerNumber: varchar("customer_number", { length: 30 }).unique(),
    customerType: customerTypeEnum("customer_type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    tel: varchar("tel", { length: 30 }).notNull(),
    email: varchar("email", { length: 200 }),
    location: text("location"),
    cityId: uuid("city_id").references(() => cities.id),
    suburbId: uuid("suburb_id").references(() => suburbs.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("customers_tel_idx").on(t.tel),
    index("customers_tenant_idx").on(t.tenantId),
  ]
);

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleNumber: varchar("vehicle_number", { length: 20 }).notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  registrationNumber: varchar("registration_number", { length: 30 }),
  make: varchar("make", { length: 100 }),
  model: varchar("model", { length: 100 }),
  year: integer("year"),
  vehicleType: varchar("vehicle_type", { length: 50 }),
  color: varchar("color", { length: 50 }),
  chassisNumber: varchar("chassis_number", { length: 100 }),
  engineNumber: varchar("engine_number", { length: 100 }),
  storageFolder: text("storage_folder"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Drivers ──────────────────────────────────────────────────────────────────

export const drivers = pgTable("drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverNumber: varchar("driver_number", { length: 20 }).notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  tel: varchar("tel", { length: 30 }),
  email: varchar("email", { length: 200 }),
  dateOfBirth: date("date_of_birth"),
  storageFolder: text("storage_folder"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Documents ────────────────────────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentTypeId: uuid("document_type_id")
      .notNull()
      .references(() => documentTypes.id),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "restrict",
    }),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "restrict",
    }),
    version: integer("version").notNull().default(1), // 1=current, 2=previous
    status: documentStatusEnum("status").notNull().default("ACTIVE"),
    documentNumber: varchar("document_number", { length: 100 }),
    placeOfIssue: varchar("place_of_issue", { length: 200 }),
    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),
    renewalDates: jsonb("renewal_dates").default([]), // string[] of ISO dates
    entityRef: varchar("entity_ref", { length: 200 }), // vehicle reg or driver name
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: varchar("mime_type", { length: 100 }),
    notes: text("notes"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("documents_vehicle_doctype_idx").on(t.vehicleId, t.documentTypeId),
    index("documents_driver_doctype_idx").on(t.driverId, t.documentTypeId),
    index("documents_expiry_idx").on(t.expiryDate),
  ]
);

// ─── Service Charges ──────────────────────────────────────────────────────────

export const serviceCharges = pgTable("service_charges", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  driverId: uuid("driver_id").references(() => drivers.id),
  documentId: uuid("document_id").references(() => documents.id),
  description: varchar("description", { length: 200 }).notNull(),
  amountGhs: numeric("amount_ghs", { precision: 10, scale: 2 }).notNull(),
  chargedAt: timestamp("charged_at").defaultNow().notNull(),
});

// ─── Payment Records ──────────────────────────────────────────────────────────

export const paymentRecords = pgTable("payment_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  amountGhs: numeric("amount_ghs", { precision: 10, scale: 2 }).notNull(),
  paidAt: date("paid_at").notNull(),
  method: paymentMethodEnum("method").notNull(),
  reference: varchar("reference", { length: 200 }),
  notes: text("notes"),
  recordedBy: uuid("recorded_by").references(() => staffUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Alerts (event queue populated by DB triggers, processed async) ──────────

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // 'welcome' | 'doc_upload'
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | sent | failed | skipped
    recipientEmail: varchar("recipient_email", { length: 200 }),
    recipientName: varchar("recipient_name", { length: 200 }),
    payload: jsonb("payload").notNull().default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (t) => [
    index("alerts_status_idx").on(t.status),
    index("alerts_created_at_idx").on(t.createdAt),
  ]
);

// ─── Email Logs (legacy — kept for old rows, no longer written to) ────────────

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'welcome' | 'document_upload'
  recipient: varchar("recipient", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("sent"), // 'sent' | 'failed'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

// ─── Notification Logs ────────────────────────────────────────────────────────

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    targetDate: date("target_date").notNull(), // expiry_date or a renewal_date
    channel: varchar("channel", { length: 20 }).notNull(), // 'email' | 'sms'
    daysBefore: integer("days_before").notNull(),
    recipient: varchar("recipient", { length: 200 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // 'sent' | 'failed'
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("notification_dedup_idx").on(
      t.documentId,
      t.targetDate,
      t.channel,
      t.daysBefore
    ),
  ]
);

// ─── Counters (for sequential ID generation) ──────────────────────────────────

export const idCounters = pgTable(
  "id_counters",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(), // 'customer' | 'vehicle' | 'driver'
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [uniqueIndex("id_counters_tenant_name_idx").on(t.tenantId, t.name)]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const customersRelations = relations(customers, ({ one, many }) => ({
  city: one(cities, { fields: [customers.cityId], references: [cities.id] }),
  suburb: one(suburbs, {
    fields: [customers.suburbId],
    references: [suburbs.id],
  }),
  vehicles: many(vehicles),
  drivers: many(drivers),
  serviceCharges: many(serviceCharges),
  paymentRecords: many(paymentRecords),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  customer: one(customers, {
    fields: [vehicles.customerId],
    references: [customers.id],
  }),
  documents: many(documents),
  serviceCharges: many(serviceCharges),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [drivers.customerId],
    references: [customers.id],
  }),
  documents: many(documents),
  serviceCharges: many(serviceCharges),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  documentType: one(documentTypes, {
    fields: [documents.documentTypeId],
    references: [documentTypes.id],
  }),
  vehicle: one(vehicles, {
    fields: [documents.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(drivers, {
    fields: [documents.driverId],
    references: [drivers.id],
  }),
  serviceCharges: many(serviceCharges),
  notificationLogs: many(notificationLogs),
}));

export const suburbsRelations = relations(suburbs, ({ one }) => ({
  city: one(cities, { fields: [suburbs.cityId], references: [cities.id] }),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  suburbs: many(suburbs),
  customers: many(customers),
}));
