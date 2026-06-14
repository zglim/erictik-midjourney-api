import * as fs from "fs";
import * as path from "path";

/**
 * Supported image input sources:
 * - `string` starting with `http://` or `https://` → remote URL
 * - `string` otherwise → local file path
 * - `Blob` → browser / Node 18+ Blob
 * - `Buffer` → Node.js Buffer
 */
export type ImageSource = string | Blob | Buffer;

/**
 * Normalized image data ready for Discord upload.
 */
export interface ResolvedImage {
  /** Raw binary data */
  data: ArrayBuffer;
  /** MIME type, e.g. "image/png" */
  mimeType: string;
  /** Suggested filename for the upload */
  filename: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SUPPORTED_MIME_PREFIXES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
];

/**
 * Infer MIME type from a filename extension.
 */
export function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    default:
      return "image/png"; // safe fallback
  }
}

/**
 * Derive a reasonable filename from a URL or fall back to a default.
 */
function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop();
    if (base && /\.\w+$/.test(base)) {
      return base;
    }
  } catch {
    // not a valid URL, ignore
  }
  return "image.png";
}

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

// ─── Resolvers ──────────────────────────────────────────────────────────────

async function resolveFromUrl(
  url: string,
  fetchFn: typeof fetch
): Promise<ResolvedImage> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (err: any) {
    throw new Error(
      `Failed to fetch image from URL "${url}": ${err?.message ?? err}`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image from URL "${url}": HTTP ${response.status} ${response.statusText}`
    );
  }
  const data = await response.arrayBuffer();
  const mimeType =
    response.headers.get("content-type")?.split(";")[0].trim() ||
    mimeFromFilename(url);
  const filename = filenameFromUrl(url);
  return { data, mimeType, filename };
}

async function resolveFromLocalFile(
  filePath: string
): Promise<ResolvedImage> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Local file not found: "${resolved}"`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: "${resolved}"`);
  }
  if (stat.size === 0) {
    throw new Error(`File is empty: "${resolved}"`);
  }
  const nodeBuffer = fs.readFileSync(resolved);
  const mimeType = mimeFromFilename(resolved);
  const filename = path.basename(resolved);
  // Convert Node Buffer → ArrayBuffer (copy to avoid shared-buffer issues)
  const ab = new ArrayBuffer(nodeBuffer.length);
  new Uint8Array(ab).set(nodeBuffer);
  return { data: ab, mimeType, filename };
}

async function resolveFromBlob(blob: Blob): Promise<ResolvedImage> {
  if (blob.size === 0) {
    throw new Error("Blob is empty");
  }
  const data = await blob.arrayBuffer();
  const mimeType = blob.type || "image/png";
  const filename = `image_${Date.now()}.${mimeType.split("/")[1] || "png"}`;
  return { data, mimeType, filename };
}

async function resolveFromBuffer(buffer: Buffer): Promise<ResolvedImage> {
  if (buffer.length === 0) {
    throw new Error("Buffer is empty");
  }
  // Copy to a standalone ArrayBuffer
  const ab = new ArrayBuffer(buffer.length);
  new Uint8Array(ab).set(buffer);
  return {
    data: ab,
    mimeType: "image/png",
    filename: `image_${Date.now()}.png`,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve any supported {@link ImageSource} into a normalized
 * {@link ResolvedImage} that can be handed off to the Discord upload pipeline.
 *
 * @param source  URL string, local file path, Blob, or Buffer
 * @param fetchFn The fetch implementation to use for remote URLs
 */
export async function resolveImageSource(
  source: ImageSource,
  fetchFn: typeof fetch
): Promise<ResolvedImage> {
  if (source === null || source === undefined) {
    throw new Error("Image source is required but got " + String(source));
  }

  // Buffer must be checked before Blob because Node Buffer extends Uint8Array
  // and can be confused with Blob in some environments.
  if (Buffer.isBuffer(source)) {
    return resolveFromBuffer(source);
  }

  if (source instanceof Blob) {
    return resolveFromBlob(source);
  }

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new Error("Image source string is empty");
    }
    if (isHttpUrl(trimmed)) {
      return resolveFromUrl(trimmed, fetchFn);
    }
    // Treat as local file path
    return resolveFromLocalFile(trimmed);
  }

  throw new Error(
    `Unsupported image source type: ${typeof source}. ` +
      "Expected a URL string, local file path, Blob, or Buffer."
  );
}

/**
 * Resolve an array of image sources and validate the count.
 */
export async function resolveImageSources(
  sources: ImageSource[],
  fetchFn: typeof fetch,
  options?: { min?: number; max?: number }
): Promise<ResolvedImage[]> {
  if (!Array.isArray(sources)) {
    throw new Error("Expected an array of image sources");
  }
  const min = options?.min ?? 1;
  const max = options?.max ?? Infinity;
  if (sources.length < min) {
    throw new Error(
      `Expected at least ${min} image(s) but got ${sources.length}`
    );
  }
  if (sources.length > max) {
    throw new Error(
      `Expected at most ${max} image(s) but got ${sources.length}`
    );
  }
  return Promise.all(sources.map((s) => resolveImageSource(s, fetchFn)));
}

/**
 * Validate that a resolved image has a supported MIME type.
 */
export function validateResolvedImage(
  image: ResolvedImage,
  label = "image"
): void {
  if (!image.data || image.data.byteLength === 0) {
    throw new Error(`${label}: resolved image data is empty`);
  }
  if (!image.mimeType) {
    throw new Error(`${label}: MIME type is missing`);
  }
  if (!SUPPORTED_MIME_PREFIXES.some((p) => image.mimeType.startsWith(p))) {
    throw new Error(
      `${label}: unsupported MIME type "${image.mimeType}". ` +
        `Supported: ${SUPPORTED_MIME_PREFIXES.join(", ")}`
    );
  }
  if (!image.filename) {
    throw new Error(`${label}: filename is missing`);
  }
}
