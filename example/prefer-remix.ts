import "dotenv/config";
import { Midjourney } from "../src";
/**
 * Example: controlling Remix mode with the settings management API.
 *
 * Demonstrates:
 *  - `ensureRemixMode(true)`  — enable Remix (no-op if already on)
 *  - `ensureRemixMode(false)` — disable Remix (no-op if already off)
 *  - Legacy `SwitchRemix()`   — raw toggle via /prefer remix
 *
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
    Ws: true, // WebSocket is required for settings management
  });
  await client.Connect();

  // ── 1. Enable Remix mode (state-aware, skips if already enabled) ──
  const enableResult = await client.ensureRemixMode(true);
  console.log("Enable remix result:", enableResult);
  // {
  //   label: "Remix mode",
  //   wasActive: false,
  //   isActive: true,
  //   toggled: true,   // actually clicked the button
  // }
  console.log("config.Remix is now:", client.config.Remix); // true

  // ── 2. Enable again — should be a no-op ───────────────────────────
  const noopResult = await client.ensureRemixMode(true);
  console.log("Enable remix (noop):", noopResult);
  // toggled: false — no network call made

  // ── 3. Disable Remix mode ─────────────────────────────────────────
  const disableResult = await client.ensureRemixMode(false);
  console.log("Disable remix result:", disableResult);
  console.log("config.Remix is now:", client.config.Remix); // false

  // ── 4. (Legacy) Raw toggle via /prefer remix ──────────────────────
  //    This blindly flips the state. Prefer ensureRemixMode() for
  //    state-aware control.
  // const toggleResult = await client.SwitchRemix();
  // console.log("Legacy toggle:", toggleResult);

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
