import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const sql = neon(process.env.DATABASE_URL);

// ── Trigger: insert welcome alert when a customer is created ──────────────────
await sql`
  CREATE OR REPLACE FUNCTION fn_alert_on_customer_insert()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO alerts (type, recipient_email, recipient_name, payload, status)
    VALUES (
      'welcome',
      NULLIF(TRIM(NEW.email), ''),
      NEW.name,
      jsonb_build_object(
        'customer_id',     NEW.id::text,
        'customer_number', COALESCE(NEW.customer_number, ''),
        'name',            NEW.name,
        'email',           NEW.email
      ),
      'pending'
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

await sql`DROP TRIGGER IF EXISTS trg_alert_customer_insert ON customers`;
await sql`
  CREATE TRIGGER trg_alert_customer_insert
    AFTER INSERT ON customers
    FOR EACH ROW EXECUTE FUNCTION fn_alert_on_customer_insert()
`;

// ── Trigger: insert doc_upload alert when a document is created ───────────────
await sql`
  CREATE OR REPLACE FUNCTION fn_alert_on_document_insert()
  RETURNS TRIGGER AS $$
  DECLARE
    v_customer_email TEXT;
    v_customer_name  TEXT;
    v_doc_type_name  TEXT;
  BEGIN
    -- Only alert on version=1 (current) inserts
    IF NEW.version != 1 THEN
      RETURN NEW;
    END IF;

    -- Resolve customer through vehicle or driver
    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT c.email, c.name
        INTO v_customer_email, v_customer_name
        FROM vehicles v
        JOIN customers c ON v.customer_id = c.id
       WHERE v.id = NEW.vehicle_id
       LIMIT 1;
    ELSIF NEW.driver_id IS NOT NULL THEN
      SELECT c.email, c.name
        INTO v_customer_email, v_customer_name
        FROM drivers d
        JOIN customers c ON d.customer_id = c.id
       WHERE d.id = NEW.driver_id
       LIMIT 1;
    END IF;

    -- Resolve document type name
    SELECT name INTO v_doc_type_name
      FROM document_types
     WHERE id = NEW.document_type_id
     LIMIT 1;

    INSERT INTO alerts (type, recipient_email, recipient_name, payload, status)
    VALUES (
      'doc_upload',
      NULLIF(TRIM(COALESCE(v_customer_email, '')), ''),
      COALESCE(v_customer_name, ''),
      jsonb_build_object(
        'doc_type_name', COALESCE(v_doc_type_name, 'Document'),
        'entity_ref',    COALESCE(NEW.entity_ref, ''),
        'file_key',      NEW.file_key,
        'issue_date',    NEW.issue_date::text,
        'expiry_date',   NEW.expiry_date::text
      ),
      'pending'
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

await sql`DROP TRIGGER IF EXISTS trg_alert_document_insert ON documents`;
await sql`
  CREATE TRIGGER trg_alert_document_insert
    AFTER INSERT ON documents
    FOR EACH ROW EXECUTE FUNCTION fn_alert_on_document_insert()
`;

console.log("✓ Triggers created: trg_alert_customer_insert, trg_alert_document_insert");
