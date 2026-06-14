import "dotenv/config";
import { Midjourney } from "../src";

/**
 * Demonstrates the real `/blend` command:
 *   - Uploads 2-5 images to Discord via the existing upload pipeline
 *   - Sends a proper `/blend` interaction (not Imagine with concatenated URLs)
 *   - Waits for the final blended result through the WS connection
 *
 * ```
 * npx tsx example/imagine-blend.ts
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

  // -- Blend from remote URLs --
  const msg = await client.Blend(
    {
      images: [
        "https://media.discordapp.net/attachments/1094892992281718894/1106660210380132503/Soga_A_Greek_man_with_mustache_in_national_costume_riding_a_don_3255e7c1-38ee-4892-b7c7-9f0dc3f2786d.png?width=1040&height=1040",
        "https://cdn.discordapp.com/attachments/1094892992281718894/1106798152188702720/Soga__489d80b2-db74-4a93-a998-881a9542abbe.png",
      ],
      dimensions: "1:1",
    },
    (uri: string, progress: string) => {
      console.log("loading", uri, "progress", progress);
    }
  );

  console.log("Blend result:", msg);
  if (!msg) {
    console.log("no message returned");
    return;
  }

  // -- Optionally upscale the blend result --
  const upscaled = await client.Upscale({
    index: 2,
    msgId: <string>msg.id,
    hash: <string>msg.hash,
    flags: msg.flags,
    content: msg.content,
    loading: (uri: string, progress: string) => {
      console.log("upscale loading", uri, "progress", progress);
    },
  });
  console.log("Upscale result:", upscaled);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
