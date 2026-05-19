import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export function vehicleFolderKey(customerId: string, vehicleId: string) {
  return `customers/${customerId}/vehicles/${vehicleId}`;
}

export function driverFolderKey(customerId: string, driverId: string) {
  return `customers/${customerId}/drivers/${driverId}`;
}

export function docFileKey(
  folderKey: string,
  docTypeSlug: string,
  version: "current" | "previous",
  ext: string
) {
  return `${folderKey}/${docTypeSlug}/${version}.${ext}`;
}

export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 900 } // 15 minutes
  );
}

export async function getDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 } // 1 hour
  );
}

export async function deleteFile(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function copyFile(
  sourceKey: string,
  destKey: string
): Promise<void> {
  await r2.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${sourceKey}`,
      Key: destKey,
    })
  );
}

/** Rotate versions: current → previous, delete old previous.
 *  Returns the new current key (caller saves this as the upload target). */
export async function rotateDocumentVersions(
  currentKey: string | null,
  previousKey: string | null
): Promise<void> {
  if (previousKey) {
    await deleteFile(previousKey).catch(() => {});
  }
  if (currentKey) {
    await copyFile(currentKey, previousKey!).catch(() => {});
    await deleteFile(currentKey).catch(() => {});
  }
}

export function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mimeType] ?? "bin";
}
