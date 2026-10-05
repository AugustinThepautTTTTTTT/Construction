import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizePhoto, limitedFormData } from "../lib/photo-upload";
test("photos are validated, resized, and stripped of original metadata before saving", async () => {
  const original = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "green" },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: "Private camera owner" } })
    .toBuffer();
  const data = await normalizePhoto(original),
    metadata = await sharp(data).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 640);
  assert.equal(metadata.exif, undefined);
  assert.ok(data.length < 512 * 1024);
  await assert.rejects(normalizePhoto(Buffer.from("not an image")));
  await assert.rejects(
    normalizePhoto(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
      ),
    ),
    /Unsupported/,
  );
  await assert.rejects(
    normalizePhoto(Buffer.alloc(512 * 1024 + 1)),
    /size limit/,
  );
});
test("chunked uploads cannot bypass the server body limit without Content-Length", async () => {
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(1024 * 1024));
      c.enqueue(new Uint8Array(1024 * 1024 + 1));
      c.close();
    },
  });
  const request = new Request("https://roomwise.test/api/photos", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(limitedFormData(request), /size limit/);
  const form = new FormData();
  form.append("projectId", "test");
  form.append(
    "photos",
    new Blob(["photo"], { type: "image/jpeg" }),
    "room.jpg",
  );
  const parsed = await limitedFormData(
    new Request("https://roomwise.test/api/photos", {
      method: "POST",
      body: form,
    }),
  );
  assert.equal(parsed.get("projectId"), "test");
  assert.equal((parsed.get("photos") as File).size, 5);
});
