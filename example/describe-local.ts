import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * Describe using a local file path.
 * The unified `Describe` method accepts URL, local path, Blob or Buffer.
 * ```
 * npx tsx example/describe-local.ts
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

  // --- 1. Describe from a local file path ---
  const localPath = "./images/ali.png";
  console.log("Describing local file:", localPath);
  const result1 = await client.Describe(localPath);
  console.log("Describe result (local file):", result1);

  // --- 2. Describe from a remote URL (still works) ---
  const url =
    "https://cdn.discordapp.com/attachments/1107965981839605792/1119977411631652914/Soga_a_cool_cat_blue_ears_yellow_hat_02afd1ed-17eb-4a61-9101-7a99b105e4cc.png";
  console.log("Describing URL:", url);
  const result2 = await client.Describe(url);
  console.log("Describe result (URL):", result2);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
