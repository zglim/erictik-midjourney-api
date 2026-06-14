/**
 * Settings management unit tests.
 *
 * Run with:
 *   npx tsx test/settings.test.ts
 *
 * These tests mock the Midjourney class internals (Settings, CustomApi)
 * so they don't require a real Discord connection.
 */

import { Midjourney } from "../src";
import { MJSettings, MJOptions, ButtonStyle } from "../src/interfaces";

// ── Assertion helpers ──────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed++;
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    console.error(
      `  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
    failed++;
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

async function assertThrows(
  fn: () => Promise<unknown>,
  expectedSubstring: string,
  message: string
) {
  try {
    await fn();
    console.error(`  FAIL: ${message} — expected error but none thrown`);
    failed++;
  } catch (e: any) {
    if (e.message && e.message.includes(expectedSubstring)) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(
        `  FAIL: ${message} — expected "${expectedSubstring}" but got "${e.message}"`
      );
      failed++;
    }
  }
}

// ── Mock helpers ────────────────────────────────────────────────────

function makeOption(
  label: string,
  style: number,
  custom?: string
): MJOptions {
  return {
    label,
    type: 2,
    style,
    custom: custom || `MJ::Settings::${label.replace(/\s+/g, "_")}`,
  };
}

function makeSettings(options: MJOptions[]): MJSettings {
  return {
    content: "test-settings",
    id: "msg-123",
    flags: 64,
    options,
  };
}

/**
 * Create a Midjourney instance with mocked network methods.
 */
function createMockClient(mockSettings: MJSettings | null, mockCustomApiStatus = 204) {
  const client = new Midjourney({
    SalaiToken: "test-token",
    ServerId: "test-server",
    ChannelId: "test-channel",
    Ws: true,
    Debug: false,
  });

  // Mock Settings() — return the provided settings
  (client as any).Settings = async () => mockSettings;

  // Mock MJApi.CustomApi — return the configured status
  const customApiCalls: Array<{ msgId: string; customId: string; flags: number }> = [];
  client.MJApi.CustomApi = async (params: any) => {
    customApiCalls.push(params);
    return mockCustomApiStatus;
  };

  return { client, customApiCalls };
}

// ── Tests ───────────────────────────────────────────────────────────

async function testIsSettingActive() {
  console.log("\n── isSettingActive ──");

  const client = new Midjourney({
    SalaiToken: "test",
    Ws: true,
    Debug: false,
  });

  assert(
    client.isSettingActive(makeOption("Remix mode", ButtonStyle.Success)),
    "style 3 (success) → active"
  );
  assert(
    !client.isSettingActive(makeOption("Remix mode", ButtonStyle.Primary)),
    "style 1 (primary) → not active"
  );
  assert(
    !client.isSettingActive(makeOption("Remix mode", ButtonStyle.Secondary)),
    "style 2 (secondary) → not active"
  );
  assert(
    !client.isSettingActive(makeOption("Remix mode", ButtonStyle.Danger)),
    "style 4 (danger) → not active"
  );
}

async function testFindSettingOption() {
  console.log("\n── findSettingOption ──");

  const client = new Midjourney({
    SalaiToken: "test",
    Ws: true,
    Debug: false,
  });

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary),
    makeOption("Niji version 5", ButtonStyle.Success),
    makeOption("Reset Settings", ButtonStyle.Danger),
  ]);

  const found = client.findSettingOption(settings, "Niji version 5");
  assertEqual(found?.label, "Niji version 5", "finds exact label match");
  assert(found !== undefined, "found option is not undefined");

  const notFound = client.findSettingOption(settings, "Nonexistent");
  assertEqual(notFound, undefined, "returns undefined for missing label");
}

async function testFindSettingByCustomId() {
  console.log("\n── findSettingByCustomId ──");

  const client = new Midjourney({
    SalaiToken: "test",
    Ws: true,
    Debug: false,
  });

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary, "custom-remix"),
    makeOption("Niji version 5", ButtonStyle.Success, "custom-niji"),
  ]);

  const found = client.findSettingByCustomId(settings, "custom-niji");
  assertEqual(found?.label, "Niji version 5", "finds by custom_id");

  const notFound = client.findSettingByCustomId(settings, "no-such-id");
  assertEqual(notFound, undefined, "returns undefined for missing custom_id");
}

async function testUpdateSetting_SkipWhenAlreadyActive() {
  console.log("\n── updateSetting: skip when already in target state ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Success), // already active
    makeOption("Niji version 5", ButtonStyle.Secondary),
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    label: "Remix mode",
    targetState: true, // already ON → should skip
  });

  assertEqual(result.label, "Remix mode", "returns correct label");
  assertEqual(result.wasActive, true, "wasActive is true");
  assertEqual(result.isActive, true, "isActive remains true");
  assertEqual(result.toggled, false, "toggled is false (skipped)");
  assertEqual(customApiCalls.length, 0, "CustomApi was NOT called");
}

async function testUpdateSetting_ClickWhenInactive() {
  console.log("\n── updateSetting: click when inactive and target is active ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary), // inactive
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    label: "Remix mode",
    targetState: true, // want ON, currently OFF → should click
  });

  assertEqual(result.toggled, true, "toggled is true");
  assertEqual(result.wasActive, false, "wasActive was false");
  assertEqual(result.isActive, true, "isActive is now true");
  assertEqual(customApiCalls.length, 1, "CustomApi was called once");
  assertEqual(
    customApiCalls[0].customId,
    settings.options[0].custom,
    "clicked the correct button"
  );
}

async function testUpdateSetting_DisableWhenActive() {
  console.log("\n── updateSetting: disable when active and target is inactive ──");

  const settings = makeSettings([
    makeOption("Turbo mode", ButtonStyle.Success), // active
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    label: "Turbo mode",
    targetState: false, // want OFF, currently ON → should click
  });

  assertEqual(result.toggled, true, "toggled is true");
  assertEqual(result.wasActive, true, "wasActive was true");
  assertEqual(result.isActive, false, "isActive is now false");
  assertEqual(customApiCalls.length, 1, "CustomApi was called once");
}

async function testUpdateSetting_SkipWhenAlreadyInactive() {
  console.log("\n── updateSetting: skip when already inactive and target is inactive ──");

  const settings = makeSettings([
    makeOption("Turbo mode", ButtonStyle.Secondary), // inactive
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    label: "Turbo mode",
    targetState: false, // already OFF → skip
  });

  assertEqual(result.toggled, false, "toggled is false (skipped)");
  assertEqual(result.isActive, false, "isActive remains false");
  assertEqual(customApiCalls.length, 0, "CustomApi was NOT called");
}

async function testUpdateSetting_ForceToggle() {
  console.log("\n── updateSetting: force=true clicks even when in target state ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Success), // already active
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    label: "Remix mode",
    targetState: true,
    force: true, // force click
  });

  assertEqual(result.toggled, true, "toggled is true (forced)");
  assertEqual(customApiCalls.length, 1, "CustomApi was called despite being in target state");
}

async function testUpdateSetting_NoTargetState_AlwaysToggles() {
  console.log("\n── updateSetting: no targetState → always toggles ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Success), // active
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    label: "Remix mode",
    // no targetState → unconditional toggle
  });

  assertEqual(result.toggled, true, "toggled is true");
  assertEqual(result.wasActive, true, "wasActive was true");
  assertEqual(result.isActive, false, "isActive flipped to false");
  assertEqual(customApiCalls.length, 1, "CustomApi was called");
}

async function testUpdateSetting_LabelNotFound() {
  console.log("\n── updateSetting: label not found → error ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary),
  ]);
  const { client } = createMockClient(settings);

  await assertThrows(
    () => client.updateSetting({ label: "Nonexistent Setting" }),
    'Setting not found: label "Nonexistent Setting"',
    "throws when label not found"
  );
}

async function testUpdateSetting_CustomIdNotFound() {
  console.log("\n── updateSetting: customId not found → error ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary, "real-id"),
  ]);
  const { client } = createMockClient(settings);

  await assertThrows(
    () => client.updateSetting({ customId: "fake-id" }),
    'Setting not found: customId "fake-id"',
    "throws when customId not found"
  );
}

async function testUpdateSetting_NoParams() {
  console.log("\n── updateSetting: no label or customId → error ──");

  const { client } = createMockClient(makeSettings([]));

  await assertThrows(
    () => client.updateSetting({}),
    "at least one of `label` or `customId` is required",
    "throws when neither label nor customId provided"
  );
}

async function testUpdateSetting_SettingsNull() {
  console.log("\n── updateSetting: Settings() returns null → error ──");

  const { client } = createMockClient(null);

  await assertThrows(
    () => client.updateSetting({ label: "Remix mode" }),
    "Settings not found",
    "throws when Settings() returns null"
  );
}

async function testUpdateSetting_CustomApiFails() {
  console.log("\n── updateSetting: CustomApi returns non-204 → error ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary),
  ]);
  const { client } = createMockClient(settings, 500);

  await assertThrows(
    () => client.updateSetting({ label: "Remix mode", targetState: true }),
    "click failed with status 500",
    "throws when CustomApi returns error status"
  );
}

async function testUpdateSetting_ByCustomId() {
  console.log("\n── updateSetting: target by customId ──");

  const settings = makeSettings([
    makeOption("Some Setting", ButtonStyle.Secondary, "my-custom-id"),
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  const result = await client.updateSetting({
    customId: "my-custom-id",
    targetState: true,
  });

  assertEqual(result.toggled, true, "toggled via customId");
  assertEqual(result.label, "Some Setting", "resolved label from customId");
  assertEqual(customApiCalls.length, 1, "CustomApi was called");
}

async function testReset_Delegates() {
  console.log("\n── Reset: delegates to Settings + CustomApi ──");

  const settings = makeSettings([
    makeOption("Reset Settings", ButtonStyle.Danger, "MJ::Settings::reset"),
    makeOption("Remix mode", ButtonStyle.Secondary),
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  await client.Reset();

  assertEqual(customApiCalls.length, 1, "CustomApi called once for Reset");
  assertEqual(
    customApiCalls[0].customId,
    "MJ::Settings::reset",
    "clicked the Reset Settings button"
  );
  assertEqual(customApiCalls[0].msgId, "msg-123", "used correct msgId");
  assertEqual(customApiCalls[0].flags, 64, "used correct flags");
}

async function testReset_NoResetOption() {
  console.log("\n── Reset: no Reset Settings option → error ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary),
  ]);
  const { client } = createMockClient(settings);

  await assertThrows(
    () => client.Reset(),
    "Reset Settings not found",
    "throws when Reset Settings button is missing"
  );
}

async function testReset_SettingsNull() {
  console.log("\n── Reset: Settings() returns null → error ──");

  const { client } = createMockClient(null);

  await assertThrows(
    () => client.Reset(),
    "Settings not found",
    "throws when Settings() returns null"
  );
}

async function testEnsureRemixMode_EnableWhenOff() {
  console.log("\n── ensureRemixMode: enable when off ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary), // off
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  // Pre-set config.Remix to false
  client.config.Remix = false;

  const result = await client.ensureRemixMode(true);

  assertEqual(result.toggled, true, "toggled is true");
  assertEqual(result.isActive, true, "isActive is true");
  assertEqual(client.config.Remix, true, "config.Remix synced to true");
  assertEqual(customApiCalls.length, 1, "CustomApi was called");
}

async function testEnsureRemixMode_SkipWhenAlreadyOn() {
  console.log("\n── ensureRemixMode: skip when already on ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Success), // on
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  client.config.Remix = true;

  const result = await client.ensureRemixMode(true);

  assertEqual(result.toggled, false, "toggled is false (skipped)");
  assertEqual(result.isActive, true, "isActive remains true");
  assertEqual(client.config.Remix, true, "config.Remix remains true");
  assertEqual(customApiCalls.length, 0, "CustomApi was NOT called");
}

async function testEnsureRemixMode_DisableWhenOn() {
  console.log("\n── ensureRemixMode: disable when on ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Success), // on
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  client.config.Remix = true;

  const result = await client.ensureRemixMode(false);

  assertEqual(result.toggled, true, "toggled is true");
  assertEqual(result.isActive, false, "isActive is false");
  assertEqual(client.config.Remix, false, "config.Remix synced to false");
  assertEqual(customApiCalls.length, 1, "CustomApi was called");
}

async function testEnsureRemixMode_SkipWhenAlreadyOff() {
  console.log("\n── ensureRemixMode: skip when already off ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary), // off
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  client.config.Remix = false;

  const result = await client.ensureRemixMode(false);

  assertEqual(result.toggled, false, "toggled is false (skipped)");
  assertEqual(result.isActive, false, "isActive remains false");
  assertEqual(client.config.Remix, false, "config.Remix remains false");
  assertEqual(customApiCalls.length, 0, "CustomApi was NOT called");
}

async function testEnsureRemixMode_DefaultsToTrue() {
  console.log("\n── ensureRemixMode: defaults to enabled=true ──");

  const settings = makeSettings([
    makeOption("Remix mode", ButtonStyle.Secondary), // off
  ]);
  const { client, customApiCalls } = createMockClient(settings);

  client.config.Remix = false;

  const result = await client.ensureRemixMode(); // no argument → defaults to true

  assertEqual(result.toggled, true, "toggled is true");
  assertEqual(result.isActive, true, "isActive is true (default enable)");
  assertEqual(client.config.Remix, true, "config.Remix synced to true");
}

// ── Runner ──────────────────────────────────────────────────────────

async function runAll() {
  console.log("=== Settings Management Tests ===\n");

  // Pure unit tests (no mocking needed)
  await testIsSettingActive();
  await testFindSettingOption();
  await testFindSettingByCustomId();

  // updateSetting tests
  await testUpdateSetting_SkipWhenAlreadyActive();
  await testUpdateSetting_ClickWhenInactive();
  await testUpdateSetting_DisableWhenActive();
  await testUpdateSetting_SkipWhenAlreadyInactive();
  await testUpdateSetting_ForceToggle();
  await testUpdateSetting_NoTargetState_AlwaysToggles();
  await testUpdateSetting_LabelNotFound();
  await testUpdateSetting_CustomIdNotFound();
  await testUpdateSetting_NoParams();
  await testUpdateSetting_SettingsNull();
  await testUpdateSetting_CustomApiFails();
  await testUpdateSetting_ByCustomId();

  // Reset regression tests
  await testReset_Delegates();
  await testReset_NoResetOption();
  await testReset_SettingsNull();

  // ensureRemixMode tests
  await testEnsureRemixMode_EnableWhenOff();
  await testEnsureRemixMode_SkipWhenAlreadyOn();
  await testEnsureRemixMode_DisableWhenOn();
  await testEnsureRemixMode_SkipWhenAlreadyOff();
  await testEnsureRemixMode_DefaultsToTrue();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Unexpected test error:", err);
  process.exit(1);
});
