import "dotenv/config";
import { Midjourney } from "../src";
/**
 *
 * a simple example of switching visibility modes (public / private / stealth)
 * ```
 * npx tsx example/visibility-mode.ts
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

  // Read current visibility mode
  const beforeInfo = await client.Info();
  console.log("visibility mode before:", beforeInfo?.visibilityMode);

  // Switch to private mode
  const privateResult = await client.Private();
  console.log("Private() result:", privateResult);

  // Verify the mode actually changed
  const afterPrivate = await client.verifyVisibilityMode();
  console.log("visibility mode after Private():", afterPrivate);

  // Switch to stealth mode
  await client.Stealth();
  const afterStealth = await client.verifyVisibilityMode();
  console.log("visibility mode after Stealth():", afterStealth);

  // Switch back to public mode
  await client.Public();
  const afterPublic = await client.verifyVisibilityMode();
  console.log("visibility mode after Public():", afterPublic);

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
