import "dotenv/config";
import path from "path";
import { Midjourney } from "../src";
/**
 *
 * face swap using mixed image inputs: a local file path for the target and a
 * remote URL for the source.
 *
 * `FaceSwap` accepts the same inputs as `Describe`: a remote URL, a local file
 * path, a `data:` URI, a `Blob`, a `Buffer`, a `Uint8Array` or an `ArrayBuffer`.
 *
 * ```
 * npx tsx example/faceswap-local.ts
 * ```
 */
async function main() {
  // a local image bundled with the repo (use any face image you like)
  const target = path.join(__dirname, "..", "images", "ali.png");
  // a remote image URL
  const source = `https://cdn.discordapp.com/attachments/1107965981839605792/1129362418775113789/3829c5d7-3e7e-473c-9c7b-b858e3ec97bc.jpeg`;

  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    HuggingFaceToken: <string>process.env.HUGGINGFACE_TOKEN,
  });
  const info = await client.FaceSwap(target, source);
  console.log(info?.uri);
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
