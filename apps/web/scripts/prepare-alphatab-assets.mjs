import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function copyIfExists(src, dest) {
  try {
    await stat(src);
  } catch {
    return false;
  }
  await ensureDir(path.dirname(dest));
  await copyFile(src, dest);
  return true;
}

async function copyDir(srcDir, destDir) {
  await ensureDir(destDir);
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const src = path.join(srcDir, e.name);
    const dest = path.join(destDir, e.name);
    if (e.isDirectory()) {
      await copyDir(src, dest);
    } else if (e.isFile()) {
      await ensureDir(path.dirname(dest));
      await copyFile(src, dest);
    }
  }
}

async function main() {
  const projectRoot = process.cwd();
  const distDir = path.join(projectRoot, "node_modules", "@coderline", "alphatab", "dist");
  const publicDir = path.join(projectRoot, "public", "alphatab");

  await ensureDir(publicDir);

  try {
    const entries = await readdir(distDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!/^alphaTab.*\.(js|mjs)$/.test(e.name)) continue;
      await copyIfExists(path.join(distDir, e.name), path.join(publicDir, e.name));
    }
  } catch {}

  await copyDir(path.join(distDir, "font"), path.join(publicDir, "font"));
  await copyDir(path.join(distDir, "soundfont"), path.join(publicDir, "soundfont"));
}

await main();
