import "dotenv/config";
import * as fs from "fs";
import { Midjourney } from "../src";
/**
 *
 * Describe using a Node.js Buffer — useful when you already have
 * image data in memory (e.g. downloaded from another API, received
 * from a webhook, etc.).
 * ```
 * npx tsx example/describe-buffer.ts
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

  // --- Describe from a Buffer ---
  const buffer = fs.readFileSync("./images/ali.png");
  console.log("Describing Buffer, size:", buffer.length);
  const result = await client.Describe(buffer);
  console.log("Describe result (Buffer):", result);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
