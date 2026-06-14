import assert from "node:assert";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DefaultMJConfig,
  MidjourneyApi,
  resolveImage,
  resolveImages,
  sniffMimeType,
} from "../src";

/**
 * Verification for the unified image input / upload capability.
 *
 * Runs without any real network access (URL and Discord calls are mocked).
 *
 * ```
 * npx tsx test/image.input.test.ts
 * ```
 */

// minimal byte signatures for each format (only magic bytes matter here)
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const BMP = new Uint8Array([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log("  ok  -", name);
  } catch (e) {
    failed++;
    console.error("  FAIL -", name);
    console.error("       ", (e as Error)?.message ?? e);
  }
}

async function rejects(fn: () => Promise<unknown>, match: RegExp) {
  let err: any;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  assert(err, "expected function to throw");
  const message = String(err.message ?? err);
  assert(
    match.test(message),
    `expected error to match ${match}, got: ${message}`
  );
}

const u8 = (a: Uint8Array) => Array.from(a);

async function main() {
  // ---- mime sniffing -------------------------------------------------------
  await test("sniffMimeType detects common formats", () => {
    assert.equal(sniffMimeType(PNG), "image/png");
    assert.equal(sniffMimeType(JPEG), "image/jpeg");
    assert.equal(sniffMimeType(GIF), "image/gif");
    assert.equal(sniffMimeType(BMP), "image/bmp");
    assert.equal(sniffMimeType(WEBP), "image/webp");
    assert.equal(sniffMimeType(new Uint8Array([1, 2, 3, 4])), undefined);
  });

  // ---- resolveImage: in-memory sources ------------------------------------
  await test("resolveImage(Buffer) sniffs mime and normalizes", async () => {
    const r = await resolveImage(Buffer.from(PNG));
    assert.equal(r.mimeType, "image/png");
    assert.equal(r.file_size, PNG.length);
    assert.ok(r.filename.endsWith(".png"), `filename was ${r.filename}`);
    assert.deepEqual(u8(r.data), u8(PNG));
  });

  await test("resolveImage(Uint8Array jpeg) -> image/jpeg", async () => {
    const r = await resolveImage(JPEG);
    assert.equal(r.mimeType, "image/jpeg");
    assert.ok(r.filename.endsWith(".jpg"));
    assert.equal(r.file_size, JPEG.length);
  });

  await test("resolveImage(ArrayBuffer) works", async () => {
    const r = await resolveImage(PNG.slice().buffer);
    assert.equal(r.mimeType, "image/png");
    assert.equal(r.file_size, PNG.length);
  });

  await test("resolveImage(Blob) uses blob.type", async () => {
    const r = await resolveImage(new Blob([PNG], { type: "image/png" }));
    assert.equal(r.mimeType, "image/png");
    assert.equal(r.file_size, PNG.length);
  });

  await test("resolveImage(Blob without type) falls back to sniff", async () => {
    const r = await resolveImage(new Blob([JPEG]));
    assert.equal(r.mimeType, "image/jpeg");
  });

  await test("resolveImage(data URI) decodes base64", async () => {
    const b64 = Buffer.from(PNG).toString("base64");
    const r = await resolveImage(`data:image/png;base64,${b64}`);
    assert.equal(r.mimeType, "image/png");
    assert.deepEqual(u8(r.data), u8(PNG));
  });

  // ---- resolveImage: local file branch ------------------------------------
  await test("resolveImage(local file path) reads file + basename", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mj-img-"));
    try {
      const file = path.join(dir, "cat.png");
      await writeFile(file, Buffer.from(PNG));
      const r = await resolveImage(file);
      assert.equal(r.filename, "cat.png");
      assert.equal(r.mimeType, "image/png");
      assert.equal(r.file_size, PNG.length);
      assert.deepEqual(u8(r.data), u8(PNG));

      // unknown extension -> sniff from bytes
      const file2 = path.join(dir, "image.bin");
      await writeFile(file2, Buffer.from(JPEG));
      const r2 = await resolveImage(file2);
      assert.equal(r2.filename, "image.bin");
      assert.equal(r2.mimeType, "image/jpeg");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // ---- resolveImage: URL branch (mocked) ----------------------------------
  await test("resolveImage(URL) uses mocked fetch", async () => {
    const mockFetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => PNG.slice().buffer,
        headers: {
          get: (k: string) =>
            k.toLowerCase() === "content-type" ? "image/png" : null,
        },
      } as any);
    const r = await resolveImage(
      "https://cdn.example.com/path/to/cat.png?width=10",
      mockFetch
    );
    assert.equal(r.mimeType, "image/png");
    assert.equal(r.filename, "cat.png");
    assert.equal(r.file_size, PNG.length);
  });

  await test("resolveImage(URL) surfaces http errors", async () => {
    const mockFetch = async () =>
      ({ ok: false, status: 404, statusText: "Not Found" } as any);
    await rejects(
      () => resolveImage("https://x.com/missing.png", mockFetch),
      /404/
    );
  });

  // ---- validation / error handling ----------------------------------------
  await test("resolveImage rejects empty / invalid inputs", async () => {
    await rejects(() => resolveImage("" as any), /empty/i);
    await rejects(() => resolveImage("   " as any), /empty/i);
    await rejects(() => resolveImage(null as any), /empty/i);
    await rejects(() => resolveImage(undefined as any), /empty/i);
    await rejects(() => resolveImage(new Uint8Array(0)), /empty/i);
    await rejects(() => resolveImage({} as any), /Unsupported/i);
    await rejects(() => resolveImage(123 as any), /Unsupported/i);
  });

  await test("resolveImage rejects missing file with clear error", async () => {
    await rejects(
      () => resolveImage("/tmp/this-file-should-not-exist-xyz.png"),
      /not found/i
    );
  });

  // ---- resolveImages: count validation ------------------------------------
  await test("resolveImages validates count", async () => {
    await rejects(() => resolveImages([], { min: 1 }), /at least 1/i);
    await rejects(
      () => resolveImages([Buffer.from(PNG), Buffer.from(PNG)], { max: 1 }),
      /at most 1/i
    );
    await rejects(() => resolveImages("nope" as any), /array/i);

    const arr = await resolveImages([Buffer.from(PNG), Buffer.from(JPEG)], {
      min: 1,
      max: 5,
    });
    assert.equal(arr.length, 2);
    assert.equal(arr[0].mimeType, "image/png");
    assert.equal(arr[1].mimeType, "image/jpeg");
  });

  // ---- upload API: unified + legacy regression (mocked Discord) -----------
  const uploadUrl = "https://upload.example/slot";
  const makeApi = () => {
    const calls: { url: string; init?: any }[] = [];
    const fetchMock = async (input: any, init?: any) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/attachments")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            attachments: [
              { id: 7, upload_filename: "abc/def.png", upload_url: uploadUrl },
            ],
          }),
          text: async () => "",
        } as any;
      }
      if (url === uploadUrl) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => "",
        } as any;
      }
      // remote image download
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => PNG.slice().buffer,
        headers: {
          get: (k: string) =>
            k.toLowerCase() === "content-type" ? "image/png" : null,
        },
      } as any;
    };
    const api = new MidjourneyApi({
      ...DefaultMJConfig,
      SalaiToken: "token",
      ChannelId: "channel",
      ServerId: "server",
      fetch: fetchMock as any,
    });
    return { api, calls };
  };

  await test("UploadImage(Buffer) uploads with normalized attachment", async () => {
    const { api, calls } = makeApi();
    const img = await api.UploadImage(Buffer.from(PNG));
    assert.equal(img.id, 7);
    assert.equal(img.upload_filename, "abc/def.png");
    assert.equal(img.filename, "def.png");

    const att = calls.find((c) => c.url.includes("/attachments"));
    assert.ok(att, "attachments request should be made");
    const body = JSON.parse(att!.init.body);
    assert.equal(body.files[0].file_size, PNG.length);
    assert.ok(String(body.files[0].filename).endsWith(".png"));

    const put = calls.find((c) => c.url === uploadUrl);
    assert.ok(put, "upload PUT should be made");
    assert.equal(put!.init.headers["content-type"], "image/png");
  });

  await test("UploadImageByBole (legacy) still works + filename override", async () => {
    const { api, calls } = makeApi();
    const img = await api.UploadImageByBole(
      new Blob([PNG], { type: "image/png" }),
      "custom.png"
    );
    assert.equal(img.upload_filename, "abc/def.png");
    const att = calls.find((c) => c.url.includes("/attachments"));
    const body = JSON.parse(att!.init.body);
    assert.equal(body.files[0].filename, "custom.png");
  });

  await test("UploadImageByUri (legacy) downloads then uploads", async () => {
    const { api, calls } = makeApi();
    const img = await api.UploadImageByUri("https://cdn.example.com/x/cat.png");
    assert.equal(img.upload_filename, "abc/def.png");
    assert.ok(
      calls.some((c) => c.url === "https://cdn.example.com/x/cat.png"),
      "should fetch the image url"
    );
  });

  await test("UploadImages uploads many + validates count", async () => {
    const { api } = makeApi();
    const imgs = await api.UploadImages([Buffer.from(PNG), Buffer.from(JPEG)], {
      min: 2,
      max: 5,
    });
    assert.equal(imgs.length, 2);
    assert.equal(imgs[0].upload_filename, "abc/def.png");

    await rejects(
      () => api.UploadImages([Buffer.from(PNG)], { min: 2 }),
      /at least 2/i
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
