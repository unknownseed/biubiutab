import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outdir = path.resolve(process.cwd(), "dist");

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [path.resolve(process.cwd(), "src/main.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outdir, "main.cjs"),
  external: ["electron"],
});

await build({
  entryPoints: [path.resolve(process.cwd(), "src/preload.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outdir, "preload.cjs"),
  external: ["electron"],
});
