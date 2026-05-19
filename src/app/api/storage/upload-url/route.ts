import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getUploadUrl, extFromMime } from "@/lib/storage/r2";
import { z } from "zod";

const schema = z.object({
  entityType: z.enum(["vehicle", "driver"]),
  entityId: z.string().uuid(),
  customerId: z.string().uuid(),
  docTypeSlug: z.string().min(1),
  mimeType: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { entityType, entityId, customerId, docTypeSlug, mimeType } = parsed.data;
  const ext = extFromMime(mimeType);
  const folderBase =
    entityType === "vehicle"
      ? `customers/${customerId}/vehicles/${entityId}`
      : `customers/${customerId}/drivers/${entityId}`;

  const fileKey = `${folderBase}/${docTypeSlug}/current.${ext}`;
  const uploadUrl = await getUploadUrl(fileKey, mimeType);

  return NextResponse.json({ uploadUrl, fileKey });
}
