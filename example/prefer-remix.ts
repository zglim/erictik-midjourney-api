import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * a simple example of using the remix settings api
 * ```
 * npx tsx example/prefer-remix.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: true, //enable ws is required for remix mode
  });
  await client.Connect();

  // closed-loop: make sure remix mode is ON, skipping the click if it already is
  const enabled = await client.SetRemix(true);
  console.log("remix enabled:", client.config.Remix, enabled?.content);

  // SwitchRemix still works as a blind toggle, now delegating to the shared
  // settings flow and keeping config.Remix in sync.
  await client.SwitchRemix();
  console.log("remix after toggle:", client.config.Remix);

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
