import sharp, { type Metadata } from "sharp";

/**
 * Photo rules for Google Business Profile posts: JPG or PNG, at least 250×250 px,
 * 10 KB–5 MB. We always store a JPEG no larger than 1600 px on the long side.
 */
export const PHOTO_RULES = {
  maxUploadBytes: 4 * 1024 * 1024, // what the browser may send (it resizes first)
  minSide: 250,
  maxSide: 1600,
  minBytes: 10 * 1024,
  maxBytes: 5 * 1024 * 1024,
  inputFormats: ["jpeg", "png", "webp"] as const,
} as const;

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

export interface ProcessedPhoto {
  jpeg: Buffer;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Check and normalise an uploaded photo: turn it the right way up, shrink it to at most
 * 1600 px, and re-encode as JPEG. Re-encoding drops all metadata, including the phone's
 * GPS location, before anything is stored.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length > PHOTO_RULES.maxUploadBytes) {
    throw new PhotoError("That photo is too large. Use one under 4 MB.");
  }
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new PhotoError("That file isn't a photo we can read. Use a JPG or PNG.");
  }
  if (!meta.format || !(PHOTO_RULES.inputFormats as readonly string[]).includes(meta.format)) {
    throw new PhotoError("Use a JPG or PNG photo.");
  }
  // Width/height before rotation; the check is the same either way round.
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < PHOTO_RULES.minSide) {
    throw new PhotoError(
      `That photo is too small. Google needs at least ${PHOTO_RULES.minSide}×${PHOTO_RULES.minSide} pixels.`,
    );
  }

  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: PHOTO_RULES.maxSide,
      height: PHOTO_RULES.maxSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  if (data.length < PHOTO_RULES.minBytes) {
    throw new PhotoError("That photo has too little detail for Google. Use a clearer photo.");
  }
  if (data.length > PHOTO_RULES.maxBytes) {
    throw new PhotoError("That photo is too large even after resizing. Use a different one.");
  }
  return { jpeg: data, width: info.width, height: info.height, bytes: data.length };
}
