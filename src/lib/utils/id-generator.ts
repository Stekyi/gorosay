import { db } from "@/lib/db";
import { idCounters } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

type CounterName = "customer" | "vehicle" | "driver";

async function nextId(tenantId: string, name: CounterName): Promise<number> {
  const [row] = await db
    .insert(idCounters)
    .values({ tenantId, name, lastValue: 1 })
    .onConflictDoUpdate({
      target: [idCounters.tenantId, idCounters.name],
      set: { lastValue: sql`${idCounters.lastValue} + 1` },
    })
    .returning({ lastValue: idCounters.lastValue });
  return row.lastValue;
}

const year = () => new Date().getFullYear();

export async function nextCustomerNumber(tenantId: string, tenantCode: string): Promise<string> {
  const n = await nextId(tenantId, "customer");
  return `${tenantCode}-${year()}-${String(n).padStart(5, "0")}`;
}

export async function nextVehicleNumber(tenantId: string, tenantCode: string): Promise<string> {
  const n = await nextId(tenantId, "vehicle");
  return `${tenantCode}-V-${String(n).padStart(5, "0")}`;
}

export async function nextDriverNumber(tenantId: string, tenantCode: string): Promise<string> {
  const n = await nextId(tenantId, "driver");
  return `${tenantCode}-D-${String(n).padStart(5, "0")}`;
}
