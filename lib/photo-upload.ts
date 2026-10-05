import sharp from "sharp";
import { PHOTO_LIMITS } from "./photos";
export async function normalizePhoto(bytes: Buffer) {
  if (!bytes.length || bytes.length > PHOTO_LIMITS.uploadBytes)
    throw new Error("Photo size limit exceeded");
  const image = sharp(bytes, { limitInputPixels: 20000000, animated: false });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format))
    throw new Error("Unsupported photo format");
  const data = await image
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#fff" })
    .jpeg({ quality: 75 })
    .toBuffer();
  if (data.length > PHOTO_LIMITS.uploadBytes)
    throw new Error("Photo size limit exceeded");
  return data;
}
export async function limitedFormData(request: Request) {
  if (!request.body) throw new Error("No upload supplied");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Upload size limit exceeded");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
