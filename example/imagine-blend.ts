import "dotenv/config";
import { BlendDimensions, Midjourney } from "../src";
/**
 *
 * a simple example of how to use the `/blend` command.
 * `Blend` merges 2-5 images together; it needs websocket mode (`Ws: true`)
 * because the result comes back as an ephemeral discord message.
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
    Ws: true, // required: blend result is an ephemeral message
  });
  await client.Connect();
  const blend = await client.Blend({
    // each entry reuses the existing remote-upload pipeline.
    // you can also pass { uri } or { blob } here.
    images: [
      "https://media.discordapp.net/attachments/1094892992281718894/1106660210380132503/Soga_A_Greek_man_with_mustache_in_national_costume_riding_a_don_3255e7c1-38ee-4892-b7c7-9f0dc3f2786d.png?width=1040&height=1040",
      "https://cdn.discordapp.com/attachments/1094892992281718894/1106798152188702720/Soga__489d80b2-db74-4a93-a998-881a9542abbe.png",
    ],
    dimensions: BlendDimensions.Square,
    loading: (uri: string, progress: string) => {
      console.log("blend.loading", uri, "progress", progress);
    },
  });
  console.log({ blend });
  if (!blend) {
    console.log("no blend message");
    client.Close();
    return;
  }
  const upscale = await client.Upscale({
    index: 2,
    msgId: <string>blend.id,
    hash: <string>blend.hash,
    flags: blend.flags,
    content: blend.content,
    loading: (uri: string, progress: string) => {
      console.log("upscale.loading", uri, "progress", progress);
    },
  });
  console.log({ upscale });
  client.Close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
