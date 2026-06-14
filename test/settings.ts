import assert from "node:assert";
import { Midjourney, MJSettings } from "../src";
import { findSettingsOption, isSettingEnabled } from "../src/utils";

/**
 * Verification for the settings management api. Runs fully offline by stubbing
 * `Settings()` and `MJApi.CustomApi`, so no discord connection is required.
 * ```
 * npx tsx test/settings.ts
 * ```
 */

const REMIX_CUSTOM = "MJ::Settings::RemixMode";
const RESET_CUSTOM = "MJ::Settings::Reset";
const NIJI_CUSTOM = "MJ::Settings::Niji5";

// build a fake /settings panel; style 3 => enabled, style 2 => disabled
function buildPanel(remixEnabled: boolean): MJSettings {
  return {
    id: "msg-1",
    flags: 0,
    content: "settings",
    options: [
      {
        label: "Remix mode",
        type: 2,
        style: remixEnabled ? 3 : 2,
        custom: REMIX_CUSTOM,
      },
      { label: "Reset Settings", type: 2, style: 2, custom: RESET_CUSTOM },
      { label: "Niji version 5", type: 2, style: 2, custom: NIJI_CUSTOM },
    ],
  };
}

// a Midjourney client whose network calls are stubbed by a small state machine:
// clicking the remix custom id flips the panel state, mirroring discord.
function fakeClient() {
  const state = { remixEnabled: false, customCalls: [] as string[] };
  const client = new Midjourney({
    SalaiToken: "test-token",
    ServerId: "server",
    ChannelId: "channel",
  });
  (client as any).Settings = async () => buildPanel(state.remixEnabled);
  (client.MJApi as any).CustomApi = async ({
    customId,
  }: {
    customId: string;
  }) => {
    state.customCalls.push(customId);
    if (customId === REMIX_CUSTOM) state.remixEnabled = !state.remixEnabled;
    return 204;
  };
  return { client, state };
}

async function run() {
  // --- pure: findSettingsOption ---
  const panel = buildPanel(true);
  assert.strictEqual(
    findSettingsOption(panel.options, "Remix mode")?.custom,
    REMIX_CUSTOM,
    "find by label"
  );
  assert.strictEqual(
    findSettingsOption(panel.options, { custom: RESET_CUSTOM })?.label,
    "Reset Settings",
    "find by custom id"
  );
  assert.strictEqual(
    findSettingsOption(panel.options, {
      label: "Remix mode",
      custom: REMIX_CUSTOM,
    })?.custom,
    REMIX_CUSTOM,
    "find by label + custom"
  );
  assert.strictEqual(
    findSettingsOption(panel.options, { label: "Remix mode", custom: "WRONG" }),
    undefined,
    "label + mismatching custom => not found"
  );
  assert.strictEqual(
    findSettingsOption(panel.options, "does-not-exist"),
    undefined,
    "missing label => undefined"
  );
  assert.strictEqual(
    findSettingsOption(undefined, "Remix mode"),
    undefined,
    "undefined options => undefined"
  );
  assert.throws(
    () => findSettingsOption(panel.options, {} as any),
    /requires a label or custom id/,
    "empty target throws"
  );

  // --- pure: isSettingEnabled ---
  assert.strictEqual(
    isSettingEnabled({ label: "x", type: 2, style: 3, custom: "c" }),
    true,
    "style 3 => enabled"
  );
  assert.strictEqual(
    isSettingEnabled({ label: "x", type: 2, style: 2, custom: "c" }),
    false,
    "style 2 => disabled"
  );

  // --- UpdateSetting clicks the right option and returns refreshed panel ---
  {
    const { client, state } = fakeClient();
    const refreshed = await client.UpdateSetting("Remix mode");
    assert.deepStrictEqual(
      state.customCalls,
      [REMIX_CUSTOM],
      "UpdateSetting clicks remix"
    );
    assert.strictEqual(
      findSettingsOption(refreshed!.options, "Remix mode")?.style,
      3,
      "UpdateSetting returns refreshed (enabled) panel"
    );
  }

  // --- EnsureSetting is idempotent (closed-loop, no useless toggle) ---
  {
    const { client, state } = fakeClient();
    await client.EnsureSetting("Remix mode", true);
    assert.strictEqual(state.customCalls.length, 1, "ensure true toggles once");
    await client.EnsureSetting("Remix mode", true);
    assert.strictEqual(
      state.customCalls.length,
      1,
      "ensure true again is a no-op"
    );
    await client.EnsureSetting("Remix mode", false);
    assert.strictEqual(
      state.customCalls.length,
      2,
      "ensure false toggles back off"
    );
    assert.strictEqual(state.remixEnabled, false, "remix ends disabled");
  }

  // --- Reset delegates to the shared flow ---
  {
    const { client, state } = fakeClient();
    await client.Reset();
    assert.deepStrictEqual(
      state.customCalls,
      [RESET_CUSTOM],
      "Reset clicks Reset Settings via UpdateSetting"
    );
  }

  // --- SwitchRemix toggles + syncs config.Remix ---
  {
    const { client, state } = fakeClient();
    await client.SwitchRemix();
    assert.deepStrictEqual(
      state.customCalls,
      [REMIX_CUSTOM],
      "SwitchRemix clicks remix once"
    );
    assert.strictEqual(
      client.config.Remix,
      true,
      "SwitchRemix syncs config.Remix to enabled"
    );
  }

  // --- SetRemix is closed-loop + syncs config.Remix ---
  {
    const { client, state } = fakeClient();
    state.remixEnabled = true; // already on
    await client.SetRemix(true);
    assert.strictEqual(
      state.customCalls.length,
      0,
      "SetRemix(true) is a no-op when already enabled"
    );
    assert.strictEqual(
      client.config.Remix,
      true,
      "SetRemix still syncs config.Remix"
    );
  }

  // --- error branch: unknown label ---
  {
    const { client } = fakeClient();
    await assert.rejects(
      () => client.UpdateSetting("Does Not Exist"),
      /Settings option not found/,
      "unknown label rejects"
    );
  }

  // --- error branch: invalid target ---
  {
    const { client } = fakeClient();
    await assert.rejects(
      () => client.EnsureSetting({} as any, true),
      /requires a label or custom id/,
      "invalid target rejects"
    );
  }

  console.log("settings api: all assertions passed");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("settings api test failed:");
    console.error(err);
    process.exit(1);
  });
