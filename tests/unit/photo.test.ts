import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PhotoError, processPhoto } from "@/lib/posts/photo";

/** A noisy test image, so JPEG output isn't suspiciously tiny. */
async function image(width: number, height: number, format: "png" | "jpeg" = "png") {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  return format === "png" ? img.png().toBuffer() : img.jpeg().toBuffer();
}

describe("processPhoto", () => {
  it("shrinks a large photo to 1600 px on the long side and stores JPEG", async () => {
    const out = await processPhoto(await image(2400, 1800));
    expect(out).toMatchObject({ width: 1600, height: 1200 });
    expect((await sharp(out.jpeg).metadata()).format).toBe("jpeg");
    expect(out.bytes).toBe(out.jpeg.length);
  });

  it("keeps small-enough photos at their size", async () => {
    const out = await processPhoto(await image(800, 600, "jpeg"));
    expect(out).toMatchObject({ width: 800, height: 600 });
  });

  it("removes metadata such as the phone's GPS location", async () => {
    const withExif = await sharp(await image(600, 600, "jpeg"))
      .withExif({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processPhoto(withExif);
    expect((await sharp(out.jpeg).metadata()).exif).toBeUndefined();
  });

  it("rejects photos smaller than Google's minimum", async () => {
    await expect(processPhoto(await image(300, 200))).rejects.toThrow(/at least 250×250/);
  });

  it("rejects files that aren't photos", async () => {
    await expect(processPhoto(Buffer.from("not an image at all"))).rejects.toThrow(PhotoError);
  });

  it("rejects uploads over 4 MB before reading them", async () => {
    await expect(processPhoto(Buffer.alloc(4 * 1024 * 1024 + 1))).rejects.toThrow(/under 4 MB/);
  });
});
