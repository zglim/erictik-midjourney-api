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
 * Aspect ratio choices accepted by the `/blend` command's `dimensions` option.
 * The enum value is the raw aspect ratio; the SDK turns it into `--ar <value>`.
 */
export enum BlendDimensions {
  Portrait = "2:3",
  Square = "1:1",
  Landscape = "3:2",
}

/**
 * Input accepted by `Midjourney.Blend` for a single source image.
 *
 * Every variant is resolved into a {@link DiscordImage} through the existing
 * upload helpers (`UploadImageByUri` / `UploadImageByBole`) so no new image
 * pre-processing logic is introduced:
 * - `string` / `{ uri }`  -> remote http(s) image (reuses `UploadImageByUri`).
 * - `{ blob }`            -> in-memory / local file Blob (reuses `UploadImageByBole`).
 *
 * The object form is the extension point for future local-file inputs: add a
 * new key here and resolve it in `Midjourney.uploadBlendImage`.
 */
export type BlendImage =
  | string
  | { uri: string }
  | { blob: Blob; filename?: string };
