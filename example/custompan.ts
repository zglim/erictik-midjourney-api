import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * a simple example of how to use the (custom pan) options with ws command
 * keep remix turned off in your settings for this to work
 * ```
 * npx tsx example/custompan.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: true, //enable ws is required for custom pan
  });
  await client.init();
  const prompt =
    "Christmas dinner with spaghetti with family in a cozy house, we see interior details , simple blue&white illustration";
  //imagine
  const Imagine = await client.Imagine(
    prompt,
    (uri: string, progress: string) => {
      console.log("loading", uri, "progress", progress);
    }
  );
  console.log(Imagine);
  if (!Imagine) {
    console.log("no message");
    return;
  }
  // Upscale U1 (pan buttons live on an upscaled image)
  const Upscale = await client.Upscale({
    index: 1,
    msgId: <string>Imagine.id,
    hash: <string>Imagine.hash,
    flags: Imagine.flags,
    loading: (uri: string, progress: string) => {
      console.log("loading", uri, "progress", progress);
    },
  });
  if (!Upscale) {
    console.log("no Upscale");
    return;
  }
  console.log(Upscale);
  // Custom Pan — high level API, no need to dig through `options` by hand.
  // direction: "left" | "right" | "up" | "down"
  const CustomPanRight = await client.Pan({
    msg: Upscale,
    direction: "right",
    amount: 2,
    prompt, // submit content becomes `${prompt} --pan_right 2`
    loading: (uri: string, progress: string) => {
      console.log("loading", uri, "progress", progress);
    },
  });
  console.log("Custom Pan", CustomPanRight);
  client.Close();
}
main()
  .then(() => {
    console.log("done");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
