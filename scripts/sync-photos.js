#!/usr/bin/env node
/**
 * Sync photos from /photos (including subfolders) to /public/photos.
 * Raster images are resized to 400/800/1600px WebP variants — originals
 * stay in photos/ and are not deployed. SVGs are copied as-is.
 * Run automatically before dev and build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'photos');
const dest = path.join(root, 'public', 'photos');

const SKIP = new Set(['manifest.json']);
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SVG_EXTENSION = '.svg';
const VARIANT_WIDTHS = [400, 800, 1600];
const WEBP_QUALITY = 85;

/** Recursively collect image file paths under a directory */
function collectImages(dir) {
  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectImages(fullPath));
      continue;
    }

    if (SKIP.has(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!RASTER_EXTENSIONS.has(ext) && ext !== SVG_EXTENSION) continue;

    results.push(fullPath);
  }

  return results;
}

function variantFilename(basename, width) {
  const stem = basename.replace(/\.[^.]+$/, '');
  return `${stem}.w${width}.webp`;
}

function isVariantStale(sourcePath, variantPath) {
  if (!fs.existsSync(variantPath)) return true;
  return fs.statSync(sourcePath).mtimeMs > fs.statSync(variantPath).mtimeMs;
}

/** Variant tiers to emit — always 400w; 800w if wider than 400px; 1600w if wider than 800px */
function widthsForSource(sourceWidth) {
  const tiers = [400];
  if (sourceWidth > 400) tiers.push(800);
  if (sourceWidth > 800) tiers.push(1600);
  return tiers;
}

async function generateVariants(sourcePath, basename) {
  const metadata = await sharp(sourcePath).metadata();
  const sourceWidth = metadata.width ?? 0;
  const outputs = [];
  let regenerated = 0;

  for (const width of widthsForSource(sourceWidth)) {
    const targetWidth = Math.min(width, sourceWidth);
    const outName = variantFilename(basename, width);
    const outPath = path.join(dest, outName);

    if (!isVariantStale(sourcePath, outPath)) {
      outputs.push(outName);
      continue;
    }

    await sharp(sourcePath)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath);

    fs.chmodSync(outPath, 0o644);
    outputs.push(outName);
    regenerated += 1;
  }

  return { outputs, regenerated };
}

async function syncPhotos() {
  fs.mkdirSync(dest, { recursive: true });

  if (!fs.existsSync(source)) {
    console.log('No photos/ directory found — skipping sync.');
    return;
  }

  const images = collectImages(source);
  const expectedFiles = new Set();
  let variantCount = 0;

  for (const imagePath of images) {
    const basename = path.basename(imagePath);
    const ext = path.extname(basename).toLowerCase();

    if (ext === SVG_EXTENSION) {
      fs.copyFileSync(imagePath, path.join(dest, basename));
      expectedFiles.add(basename);
      continue;
    }

    const { outputs, regenerated } = await generateVariants(imagePath, basename);
    for (const name of outputs) expectedFiles.add(name);
    variantCount += regenerated;
  }

  // Remove stale files (deleted sources, old full-res copies, outdated variants)
  let removed = 0;
  if (fs.existsSync(dest)) {
    for (const entry of fs.readdirSync(dest)) {
      if (expectedFiles.has(entry)) continue;
      fs.unlinkSync(path.join(dest, entry));
      removed += 1;
    }
  }

  const summary = [
    `Optimized ${images.length} photo(s) → WebP variants in public/photos/`,
    variantCount > 0 ? `(${variantCount} variant(s) regenerated)` : '(all variants up to date)',
    removed > 0 ? `removed ${removed} stale file(s)` : null,
  ]
    .filter(Boolean)
    .join(' ');

  mirrorToDist(expectedFiles);

  console.log(summary);
}

/** Keep dist/photos in sync for netlify dev (serves publish dir alongside Astro) */
function mirrorToDist(expectedFiles) {
  const distPhotos = path.join(root, 'dist', 'photos');
  if (!fs.existsSync(path.join(root, 'dist'))) return;

  fs.mkdirSync(distPhotos, { recursive: true });

  for (const entry of expectedFiles) {
    const src = path.join(dest, entry);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(distPhotos, entry));
    fs.chmodSync(path.join(distPhotos, entry), 0o644);
  }

  for (const entry of fs.readdirSync(distPhotos)) {
    if (expectedFiles.has(entry)) continue;
    fs.unlinkSync(path.join(distPhotos, entry));
  }
}

syncPhotos().catch((err) => {
  console.error('Photo sync failed:', err);
  process.exit(1);
});
