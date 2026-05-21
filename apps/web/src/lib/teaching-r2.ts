import { r2Enabled, r2GetObjectText, r2PutObject, r2GetObjectBuffer } from "@/lib/r2";

export type TeachingModuleName = "warmup" | "basic" | "advanced" | "solo";

export function teachingR2KeyPrefix(slug: string): string {
  return `teaching/${slug}`;
}

export function teachingR2KeyModule(slug: string, module: TeachingModuleName): string {
  return `${teachingR2KeyPrefix(slug)}/modules/${module}.json`;
}

export function teachingR2KeyGp5(slug: string, filename: string): string {
  return `${teachingR2KeyPrefix(slug)}/gp5/${filename}`;
}

export function teachingR2KeySourceBaseGp5(slug: string): string {
  return `${teachingR2KeyPrefix(slug)}/source/base.gp5`;
}

export function teachingR2KeyMedia(slug: string, filename: string): string {
  return `${teachingR2KeyPrefix(slug)}/media/${filename}`;
}

export function rewriteTeachingAssetUrls(data: any, slug: string): any {
  const replaceString = (s: string) => {
    const gp5Prefix = `/gp5/${slug}/`;
    const mediaPrefix = `/media/${slug}/`;
    if (s.startsWith(gp5Prefix)) return `/api/teaching/gp5/${slug}/${s.slice(gp5Prefix.length)}`;
    if (s.startsWith(mediaPrefix)) return `/api/teaching/media/${slug}/${s.slice(mediaPrefix.length)}`;
    return s;
  };

  const walk = (v: any): any => {
    if (typeof v === "string") return replaceString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: any = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };

  return walk(data);
}

export async function getTeachingModuleJson(slug: string, module: TeachingModuleName): Promise<any | null> {
  if (!r2Enabled()) return null;
  const text = await r2GetObjectText(teachingR2KeyModule(slug, module)).catch(() => "");
  if (!text) return null;
  const parsed = JSON.parse(text);
  return rewriteTeachingAssetUrls(parsed, slug);
}

export async function putTeachingModuleJson(slug: string, module: TeachingModuleName, data: any): Promise<void> {
  const rewritten = rewriteTeachingAssetUrls(data, slug);
  const body = Buffer.from(JSON.stringify(rewritten), "utf8");
  await r2PutObject(teachingR2KeyModule(slug, module), body, "application/json; charset=utf-8");
}

export async function getTeachingGp5Buffer(slug: string, filename: string): Promise<Buffer | null> {
  if (!r2Enabled()) return null;
  const buf = await r2GetObjectBuffer(teachingR2KeyGp5(slug, filename)).catch(() => null);
  return buf;
}

