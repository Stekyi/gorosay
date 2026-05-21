import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const sql = neon(process.env.DATABASE_URL);

const result = await sql`
  INSERT INTO settings (key, value, updated_at)
  VALUES ('email_smtp_port', '587', NOW())
  ON CONFLICT (key) DO UPDATE SET value = '587', updated_at = NOW()
  RETURNING key, value
`;

console.log("Updated:", result);
