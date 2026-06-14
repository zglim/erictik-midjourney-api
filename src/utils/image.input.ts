import { FetchFn, ImageInput, ResolvedImage } from "../interfaces";
import { nextNonce } from "./index";

export const DEFAULT_IMAGE_MIME = "image/png";

const EXTENSION_MIME: Record<string, string> = {
  png: "image/png",
  apng: "image/apng",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

const MIME_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/apng": "apng",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
};

/**
 * Best-effort detection of an image mime type from the first bytes of the file.
 * Returns `undefined` when the signature is not recognised.
 */
export function sniffMimeType(bytes: Uint8Array): string | undefined {
  if (!bytes || bytes.length < 4) return undefined;
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: 47 49 46 38 ("GIF8")
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  // BMP: 42 4D ("BM")
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return undefined;
}

const extname = (name: string): string => {
  const clean = name.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0 || dot === clean.length - 1) return "";
  return clean.slice(dot + 1).toLowerCase();
};

const mimeFromExtension = (name: string): string | undefined =>
  EXTENSION_MIME[extname(name)];

const extensionFromMime = (mime: string): string =>
  MIME_EXTENSION[mime.split(";")[0].trim().toLowerCase()] || "png";

const generatedFilename = (mime: string): string =>
  `${nextNonce()}.${extensionFromMime(mime)}`;

const basename = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/").split(/[?#]/)[0];
  const last = normalized.split("/").pop();
  return last && last.length > 0 ? last : "";
};

const decodeBase64 = (b64: string): Uint8Array => {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const finalize = (
  data: Uint8Array,
  mimeType: string,
  filename: string
): ResolvedImage => ({
  data,
  mimeType,
  filename,
  file_size: data.byteLength,
});

const fromBlob = async (blob: Blob): Promise<ResolvedImage> => {
  const data = new Uint8Array(await blob.arrayBuffer());
  const mimeType = blob.type || sniffMimeType(data) || DEFAULT_IMAGE_MIME;
  return finalize(data, mimeType, generatedFilename(mimeType));
};

const fromBytes = (data: Uint8Array): ResolvedImage => {
  const mimeType = sniffMimeType(data) || DEFAULT_IMAGE_MIME;
  return finalize(data, mimeType, generatedFilename(mimeType));
};

const fromDataUri = (uri: string): ResolvedImage => {
  const match = /^data:([^;,]*)?(;base64)?,(.*)$/is.exec(uri);
  if (!match) {
    throw new Error("Invalid data URI image input");
  }
  const [, declaredMime, isBase64, payload] = match;
  const data = isBase64
    ? decodeBase64(payload)
    : new Uint8Array(
        decodeURIComponent(payload)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
  const mimeType = declaredMime || sniffMimeType(data) || DEFAULT_IMAGE_MIME;
  return finalize(data, mimeType, generatedFilename(mimeType));
};

const fromUrl = async (
  url: string,
  fetchFn?: FetchFn
): Promise<ResolvedImage> => {
  const doFetch = fetchFn || (typeof fetch !== "undefined" ? fetch : undefined);
  if (!doFetch) {
    throw new Error(
      "No fetch implementation available to download image URL. Pass `fetch` via MJConfig or provide a fetch function."
    );
  }
  const response = await doFetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image from "${url}": ${response.status} ${response.statusText}`
    );
  }
  const data = new Uint8Array(await response.arrayBuffer());
  const mimeType =
    response.headers.get("content-type") ||
    sniffMimeType(data) ||
    mimeFromExtension(url) ||
    DEFAULT_IMAGE_MIME;
  const filename = basename(url) || generatedFilename(mimeType);
  return finalize(data, mimeType, filename);
};

const fromFilePath = async (filePath: string): Promise<ResolvedImage> => {
  let fs: typeof import("fs/promises");
  try {
    fs = await import("fs/promises");
  } catch (e) {
    throw new Error(
      `Local file image input is only supported in a Node.js environment: "${filePath}"`
    );
  }
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (e: any) {
    if (e && e.code === "ENOENT") {
      throw new Error(`Image file not found: "${filePath}"`);
    }
    throw new Error(
      `Failed to read image file "${filePath}": ${e?.message ?? e}`
    );
  }
  const data = new Uint8Array(buffer);
  const mimeType =
    mimeFromExtension(filePath) || sniffMimeType(data) || DEFAULT_IMAGE_MIME;
  const filename = basename(filePath) || generatedFilename(mimeType);
  return finalize(data, mimeType, filename);
};

/**
 * Convert any supported {@link ImageInput} into a normalized {@link ResolvedImage}
 * (raw bytes + mime type + filename + size) that the Discord upload flow can consume.
 *
 * Supported inputs:
 * - remote `http(s)` URL (downloaded with `fetchFn`)
 * - `data:` URI
 * - local file path (Node.js only)
 * - `Blob`
 * - `Buffer` / `Uint8Array` / `ArrayBuffer`
 *
 * @param input the image source
 * @param fetchFn fetch implementation used to download URLs (defaults to global `fetch`)
 */
export async function resolveImage(
  input: ImageInput,
  fetchFn?: FetchFn
): Promise<ResolvedImage> {
  if (input === undefined || input === null) {
    throw new Error("Image input is empty");
  }

  if (typeof Blob !== "undefined" && input instanceof Blob) {
    if (input.size === 0) {
      throw new Error("Image input is empty (empty Blob)");
    }
    return fromBlob(input);
  }

  if (input instanceof ArrayBuffer) {
    if (input.byteLength === 0) {
      throw new Error("Image input is empty (empty ArrayBuffer)");
    }
    return fromBytes(new Uint8Array(input));
  }

  // Buffer is a subclass of Uint8Array, so this covers both.
  if (input instanceof Uint8Array) {
    if (input.byteLength === 0) {
      throw new Error("Image input is empty (empty buffer)");
    }
    return fromBytes(input);
  }

  if (typeof input === "string") {
    const value = input.trim();
    if (value === "") {
      throw new Error("Image input is empty");
    }
    if (/^https?:\/\//i.test(value)) {
      return fromUrl(value, fetchFn);
    }
    if (/^data:/i.test(value)) {
      return fromDataUri(value);
    }
    return fromFilePath(input);
  }

  throw new Error(
    `Unsupported image input type: ${
      (input as any)?.constructor?.name ?? typeof input
    }. Expected a URL/file path string, Blob, Buffer, Uint8Array or ArrayBuffer.`
  );
}

export type ResolveImagesOptions = {
  /** minimum number of images required (default 1) */
  min?: number;
  /** maximum number of images allowed (optional) */
  max?: number;
  /** fetch implementation used to download URLs */
  fetchFn?: FetchFn;
};

/**
 * Resolve a list of {@link ImageInput}s, validating the count up-front so callers
 * get a clear error before any network request is made.
 */
export async function resolveImages(
  inputs: ImageInput[],
  options: ResolveImagesOptions = {}
): Promise<ResolvedImage[]> {
  const { min = 1, max, fetchFn } = options;
  if (!Array.isArray(inputs)) {
    throw new Error("Image inputs must be provided as an array");
  }
  if (inputs.length < min) {
    throw new Error(
      `Expected at least ${min} image${min === 1 ? "" : "s"}, but got ${
        inputs.length
      }`
    );
  }
  if (max !== undefined && inputs.length > max) {
    throw new Error(
      `Expected at most ${max} image${max === 1 ? "" : "s"}, but got ${
        inputs.length
      }`
    );
  }
  return Promise.all(inputs.map((input) => resolveImage(input, fetchFn)));
}
