export const PHOTO_LIMITS = {
  perMessage: 3,
  perRoom: 12,
  originalBytes: 10 * 1024 * 1024,
  uploadBytes: 512 * 1024,
  pixels: 1280,
} as const;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export type DraftPhoto = {
  name: string;
  preview: string;
  file: File;
  id?: string;
};
export async function preparePhoto(file: File): Promise<DraftPhoto> {
  if (!PHOTO_TYPES.includes(file.type))
    throw new Error("Choose JPG, PNG or WebP room photos.");
  if (file.size > PHOTO_LIMITS.originalBytes)
    throw new Error("Each photo must be 10 MB or smaller.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      PHOTO_LIMITS.pixels / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare this photo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.65, 0.45, 0.3]) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= PHOTO_LIMITS.uploadBytes) break;
    }
    if (!blob || blob.size > PHOTO_LIMITS.uploadBytes)
      throw new Error("This photo is too detailed. Try a smaller version.");
    const prepared = new File([blob], "room-photo.jpg", { type: "image/jpeg" });
    return {
      name: file.name.slice(0, 100),
      preview: URL.createObjectURL(blob),
      file: prepared,
    };
  } finally {
    bitmap.close();
  }
}
