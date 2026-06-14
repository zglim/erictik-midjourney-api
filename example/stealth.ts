import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * a simple example of switching the generation visibility mode
 * (public / private / stealth) and verifying the change via /info.
 * ```
 * npx tsx example/stealth.ts
 * ```
 */
async function main() {
  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: true, // enable ws to receive the bot's confirmation message
  });
  await client.Connect();

  // read the current mode before switching
  const before = await client.Visibility();
  console.log("visibility before:", before);

  // switch to stealth; in ws mode this resolves with the bot's confirmation
  const stealthMsg = await client.Stealth();
  console.log("stealth confirmation:", stealthMsg);
  console.log("visibility after stealth:", await client.Visibility());

  // switch back to public; Private() works the exact same way
  const publicMsg = await client.Public();
  console.log("public confirmation:", publicMsg);
  console.log("visibility after public:", await client.Visibility());

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
