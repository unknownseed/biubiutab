import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { filename, contentType, size } = (await req.json().catch(() => ({}))) as {
      filename?: string;
      contentType?: string;
      size?: number;
    };
    if (!filename || typeof filename !== "string") return new Response("bad request", { status: 400 });
    if (typeof size === "number" && size > 50 * 1024 * 1024) return new Response("file too large", { status: 413 });
    
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

    const ext = (filename.split(".").pop() || "").toLowerCase();
    const allowed: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
    };
    const resolvedType = allowed[ext];
    if (!resolvedType) return new Response("unsupported file type", { status: 400 });
    if (contentType && typeof contentType === "string" && !contentType.startsWith("audio/")) {
      return new Response("unsupported contentType", { status: 400 });
    }
    const key = `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: resolvedType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 600 });
    
    // 如果配置了 R2.dev 域名或自定义域名，前端就可以直接拿去试听
    const publicDomain = process.env.CLOUDFLARE_PUBLIC_DOMAIN || "";
    const publicUrl = publicDomain ? `${publicDomain}/${key}` : "";

    return Response.json({ url, key, publicUrl });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return new Response("Failed to generate URL", { status: 500 });
  }
}
