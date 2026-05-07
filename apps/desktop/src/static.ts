import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

function contentType(p: string) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".woff2")) return "font/woff2";
  if (p.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

export async function startStaticServer(distDir: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      const rel = u.pathname === "/" ? "/index.html" : u.pathname;
      const filePath = path.join(distDir, rel);
      const buf = await readFile(filePath).catch(async () => {
        const looksLikeAsset = /\.[a-zA-Z0-9]+$/.test(rel);
        if (looksLikeAsset) throw new Error("not found");
        return await readFile(path.join(distDir, "index.html"));
      });
      res.statusCode = 200;
      res.setHeader("content-type", contentType(filePath));
      res.end(buf);
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const url = `http://127.0.0.1:${port}`;
  return { url, close: () => server.close() };
}
