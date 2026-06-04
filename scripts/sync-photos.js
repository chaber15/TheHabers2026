#!/usr/bin/env node
/**
 * Sync photos from /photos (including subfolders) to /public/photos for
 * static serving. Files are copied flat using their original filename.
 * Run automatically before dev and build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'photos');
const dest = path.join(root, 'public', 'photos');

const SKIP = new Set(['manifest.json']);
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

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
    if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    results.push(fullPath);
  }

  return results;
}

function syncPhotos() {
  fs.mkdirSync(dest, { recursive: true });

  if (!fs.existsSync(source)) {
    console.log('No photos/ directory found — skipping sync.');
    return;
  }

  const images = collectImages(source);
  const syncedNames = new Set(images.map((image) => path.basename(image)));

  for (const image of images) {
    fs.copyFileSync(image, path.join(dest, path.basename(image)));
  }

  // Remove files in public/photos that were deleted from photos/
  let removed = 0;
  if (fs.existsSync(dest)) {
    for (const entry of fs.readdirSync(dest)) {
      if (syncedNames.has(entry)) continue;
      fs.unlinkSync(path.join(dest, entry));
      removed += 1;
    }
  }

  const summary =
    removed > 0
      ? `Synced ${images.length} photo(s) to public/photos/ (removed ${removed} stale file(s))`
      : `Synced ${images.length} photo(s) to public/photos/`;
  console.log(summary);
}

syncPhotos();
