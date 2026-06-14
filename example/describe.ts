import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { Midjourney } from "../src";
/**
 *
 * a simple example of using the describe api with different image inputs.
 *
 * `Describe` accepts a remote URL, a local file path, a `data:` URI, a `Blob`,
 * a `Buffer`, a `Uint8Array` or an `ArrayBuffer`.
 *
 * ```
 * npx tsx example/describe.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: true,
  });
  await client.Connect();

  // a local image bundled with the repo, so the example does not depend on an
  // external image URL.
  const localImage = path.join(__dirname, "..", "images", "ali.png");

  // 1) describe from a local file path (Node.js)
  const fromFile = await client.Describe(localImage);
  console.log("describe (local file path)\n", fromFile?.descriptions);

  // 2) describe from a Buffer
  const buffer = await readFile(localImage);
  const fromBuffer = await client.Describe(buffer);
  console.log("describe (buffer)\n", fromBuffer?.descriptions);

  // 3) describe from a remote URL (works exactly the same way)
  // const fromUrl = await client.Describe(
  //   "https://cdn.discordapp.com/attachments/1107965981839605792/1119977411631652914/Soga_a_cool_cat_blue_ears_yellow_hat_02afd1ed-17eb-4a61-9101-7a99b105e4cc.png"
  // );
  // console.log("describe (url)\n", fromUrl?.descriptions);

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
