import { db } from "@/lib/db";
import { idCounters } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

type CounterName = "customer" | "vehicle" | "driver";

export async function nextId(name: CounterName): Promise<number> {
  const [row] = await db
    .insert(idCounters)
    .values({ name, lastValue: 1 })
    .onConflictDoUpdate({
      target: idCounters.name,
      set: { lastValue: sql`${idCounters.lastValue} + 1` },
    })
    .returning({ lastValue: idCounters.lastValue });
  return row.lastValue;
}

const year = () => new Date().getFullYear();

export async function nextCustomerNumber(): Promise<string> {
  const n = await nextId("customer");
  return `GRS-${year()}-${String(n).padStart(5, "0")}`;
}

export async function nextVehicleNumber(): Promise<string> {
  const n = await nextId("vehicle");
  return `GRS-V-${String(n).padStart(5, "0")}`;
}

export async function nextDriverNumber(): Promise<string> {
  const n = await nextId("driver");
  return `GRS-D-${String(n).padStart(5, "0")}`;
}
