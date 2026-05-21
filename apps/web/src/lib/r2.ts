import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireEnv } from "@/lib/env";
import { Readable } from "node:stream";

let _client: S3Client | null = null;

export function r2BucketName(): string {
  return (process.env.CLOUDFLARE_BUCKET_NAME || "biubiutab-uploads").trim() || "biubiutab-uploads";
}

export function r2PublicDomain(): string {
  const v = (process.env.CLOUDFLARE_PUBLIC_DOMAIN || "").trim();
  return v.replace(/\/$/, "");
}

export function r2Enabled(): boolean {
  return !!((process.env.CLOUDFLARE_ACCOUNT_ID || "").trim() && (process.env.CLOUDFLARE_ACCESS_KEY_ID || "").trim() && (process.env.CLOUDFLARE_SECRET_ACCESS_KEY || "").trim());
}

export function r2Client(): S3Client {
  if (_client) return _client;
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = requireEnv("CLOUDFLARE_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("CLOUDFLARE_SECRET_ACCESS_KEY");
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export function r2PublicUrl(key: string): string {
  const d = r2PublicDomain();
  return d ? `${d}/${key.replace(/^\//, "")}` : key;
}

async function readableToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.from([]);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  if (typeof (body as any).getReader === "function") {
    const reader = (body as any).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }
  return Buffer.from([]);
}

export async function r2PutObject(key: string, body: Uint8Array | Buffer, contentType?: string): Promise<void> {
  const cmd = new PutObjectCommand({
    Bucket: r2BucketName(),
    Key: key.replace(/^\//, ""),
    Body: body,
    ContentType: contentType || "application/octet-stream",
  });
  await r2Client().send(cmd);
}

export async function r2GetObjectBuffer(key: string): Promise<Buffer> {
  const cmd = new GetObjectCommand({
    Bucket: r2BucketName(),
    Key: key.replace(/^\//, ""),
  });
  const res = await r2Client().send(cmd);
  return readableToBuffer(res.Body as any);
}

export async function r2GetObjectText(key: string): Promise<string> {
  const buf = await r2GetObjectBuffer(key);
  return buf.toString("utf8");
}

