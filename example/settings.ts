import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * a simple example of using the settings api
 * ```
 * npx tsx example/settings.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: true, //Important
  });
  await client.Connect();

  // read capability: fetch the current /settings panel
  const settings = await client.Settings();
  if (!settings) {
    client.Close();
    return;
  }
  console.log(
    "options:",
    settings.options.map((o) => o.label)
  );

  // write capability: switch a specific setting by label using the settings
  // management api, no need to dig into msg.options + MJApi.CustomApi manually.
  const target = "Niji version 5";
  const exists = settings.options.some((o) => o.label === target);
  if (exists) {
    const updated = await client.UpdateSetting(target, settings);
    console.log(
      "updated:",
      updated?.options.map((o) => o.label)
    );
  } else {
    console.log(`"${target}" is not available on this account, skipping.`);
  }

  client.Close();
}
main()
  .then(() => {
    console.log("finished");
    process.exit(0);
  })
  .catch((err) => {
    console.log("finished");
    console.error(err);
    process.exit(1);
  });
