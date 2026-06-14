export type UploadParam = {
  filename: string;
  file_size: number;
  id: number | string;
};
export type UploadSlot = {
  id: number;
  upload_filename: string;
  upload_url: string;
};
export type DiscordImage = {
  id: number | string;
  filename: string;
  upload_filename: string;
};

/**
 * Any supported image source that can be turned into a Discord upload.
 *
 * - `string`: a remote `http(s)` URL, a `data:` URI, or a local file path
 * - `Blob`: a browser/Node `Blob`
 * - `Buffer` / `Uint8Array` / `ArrayBuffer`: raw image bytes
 */
export type ImageInput = string | Blob | Buffer | Uint8Array | ArrayBuffer;

/**
 * Normalized image, ready to be handed to the Discord attachment flow.
 */
export type ResolvedImage = {
  /** raw image bytes */
  data: Uint8Array;
  /** mime type, e.g. `image/png` */
  mimeType: string;
  /** file name used for the upload, e.g. `image.png` */
  filename: string;
  /** size of `data` in bytes */
  file_size: number;
};
