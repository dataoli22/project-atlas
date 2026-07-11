// Generates real app icons from the single source-of-truth brand SVG (assets/brand/atlas-mark.svg)
// instead of leaving the default Electron icon / no favicon in place. Re-run this whenever the
// brand mark changes: `node scripts/generate-app-icons.mjs`.
import { mkdirSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const sourceSvg = resolve(repoRoot, "assets/brand/atlas-mark.svg");
const svgBuffer = readFileSync(sourceSvg);

async function renderPng(size, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(svgBuffer, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${outPath} (${size}x${size})`);
}

async function main() {
  // Web favicon - Next.js auto-detects app/icon.png and serves it as the site favicon/PWA icon.
  await renderPng(512, resolve(repoRoot, "apps/web/app/icon.png"));
  await renderPng(180, resolve(repoRoot, "apps/web/app/apple-icon.png"));

  // Desktop (electron-builder auto-detects build/icon.png for Linux, build/icon.ico for Windows;
  // macOS .icns needs iconutil, a macOS-only tool, so it's not generated here - see the
  // desktop/build/README.md note this leaves in place).
  const desktopPngSizes = [16, 32, 48, 64, 128, 256, 512];
  const desktopPngPaths = [];
  for (const size of desktopPngSizes) {
    const outPath = resolve(repoRoot, `desktop/build/icon-${size}.png`);
    await renderPng(size, outPath);
    desktopPngPaths.push(outPath);
  }
  await renderPng(512, resolve(repoRoot, "desktop/build/icon.png"));

  const icoBuffer = await pngToIco(desktopPngPaths);
  const icoPath = resolve(repoRoot, "desktop/build/icon.ico");
  mkdirSync(dirname(icoPath), { recursive: true });
  await writeFile(icoPath, icoBuffer);
  console.log(`wrote ${icoPath}`);

  // The per-size PNGs were only needed as pngToIco's input - clean them up so re-running this
  // script doesn't leave stale intermediates lying around next to the real icon.ico/icon.png.
  await Promise.all(desktopPngPaths.map((path) => rm(path)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
