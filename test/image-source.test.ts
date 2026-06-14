import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  resolveImageSource,
  resolveImageSources,
  validateResolvedImage,
  mimeFromFilename,
  ImageSource,
} from "../src/image-source";

// A minimal fetch stub that simulates downloading an image from a URL.
function createMockFetch(
  body: ArrayBuffer | Buffer,
  contentType = "image/png",
  status = 200
): typeof fetch {
  return (async (_url: any) => {
    if (status >= 400) {
      return {
        ok: false,
        status,
        statusText: "Not Found",
        headers: new Map([["content-type", contentType]]) as any,
        arrayBuffer: async () => body,
        text: async () => "error",
      } as any;
    }
    return {
      ok: true,
      status,
      headers: new Map([["content-type", contentType]]) as any,
      arrayBuffer: async () => body,
    } as any;
  }) as any;
}

// ─── mimeFromFilename ─────────────────────────────────────────────────────

describe("mimeFromFilename", () => {
  it("returns image/png for .png", () => {
    assert.equal(mimeFromFilename("photo.png"), "image/png");
  });
  it("returns image/jpeg for .jpg", () => {
    assert.equal(mimeFromFilename("photo.jpg"), "image/jpeg");
  });
  it("returns image/jpeg for .jpeg", () => {
    assert.equal(mimeFromFilename("photo.jpeg"), "image/jpeg");
  });
  it("returns image/gif for .gif", () => {
    assert.equal(mimeFromFilename("anim.gif"), "image/gif");
  });
  it("returns image/webp for .webp", () => {
    assert.equal(mimeFromFilename("photo.webp"), "image/webp");
  });
  it("returns image/bmp for .bmp", () => {
    assert.equal(mimeFromFilename("photo.bmp"), "image/bmp");
  });
  it("falls back to image/png for unknown extension", () => {
    assert.equal(mimeFromFilename("file.xyz"), "image/png");
  });
  it("handles paths with directories", () => {
    assert.equal(
      mimeFromFilename("/some/path/to/photo.jpeg"),
      "image/jpeg"
    );
  });
});

// ─── resolveImageSource ───────────────────────────────────────────────────

describe("resolveImageSource", () => {
  const sampleData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
  const mockFetch = createMockFetch(sampleData, "image/png");

  // --- URL input ---
  describe("URL input", () => {
    it("fetches remote URL and resolves image data", async () => {
      const result = await resolveImageSource(
        "https://example.com/photo.png",
        mockFetch
      );
      assert.equal(result.mimeType, "image/png");
      assert.equal(result.filename, "photo.png");
      assert.ok(result.data.byteLength > 0);
    });

    it("extracts filename from URL path", async () => {
      const result = await resolveImageSource(
        "https://cdn.example.com/images/cat.jpg",
        createMockFetch(sampleData, "image/jpeg")
      );
      assert.equal(result.filename, "cat.jpg");
      assert.equal(result.mimeType, "image/jpeg");
    });

    it("falls back to image.png when URL has no extension", async () => {
      const result = await resolveImageSource(
        "https://example.com/images/",
        mockFetch
      );
      assert.equal(result.filename, "image.png");
    });

    it("throws on HTTP error", async () => {
      const failFetch = createMockFetch(sampleData, "image/png", 404);
      await assert.rejects(
        () =>
          resolveImageSource("https://example.com/missing.png", failFetch),
        /HTTP 404/
      );
    });

    it("throws on fetch network error", async () => {
      const netErrFetch = (async () => {
        throw new Error("ECONNREFUSED");
      }) as any;
      await assert.rejects(
        () =>
          resolveImageSource(
            "https://example.com/fail.png",
            netErrFetch
          ),
        /ECONNREFUSED/
      );
    });
  });

  // --- Local file input ---
  describe("local file input", () => {
    const testImagePath = path.resolve(__dirname, "../images/ali.png");

    it("reads a local file and resolves image data", async () => {
      const result = await resolveImageSource(testImagePath, mockFetch);
      assert.equal(result.filename, "ali.png");
      assert.equal(result.mimeType, "image/png");
      assert.ok(result.data.byteLength > 0);
    });

    it("throws on non-existent file", async () => {
      await assert.rejects(
        () => resolveImageSource("/no/such/file.png", mockFetch),
        /not found/i
      );
    });

    it("throws on directory path", async () => {
      await assert.rejects(
        () => resolveImageSource(path.resolve(__dirname, "../images"), mockFetch),
        /not a file/i
      );
    });

    it("throws on empty string", async () => {
      await assert.rejects(
        () => resolveImageSource("", mockFetch),
        /empty/i
      );
    });

    it("throws on whitespace-only string", async () => {
      await assert.rejects(
        () => resolveImageSource("   ", mockFetch),
        /empty/i
      );
    });
  });

  // --- Blob input ---
  describe("Blob input", () => {
    it("resolves a Blob with correct MIME type", async () => {
      const blob = new Blob([sampleData], { type: "image/jpeg" });
      const result = await resolveImageSource(blob, mockFetch);
      assert.equal(result.mimeType, "image/jpeg");
      assert.ok(result.data.byteLength > 0);
      assert.ok(result.filename.startsWith("image_"));
    });

    it("throws on empty Blob", async () => {
      const emptyBlob = new Blob([], { type: "image/png" });
      await assert.rejects(
        () => resolveImageSource(emptyBlob, mockFetch),
        /empty/i
      );
    });

    it("defaults to image/png when Blob type is empty", async () => {
      const blob = new Blob([sampleData]);
      // Note: new Blob() without type has type = ""
      const result = await resolveImageSource(blob, mockFetch);
      assert.equal(result.mimeType, "image/png");
    });
  });

  // --- Buffer input ---
  describe("Buffer input", () => {
    it("resolves a Node.js Buffer", async () => {
      const buf = Buffer.from(sampleData);
      const result = await resolveImageSource(buf, mockFetch);
      assert.equal(result.mimeType, "image/png");
      assert.ok(result.data.byteLength > 0);
      assert.ok(result.filename.startsWith("image_"));
    });

    it("throws on empty Buffer", async () => {
      const emptyBuf = Buffer.alloc(0);
      await assert.rejects(
        () => resolveImageSource(emptyBuf, mockFetch),
        /empty/i
      );
    });
  });

  // --- Error cases ---
  describe("invalid inputs", () => {
    it("throws on null", async () => {
      await assert.rejects(
        () => resolveImageSource(null as any, mockFetch),
        /required/
      );
    });

    it("throws on undefined", async () => {
      await assert.rejects(
        () => resolveImageSource(undefined as any, mockFetch),
        /required/
      );
    });

    it("throws on number", async () => {
      await assert.rejects(
        () => resolveImageSource(42 as any, mockFetch),
        /Unsupported/
      );
    });

    it("throws on object", async () => {
      await assert.rejects(
        () => resolveImageSource({} as any, mockFetch),
        /Unsupported/
      );
    });
  });
});

// ─── resolveImageSources (batch) ──────────────────────────────────────────

describe("resolveImageSources", () => {
  const sampleData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const mockFetch = createMockFetch(sampleData, "image/png");

  it("resolves multiple sources", async () => {
    const sources: ImageSource[] = [
      "https://example.com/a.png",
      Buffer.from(sampleData),
    ];
    const results = await resolveImageSources(sources, mockFetch);
    assert.equal(results.length, 2);
  });

  it("throws when count is below minimum", async () => {
    await assert.rejects(
      () => resolveImageSources([], mockFetch, { min: 1 }),
      /at least 1/
    );
  });

  it("throws when count exceeds maximum", async () => {
    const sources: ImageSource[] = [
      Buffer.from([1]),
      Buffer.from([2]),
      Buffer.from([3]),
    ];
    await assert.rejects(
      () => resolveImageSources(sources, mockFetch, { max: 2 }),
      /at most 2/
    );
  });

  it("throws on non-array input", async () => {
    await assert.rejects(
      () => resolveImageSources("not-array" as any, mockFetch),
      /array/
    );
  });
});

// ─── validateResolvedImage ────────────────────────────────────────────────

describe("validateResolvedImage", () => {
  it("passes for a valid resolved image", () => {
    assert.doesNotThrow(() =>
      validateResolvedImage({
        data: new ArrayBuffer(10),
        mimeType: "image/png",
        filename: "test.png",
      })
    );
  });

  it("throws on empty data", () => {
    assert.throws(
      () =>
        validateResolvedImage({
          data: new ArrayBuffer(0),
          mimeType: "image/png",
          filename: "test.png",
        }),
      /empty/
    );
  });

  it("throws on missing MIME type", () => {
    assert.throws(
      () =>
        validateResolvedImage({
          data: new ArrayBuffer(10),
          mimeType: "",
          filename: "test.png",
        }),
      /MIME/
    );
  });

  it("throws on unsupported MIME type", () => {
    assert.throws(
      () =>
        validateResolvedImage({
          data: new ArrayBuffer(10),
          mimeType: "text/html",
          filename: "test.html",
        }),
      /unsupported/i
    );
  });

  it("throws on missing filename", () => {
    assert.throws(
      () =>
        validateResolvedImage({
          data: new ArrayBuffer(10),
          mimeType: "image/png",
          filename: "",
        }),
      /filename/
    );
  });

  it("uses custom label in error messages", () => {
    assert.throws(
      () =>
        validateResolvedImage(
          {
            data: new ArrayBuffer(0),
            mimeType: "image/png",
            filename: "test.png",
          },
          "target image"
        ),
      /target image/
    );
  });
});
