import "dotenv/config";
import { Midjourney } from "../src";
/**
 * Example: using the settings management API.
 *
 * Demonstrates:
 *  - Reading current settings with Settings()
 *  - Switching a specific setting with updateSetting()
 *  - Checking whether a setting is already active
 *
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
    Ws: true, // Important — settings require WebSocket
  });
  await client.Connect();

  // ── 1. Read current settings ──────────────────────────────────────
  const settings = await client.Settings();
  console.log("Current settings:", settings);
  if (!settings) {
    console.log("No settings returned");
    client.Close();
    return;
  }

  // Print every option with its active state
  for (const opt of settings.options) {
    const active = client.isSettingActive(opt);
    console.log(`  [${active ? "ON " : "OFF"}] ${opt.label}`);
  }

  // ── 2. Switch to "Niji version 5" model using the new API ─────────
  //    This locates the button by label and clicks it, but only if
  //    it is not already active.
  const nijiResult = await client.updateSetting({
    label: "Niji version 5",
    targetState: true, // ensure it is ON
  });
  console.log("Niji v5 update result:", nijiResult);
  // {
  //   label: "Niji version 5",
  //   wasActive: false,   // was it active before?
  //   isActive: true,     // is it active now?
  //   toggled: true,      // did we actually click?
  // }

  // ── 3. Try to enable it again — should be a no-op ─────────────────
  const nijiNoop = await client.updateSetting({
    label: "Niji version 5",
    targetState: true, // already ON → skip
  });
  console.log("Niji v5 no-op result:", nijiNoop);
  // toggled: false

  // ── 4. Target a setting by custom_id instead of label ─────────────
  //    Useful when you already have the custom_id from a previous call.
  // const firstOption = settings.options[0];
  // const byCustomId = await client.updateSetting({
  //   customId: firstOption.custom,
  //   force: true, // click regardless of current state
  // });
  // console.log("By customId result:", byCustomId);

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
