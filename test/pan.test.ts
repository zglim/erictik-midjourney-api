import assert from "assert";
import {
  Midjourney,
  MJMessage,
  PanDirection,
  panLabel,
  panContent,
  findOptionByLabel,
  PanLabels,
} from "../src";

/**
 * Verification for the custom-pan high level API and the shared
 * "press a button by label" plumbing. These checks run fully offline
 * (Ws disabled, network calls stubbed):
 * ```
 * npx tsx test/pan.test.ts
 * ```
 */

type TestFn = () => void | Promise<void>;
const tests: { name: string; fn: TestFn }[] = [];
const test = (name: string, fn: TestFn) => tests.push({ name, fn });

// ---- shared fixtures -------------------------------------------------------

const upscaleMsg: MJMessage = {
  id: "upscale-msg-id",
  flags: 64,
  content: "an upscaled image",
  uri: "http://example/up.png",
  hash: "abc",
  options: [
    {
      label: "🪄 Vary (Strong)",
      type: 2,
      style: 2,
      custom: "MJ::JOB::variation::1::abc::SOLO",
    },
    {
      label: "⬅️",
      type: 2,
      style: 2,
      custom: "MJ::JOB::pan_left::1::abc::SOLO",
    },
    {
      label: "➡️",
      type: 2,
      style: 2,
      custom: "MJ::JOB::pan_right::1::abc::SOLO",
    },
    { label: "⬆️", type: 2, style: 2, custom: "MJ::JOB::pan_up::1::abc::SOLO" },
    {
      label: "⬇️",
      type: 2,
      style: 2,
      custom: "MJ::JOB::pan_down::1::abc::SOLO",
    },
    { label: "Custom Zoom", type: 2, style: 2, custom: "MJ::CustomZoom::abc" },
  ],
};

// Build a Midjourney client with Ws off and the network layer stubbed so we
// can observe exactly what reaches CustomApi without touching Discord.
function makeClient() {
  const client = new Midjourney({
    SalaiToken: "test-token",
    ServerId: "server-id",
    ChannelId: "channel-id",
    Ws: false,
  });
  const calls: any[] = [];
  client.MJApi.CustomApi = async (params: any) => {
    calls.push(params);
    return 204;
  };
  // With Ws off, Custom() resolves through WaitMessage; echo the content back
  // so assertions can confirm the generated submit content.
  (client as any).WaitMessage = async (content: string) => ({
    content,
    id: "result-id",
    flags: 0,
    uri: "http://example/result.png",
    options: [],
  });
  return { client, calls };
}

async function assertRejects(
  fn: () => Promise<any>,
  re: RegExp,
  message: string
) {
  let error: any;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, `${message} (expected to reject)`);
  assert.match(String(error.message), re, message);
}

// ---- pure logic ------------------------------------------------------------

test("panLabel maps every direction to its button emoji", () => {
  assert.strictEqual(panLabel("left"), "⬅️");
  assert.strictEqual(panLabel("right"), "➡️");
  assert.strictEqual(panLabel("up"), "⬆️");
  assert.strictEqual(panLabel("down"), "⬇️");
  assert.deepStrictEqual(Object.keys(PanLabels).sort(), [
    "down",
    "left",
    "right",
    "up",
  ]);
});

test("panLabel rejects an unsupported direction", () => {
  assert.throws(
    () => panLabel("sideways" as PanDirection),
    /invalid pan direction/
  );
});

test("panContent generates the --pan_<direction> <amount> suffix", () => {
  assert.strictEqual(panContent("a cat", "right"), "a cat --pan_right 2");
  assert.strictEqual(panContent("a cat", "left", 3), "a cat --pan_left 3");
  assert.strictEqual(panContent("sky", "up", 1), "sky --pan_up 1");
  assert.strictEqual(panContent("sky", "down", 2), "sky --pan_down 2");
});

test("panContent validates the direction before composing content", () => {
  assert.throws(
    () => panContent("a cat", "diagonal" as PanDirection),
    /invalid pan direction/
  );
});

test("findOptionByLabel returns the matching option", () => {
  const option = findOptionByLabel(upscaleMsg.options, "➡️");
  assert.strictEqual(option.custom, "MJ::JOB::pan_right::1::abc::SOLO");
});

test("findOptionByLabel throws when the label is missing", () => {
  assert.throws(
    () => findOptionByLabel(upscaleMsg.options, "🚀"),
    /option "🚀" not found/
  );
  assert.throws(
    () => findOptionByLabel(undefined, "➡️"),
    /option "➡️" not found/
  );
});

// ---- Pan integration -------------------------------------------------------

test("Pan looks up the button and forwards customId/flags/msgId/content", async () => {
  const { client, calls } = makeClient();
  const result = await client.Pan({
    msg: upscaleMsg,
    direction: "right",
    amount: 2,
    prompt: "a cat",
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].customId, "MJ::JOB::pan_right::1::abc::SOLO");
  assert.strictEqual(calls[0].flags, 64);
  assert.strictEqual(calls[0].msgId, "upscale-msg-id");
  // generated submit content flows through to the resulting message
  assert.strictEqual(result?.content, "a cat --pan_right 2");
});

test("Pan resolves each direction to the right button", async () => {
  const expected: Record<PanDirection, string> = {
    left: "MJ::JOB::pan_left::1::abc::SOLO",
    right: "MJ::JOB::pan_right::1::abc::SOLO",
    up: "MJ::JOB::pan_up::1::abc::SOLO",
    down: "MJ::JOB::pan_down::1::abc::SOLO",
  };
  for (const direction of Object.keys(expected) as PanDirection[]) {
    const { client, calls } = makeClient();
    await client.Pan({ msg: upscaleMsg, direction, prompt: "a cat" });
    assert.strictEqual(calls[0].customId, expected[direction]);
  }
});

test("Pan honors an explicit content override", async () => {
  const { client, calls } = makeClient();
  const result = await client.Pan({
    msg: upscaleMsg,
    direction: "left",
    prompt: "ignored when content is set",
    content: "fully custom content --pan_left 2",
  });
  assert.strictEqual(calls[0].customId, "MJ::JOB::pan_left::1::abc::SOLO");
  assert.strictEqual(result?.content, "fully custom content --pan_left 2");
});

test("Pan rejects an invalid direction before any API call", async () => {
  const { client, calls } = makeClient();
  await assertRejects(
    () =>
      client.Pan({
        msg: upscaleMsg,
        direction: "sideways" as PanDirection,
        prompt: "a cat",
      }),
    /invalid pan direction/,
    "invalid direction"
  );
  assert.strictEqual(calls.length, 0);
});

test("Pan rejects when the direction button is missing from options", async () => {
  const { client, calls } = makeClient();
  const noPanMsg: MJMessage = { ...upscaleMsg, options: [] };
  await assertRejects(
    () => client.Pan({ msg: noPanMsg, direction: "right", prompt: "a cat" }),
    /option "➡️" not found/,
    "missing option"
  );
  assert.strictEqual(calls.length, 0);
});

// ---- CustomByLabel (generic button-by-label) -------------------------------

test("CustomByLabel finds the option by label and runs Custom", async () => {
  const { client, calls } = makeClient();
  const result = await client.CustomByLabel({
    msg: upscaleMsg,
    label: "Custom Zoom",
    content: "an upscaled image --zoom 2",
  });
  assert.strictEqual(calls[0].customId, "MJ::CustomZoom::abc");
  assert.strictEqual(calls[0].msgId, "upscale-msg-id");
  assert.strictEqual(result?.content, "an upscaled image --zoom 2");
});

test("CustomByLabel throws when the label is missing", async () => {
  const { client, calls } = makeClient();
  await assertRejects(
    () =>
      client.CustomByLabel({
        msg: upscaleMsg,
        label: "Nope",
        content: "x",
      }),
    /option "Nope" not found/,
    "missing label"
  );
  assert.strictEqual(calls.length, 0);
});

// ---- non-regression: ZoomOut & Custom --------------------------------------

test("ZoomOut still builds the documented customId for every level", async () => {
  const cases: { level: "high" | "low" | "2x" | "1.5x"; customId: string }[] = [
    { level: "high", customId: "MJ::JOB::high_variation::1::abc::SOLO" },
    { level: "low", customId: "MJ::JOB::low_variation::1::abc::SOLO" },
    { level: "2x", customId: "MJ::Outpaint::50::1::abc::SOLO" },
    { level: "1.5x", customId: "MJ::Outpaint::75::1::abc::SOLO" },
  ];
  for (const { level, customId } of cases) {
    const { client, calls } = makeClient();
    await client.ZoomOut({
      level,
      msgId: "zoom-msg",
      hash: "abc",
      flags: 0,
      content: "a cat --zoom 2",
    });
    assert.strictEqual(calls[0].customId, customId);
    assert.strictEqual(calls[0].msgId, "zoom-msg");
  }
});

test("Custom still forwards msgId/customId/flags untouched", async () => {
  const { client, calls } = makeClient();
  const result = await client.Custom({
    msgId: "raw-msg",
    customId: "MJ::JOB::upsample::1::abc",
    flags: 8,
    content: "a cat",
  });
  assert.strictEqual(calls[0].msgId, "raw-msg");
  assert.strictEqual(calls[0].customId, "MJ::JOB::upsample::1::abc");
  assert.strictEqual(calls[0].flags, 8);
  assert.strictEqual(result?.content, "a cat");
});

// ---- runner ----------------------------------------------------------------

async function run() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`  ok   - ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  FAIL - ${name}`);
      console.error(`         ${e?.message ?? e}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
