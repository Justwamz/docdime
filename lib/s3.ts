import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME ?? "docdime-pdfs";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function isS3Configured(): boolean {
  const key = process.env.AWS_ACCESS_KEY_ID ?? "";
  return key.length > 0 && !key.includes("your_aws");
}

export async function uploadPDF(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string = "application/pdf"
): Promise<string> {
  // If AWS is not configured, embed PDF as base64 data URL so it works without S3
  if (!isS3Configured()) {
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:application/pdf;base64,${base64}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });

  await s3Client.send(command);

  // Return presigned URL valid for 7 days
  const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 });

  return url;
}

export async function deletePDF(key: string): Promise<void> {
  if (!isS3Configured()) {
    return;
  }

  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3Client.send(command);
}

export function getPDFKey(userId: string, docNumber: string): string {
  return `pdfs/${userId}/${docNumber}-${Date.now()}.pdf`;
}
