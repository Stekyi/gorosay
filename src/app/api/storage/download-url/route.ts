import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getDownloadUrl } from "@/lib/storage/r2";
import { z } from "zod";

const schema = z.object({ fileKey: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const downloadUrl = await getDownloadUrl(parsed.data.fileKey);
  return NextResponse.json({ downloadUrl });
}
