import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getPrices } from "@/lib/utils/settings";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prices = await getPrices();
  return NextResponse.json(prices);
}
