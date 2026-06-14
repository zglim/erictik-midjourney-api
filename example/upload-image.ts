import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { Midjourney } from "../src";
/**
 *
 * Demonstrates the unified image-input capability shared by every feature that
 * uploads an image (describe, face swap, ...).
 *
 * `MJApi.UploadImage` accepts a remote URL, a local file path, a `data:` URI, a
 * `Blob`, a `Buffer`, a `Uint8Array` or an `ArrayBuffer` and returns the Discord
 * attachment descriptor. `MJApi.UploadImages` does the same for a list, with
 * up-front count validation.
 *
 * ```
 * npx tsx example/upload-image.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: false,
  });

  const localImage = path.join(__dirname, "..", "images", "ali.png");
  const buffer = await readFile(localImage);

  // 1) from a local file path
  const fromFile = await client.MJApi.UploadImage(localImage);
  console.log("uploaded (local file path)", fromFile);

  // 2) from a Buffer
  const fromBuffer = await client.MJApi.UploadImage(buffer);
  console.log("uploaded (buffer)", fromBuffer);

  // 3) from a Blob
  const fromBlob = await client.MJApi.UploadImage(
    new Blob([buffer], { type: "image/png" })
  );
  console.log("uploaded (blob)", fromBlob);

  // 4) from a remote URL (works the same way)
  // const fromUrl = await client.MJApi.UploadImage("https://example.com/cat.png");
  // console.log("uploaded (url)", fromUrl);

  // 5) upload several images at once, validating how many were provided
  const many = await client.MJApi.UploadImages([localImage, buffer], {
    min: 2,
    max: 5,
  });
  console.log("uploaded (batch)", many.length);

  client.Close();
}
main()
  .then(() => {
    console.log("finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
