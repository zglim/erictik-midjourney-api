import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * A simple example of how to use the CustomPan API with ws command.
 *
 * CustomPan is a high-level API that wraps the pan (extend) operation
 * on an upscaled image. You no longer need to manually find the pan
 * button in options or build the --pan_<direction> content string.
 *
 * Keep remix turned off in your settings for this to work.
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
    Ws: true, // enable ws is required for custom pan
  });
  await client.init();
  const prompt =
    "Christmas dinner with spaghetti with family in a cozy house, we see interior details , simple blue&white illustration";

  // Step 1: Imagine
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

  // Step 2: Upscale U1
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
    console.log("no upscale message");
    return;
  }
  console.log(Upscale);

  // Step 3: Custom Pan Right using the new high-level API
  const PanRight = await client.CustomPan({
    msgId: <string>Upscale.id,
    flags: Upscale.flags,
    direction: "right",
    amount: 2,
    prompt,
    options: Upscale.options,
    loading: (uri: string, progress: string) => {
      console.log("loading", uri, "progress", progress);
    },
  });
  console.log("Custom Pan Right", PanRight);

  // You can also pan in other directions:
  // "left", "up", "down"
  // const PanLeft = await client.CustomPan({
  //   msgId: <string>Upscale.id,
  //   flags: Upscale.flags,
  //   direction: "left",
  //   amount: 2,
  //   prompt,
  //   options: Upscale.options,
  // });

  // You can also use CustomButton for any other button-based operation:
  // const VaryStrong = await client.CustomButton({
  //   msgId: <string>Upscale.id,
  //   flags: Upscale.flags,
  //   label: "Vary (Strong)",
  //   options: Upscale.options,
  //   content: prompt, // content required for remix-like operations
  // });

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
