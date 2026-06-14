import assert from "node:assert";
import {
  DefaultMJConfig,
  Midjourney,
  MidjourneyApi,
  VisibilityEvent,
  VisibilityModes,
  WsMessage,
} from "../src";

/**
 * minimal verification for the public / private / stealth visibility modes.
 * runs fully offline (fetch + WebSocket are mocked), no Discord account needed:
 * ```
 * npx tsx test/mode.test.ts
 * ```
 */

// a no-op WebSocket so WsMessage can be constructed without a real connection
class MockWebSocket {
  static OPEN = 1;
  OPEN = 1;
  readyState = 1;
  constructor(public url: string) {}
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}

const baseConfig = () => ({
  ...DefaultMJConfig,
  ServerId: "server-1",
  ChannelId: "channel-1",
  SalaiToken: "test-token",
  fetch: (async () => {
    throw new Error("network should not be called in tests");
  }) as any,
  WebSocket: MockWebSocket as any,
});

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
const test = (name: string, fn: () => void | Promise<void>) =>
  tests.push({ name, fn });

// 1) payload assembly for all three visibility commands
test("modePayload assembles a payload per mode", async () => {
  const api = new MidjourneyApi(baseConfig() as any);
  // stub command lookup so we don't hit the network and can assert the threaded name
  (api as any).cacheCommand = async (name: string) => ({
    version: "v1",
    id: "cmd-id",
    name,
    type: 1,
    application_id: "app-id",
  });

  for (const mode of VisibilityModes) {
    const payload: any = await api.modePayload(mode, "nonce-123");
    assert.equal(payload.type, 2, `${mode}: interaction type`);
    assert.equal(payload.nonce, "nonce-123", `${mode}: nonce`);
    assert.equal(payload.channel_id, "channel-1", `${mode}: channel id`);
    assert.equal(payload.guild_id, "server-1", `${mode}: guild id`);
    assert.equal(payload.application_id, "app-id", `${mode}: application id`);
    assert.equal(payload.data.name, mode, `${mode}: command name threaded`);
    assert.deepEqual(payload.data.options, [], `${mode}: no options`);
  }
});

// 2) shared error path: non-204 http status throws with the mode in the message
test("switchMode throws on non-204 http status", async () => {
  const client = new Midjourney({ ...baseConfig(), Ws: false } as any);
  (client.MJApi as any).ModeApi = async () => 500;
  await assert.rejects(
    () => client.Stealth(),
    /stealth mode failed with status 500/,
    "should surface the failing http status"
  );
});

// 3) websocket branch: returns the bot's confirmation message
test("Stealth waits for the visibility message in ws mode", async () => {
  const client = new Midjourney({ ...baseConfig(), Ws: true } as any);
  const CONFIRM = "Stealth mode turned on!";
  let waited = "";
  const fakeWs = {
    waitContent: async (event: string) => {
      waited = event;
      return CONFIRM;
    },
  };
  (client as any).getWsClient = async () => fakeWs;
  (client.MJApi as any).ModeApi = async () => 204;

  const result = await client.Stealth();
  assert.equal(result, CONFIRM, "returns the confirmation content");
  assert.equal(waited, VisibilityEvent, "waited on the visibility event");
});

// 4) non-websocket branch: resolves null without touching the ws client
test("Public resolves null in non-ws mode", async () => {
  const client = new Midjourney({ ...baseConfig(), Ws: false } as any);
  (client as any).getWsClient = async () => {
    throw new Error("getWsClient must not be called without ws");
  };
  (client.MJApi as any).ModeApi = async () => 204;

  const result = await client.Public();
  assert.equal(result, null, "no ws client => null");
});

// 5) ws message mapping: public/private/stealth interactions emit the visibility event
test("WsMessage relays mode confirmations as the visibility event", () => {
  const ws = new WsMessage(
    baseConfig() as any,
    new MidjourneyApi(baseConfig() as any)
  );
  for (const mode of VisibilityModes) {
    let received: string | undefined;
    ws.on(VisibilityEvent, (msg: string) => (received = msg));
    const content = `${mode} mode turned on!`;
    (ws as any).messageUpdate({
      interaction: { name: mode },
      content,
      id: "msg-1",
      components: [],
    });
    assert.equal(received, content, `${mode} should emit visibility`);
  }

  // an unrelated interaction must not emit the visibility event
  let leaked = false;
  ws.on(VisibilityEvent, () => (leaked = true));
  (ws as any).messageUpdate({
    interaction: { name: "settings" },
    content: "",
    id: "msg-2",
    components: [],
  });
  assert.equal(leaked, false, "settings must not trigger visibility");
});

async function main() {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok  - ${name}`);
    } catch (err) {
      failed++;
      console.error(`fail  - ${name}`);
      console.error(err);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log(`\nall ${tests.length} test(s) passed`);
  process.exit(0);
}
main();
