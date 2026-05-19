import { NextRequest, NextResponse } from "next/server";
import { runNotificationJob } from "@/lib/notifications/scheduler";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runNotificationJob();
  return NextResponse.json(result);
}
