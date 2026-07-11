// Generates real app icons from the single source-of-truth brand SVG (assets/brand/atlas-mark.svg)
// instead of leaving the default Electron icon / no favicon in place. Re-run this whenever the
// brand mark changes: `node scripts/generate-app-icons.mjs`.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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

  // Desktop: a single 512x512 PNG. electron-builder generates the platform-specific icon
  // formats (.ico for Windows, iconset for macOS) from this itself at build time - deliberately
  // NOT hand-building a .ico here. A hand-built multi-resolution .ico hit two conflicting real
  // constraints found by actually running a real build: electron-builder's own exe-icon step
  // requires a >=256x256 frame, but the NSIS installer this repo builds with (makensis 3.0.4.1)
  // fails to load a PNG-compressed 256px ICO frame for its MUI_ICON ("invalid icon file size").
  // Letting electron-builder's own icon pipeline generate the .ico from a plain PNG avoids the
  // conflict entirely - see desktop/package.json's win.icon.
  await renderPng(512, resolve(repoRoot, "desktop/build/icon.png"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
