import fs from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';

/** Photo manifest entry with optional display tags */
export interface PhotoEntry {
  filename: string;
  src: string;
  tags: string[];
  alt: string;
}

// Raster photos shown in galleries/hero. SVGs (placeholder art and icons)
// are intentionally excluded so they don't appear in the photo gallery.
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const PHOTOS_DIR = path.join(process.cwd(), 'photos');
const MANIFEST_PATH = path.join(PHOTOS_DIR, 'manifest.json');

interface ManifestFile {
  photos?: Array<{
    filename: string;
    tags?: string[];
    alt?: string;
  }>;
}

/** Recursively collect image files, tracking their containing folder */
function collectImages(dir: string): Array<{ filename: string; folder: string }> {
  const results: Array<{ filename: string; folder: string }> = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectImages(fullPath));
      continue;
    }

    if (!PHOTO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    const folder = path.relative(PHOTOS_DIR, dir);
    results.push({ filename: entry.name, folder });
  }

  return results;
}

/** Derive tag tokens from a folder name, e.g. "landing page" -> ["landing", "page"] */
function tagsFromFolder(folder: string): string[] {
  if (!folder) return [];
  return folder
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Build a photo manifest at build time from the photos/ folder (recursively).
 * Photos are auto-tagged by their containing folder, with manifest.json
 * providing optional overrides (extra tags, alt text) matched by filename.
 */
export function getPhotoManifest(): PhotoEntry[] {
  if (!fs.existsSync(PHOTOS_DIR)) {
    return [];
  }

  let manifestData: ManifestFile = { photos: [] };
  if (fs.existsSync(MANIFEST_PATH)) {
    manifestData = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as ManifestFile;
  }

  const overrides = new Map(
    (manifestData.photos ?? []).map((entry) => [entry.filename, entry])
  );

  const images = collectImages(PHOTOS_DIR).sort((a, b) =>
    a.filename.localeCompare(b.filename)
  );

  return images.map(({ filename, folder }, index) => {
    const meta = overrides.get(filename);
    const folderTags = tagsFromFolder(folder);
    const tags = Array.from(new Set([...folderTags, ...(meta?.tags ?? [])]));

    return {
      filename,
      src: `/photos/${filename}`,
      tags,
      alt: meta?.alt ?? `Caleb and Emma — photo ${index + 1}`,
    };
  });
}

/** Bench hero — manifest.json marks this file with the `landing` tag */
const HERO_FILENAME = 'ProposalCalebandEmaa1279.jpg';

/** Return the main hero photo (manifest `landing` tag wins over folder auto-tags) */
export function getLandingPhoto(photos: PhotoEntry[]): PhotoEntry | null {
  if (fs.existsSync(MANIFEST_PATH)) {
    const manifestData = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as ManifestFile;
    const designated = manifestData.photos?.find((entry) => entry.tags?.includes('landing'));
    if (designated) {
      const match = photos.find((photo) => photo.filename === designated.filename);
      if (match) return match;
    }
  }

  const byFilename = photos.find((photo) => photo.filename === HERO_FILENAME);
  if (byFilename) return byFilename;

  return photos.find((photo) => photo.tags.includes('landing')) ?? photos[0] ?? null;
}

/** Proposal photos for the hero text panel (same folder as landing, minus the main hero shot) */
export function getHeroPanelPhotos(
  photos: PhotoEntry[],
  landingPhoto: PhotoEntry | null,
  limit = 6
): PhotoEntry[] {
  return getDecorPhotoPool(photos, landingPhoto).slice(0, limit);
}

const ABOUT_US_DIR = path.join(PHOTOS_DIR, 'about us');

/** Photos from the `photos/about us/` folder (auto-tagged `about`) */
export function getAboutUsPhotos(photos: PhotoEntry[]): PhotoEntry[] {
  return photos.filter((photo) => photo.tags.includes('about'));
}

/** Resolve source file for an about-us photo (folder scan, then flat public copy) */
function aboutUsSourcePath(filename: string): string | null {
  const inAlbum = path.join(ABOUT_US_DIR, filename);
  if (fs.existsSync(inAlbum)) return inAlbum;

  const inPublic = path.join(process.cwd(), 'public', 'photos', filename);
  if (fs.existsSync(inPublic)) return inPublic;

  return null;
}

/** Best available capture date from EXIF, else file modified time */
async function photoTakenTime(filename: string): Promise<number> {
  const filePath = aboutUsSourcePath(filename);
  if (!filePath) return 0;

  try {
    const exif = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    });
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate;
    if (raw) {
      const ms = new Date(raw).getTime();
      if (!Number.isNaN(ms)) return ms;
    }
  } catch {
    /* fall back to file mtime */
  }

  return fs.statSync(filePath).mtimeMs;
}

/** About-us album sorted oldest → newest using photo metadata */
export async function getAboutUsPhotosChronological(
  photos: PhotoEntry[]
): Promise<PhotoEntry[]> {
  const about = getAboutUsPhotos(photos);
  const dated = await Promise.all(
    about.map(async (photo) => ({
      photo,
      time: await photoTakenTime(photo.filename),
    }))
  );

  return dated.sort((a, b) => a.time - b.time).map(({ photo }) => photo);
}

/** All proposal shots usable for side decorations (landing folder, excluding the hero image) */
export function getDecorPhotoPool(
  photos: PhotoEntry[],
  landingPhoto: PhotoEntry | null
): PhotoEntry[] {
  return photos
    .filter((photo) => photo.filename !== landingPhoto?.filename)
    .filter((photo) => photo.tags.includes('landing'));
}

/** Pick `count` photos from the pool, rotated by a string seed so each page can differ */
export function pickDecorPhotos(
  pool: PhotoEntry[],
  count: number,
  seed: string,
  excludeFilenames: string[] = []
): PhotoEntry[] {
  const filtered = pool.filter(
    (photo) => !excludeFilenames.some((name) => photo.filename.includes(name))
  );
  if (filtered.length === 0 || count <= 0) return [];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  const start = Math.abs(hash) % filtered.length;
  return Array.from({ length: count }, (_, i) => filtered[(start + i) % filtered.length]);
}

/** Pick decor photos in a fixed order by filename fragment */
export function pickDecorByIds(pool: PhotoEntry[], ids: string[]): PhotoEntry[] {
  return ids
    .map((id) => pool.find((photo) => photo.filename.includes(id)))
    .filter((photo): photo is PhotoEntry => !!photo);
}

export interface DecorPin {
  side: 'left' | 'right';
  index: number;
  /** Partial match on filename, e.g. "1718" */
  filename: string;
}

/** Force specific photos into side-decor slots (dedupes if the photo appears elsewhere) */
export function pinDecorPhotos(
  picked: PhotoEntry[],
  perSide: number,
  pins: DecorPin[],
  pool: PhotoEntry[]
): PhotoEntry[] {
  if (pins.length === 0) return picked;

  const result = [...picked];

  for (const pin of pins) {
    const pinned = pool.find((photo) => photo.filename.includes(pin.filename));
    if (!pinned) continue;

    const slot = pin.side === 'left' ? pin.index : perSide + pin.index;
    if (slot < 0 || slot >= result.length) continue;

    for (let i = 0; i < result.length; i++) {
      if (i !== slot && result[i].filename === pinned.filename) {
        const replacement = pool.find(
          (photo) =>
            photo.filename !== pinned.filename &&
            !result.some((entry, j) => j !== i && entry.filename === photo.filename)
        );
        if (replacement) result[i] = replacement;
      }
    }

    result[slot] = pinned;
  }

  return result;
}
