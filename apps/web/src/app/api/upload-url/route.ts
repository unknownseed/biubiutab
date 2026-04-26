import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();
    
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || "biubiutab-uploads";
    
    if (!accountId || !accessKeyId || !secretAccessKey) {
      return new Response("Missing R2 credentials in environment variables", { status: 500 });
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const ext = filename.split('.').pop() || "bin";
    const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    // 预签名 URL 的有效期设为 3600 秒
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // 如果配置了 R2.dev 域名或自定义域名，前端就可以直接拿去试听
    const publicDomain = process.env.CLOUDFLARE_PUBLIC_DOMAIN || "";
    const publicUrl = publicDomain ? `${publicDomain}/${key}` : "";

    return Response.json({ url, key, publicUrl });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return new Response("Failed to generate URL", { status: 500 });
  }
}
