/**
 * Applies the S3 bucket policy to allow public reads on logos/*.
 * Run automatically during build: `npx tsx scripts/setup-s3.ts`
 * Safe to run multiple times (idempotent).
 */
import { S3Client, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.AWS_BUCKET_NAME ?? "";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? "";

function isConfigured(): boolean {
  return accessKeyId.length > 0 && !accessKeyId.includes("your_aws");
}

async function main() {
  if (!isConfigured()) {
    console.log("[setup-s3] AWS not configured — skipping bucket policy setup.");
    return;
  }

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadLogos",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucket}/logos/*`,
      },
    ],
  };

  try {
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify(policy),
      })
    );
    console.log(`[setup-s3] Bucket policy applied: public read on ${bucket}/logos/*`);
  } catch (err: unknown) {
    // If bucket policy already exists with different content, this merges/replaces it.
    // Log warning but don't fail the build.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[setup-s3] Could not apply bucket policy: ${msg}`);
  }
}

main();
