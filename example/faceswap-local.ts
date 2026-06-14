import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * Face swap using local files instead of remote URLs.
 * The unified `FaceSwap` method now accepts URL, local path, Blob or Buffer
 * for both target and source images.
 * ```
 * npx tsx example/faceswap-local.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    HuggingFaceToken: <string>process.env.HUGGINGFACE_TOKEN,
  });

  // --- 1. FaceSwap using local file paths ---
  const info = await client.FaceSwap(
    "./images/ali.png", // target: local file
    "./images/wechat.png" // source: local file
  );
  console.log("FaceSwap result (local files):", info?.uri);

  // --- 2. FaceSwap using a mix of URL and local file ---
  const remoteUrl = `https://cdn.discordapp.com/attachments/1107965981839605792/1129362418775113789/3829c5d7-3e7e-473c-9c7b-b858e3ec97bc.jpeg`;
  const info2 = await client.FaceSwap(
    "./images/ali.png", // target: local file
    remoteUrl // source: remote URL
  );
  console.log("FaceSwap result (mixed):", info2?.uri);
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
