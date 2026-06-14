import { Command } from "../src/command";
import { MidjourneyApi } from "../src/midjourney.api";
import { Midjourney } from "../src/midjourney";
import { MJConfig } from "../src/interfaces";

// ── helpers ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<MJConfig> = {}): MJConfig {
  return {
    ChannelId: "test-channel",
    SalaiToken: "test-token",
    BotId: "936929561302675456",
    Debug: false,
    Limit: 50,
    MaxWait: 200,
    SessionId: "test-session",
    ServerId: "test-server",
    Ws: false,
    DiscordBaseUrl: "https://discord.com",
    WsBaseUrl: "wss://gateway.discord.gg",
    ApiInterval: 0,
    ImageProxy: "",
    fetch: jest.fn() as any,
    WebSocket: jest.fn() as any,
    ...overrides,
  };
}

/**
 * Build a minimal fake discord application-command-index response so that
 * `Command.cacheCommand` can resolve without hitting the real API.
 */
function fakeCommandResponse(name: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      application_commands: [
        {
          id: `cmd-id-${name}`,
          name,
          version: `v-${name}`,
          type: 1,
          application_id: "app-id",
        },
      ],
    }),
    text: async () => "",
    headers: new Map(),
  };
}

// ── payload assembly tests ───────────────────────────────────────────

describe("Command payload assembly", () => {
  let cmd: Command;

  beforeEach(() => {
    const config = makeConfig({
      fetch: jest.fn().mockImplementation(async (url: string) => {
        // Extract command name from URL – we don't actually need it because
        // getCommand returns the first entry regardless.
        for (const name of ["public", "private", "stealth"]) {
          if (url.includes("application-command-index")) {
            return fakeCommandResponse(name);
          }
        }
        return fakeCommandResponse("unknown");
      }) as any,
    });
    cmd = new Command(config);

    // Pre-populate cache so the fetch mock does not matter for payload tests.
    cmd.cache["public"] = {
      id: "cmd-id-public",
      name: "public",
      version: "v-public",
      type: 1,
      application_id: "app-id",
    } as any;
    cmd.cache["private"] = {
      id: "cmd-id-private",
      name: "private",
      version: "v-private",
      type: 1,
      application_id: "app-id",
    } as any;
    cmd.cache["stealth"] = {
      id: "cmd-id-stealth",
      name: "stealth",
      version: "v-stealth",
      type: 1,
      application_id: "app-id",
    } as any;
  });

  it("builds publicPayload with correct structure", async () => {
    const payload = await cmd.publicPayload("nonce-1");
    expect(payload.type).toBe(2);
    expect(payload.channel_id).toBe("test-channel");
    expect(payload.guild_id).toBe("test-server");
    expect(payload.nonce).toBe("nonce-1");
    expect(payload.data.name).toBe("public");
    expect(payload.data.id).toBe("cmd-id-public");
    expect(payload.application_id).toBe("app-id");
  });

  it("builds privatePayload with correct structure", async () => {
    const payload = await cmd.privatePayload("nonce-2");
    expect(payload.type).toBe(2);
    expect(payload.data.name).toBe("private");
    expect(payload.data.id).toBe("cmd-id-private");
    expect(payload.nonce).toBe("nonce-2");
  });

  it("builds stealthPayload with correct structure", async () => {
    const payload = await cmd.stealthPayload("nonce-3");
    expect(payload.type).toBe(2);
    expect(payload.data.name).toBe("stealth");
    expect(payload.data.id).toBe("cmd-id-stealth");
    expect(payload.nonce).toBe("nonce-3");
  });

  it("payloads have no options (parameter-less commands)", async () => {
    for (const method of ["publicPayload", "privatePayload", "stealthPayload"] as const) {
      const payload = await (cmd as any)[method]();
      expect(payload.data.options).toEqual([]);
    }
  });
});

// ── API layer tests (MidjourneyApi) ──────────────────────────────────

describe("MidjourneyApi mode methods", () => {
  it("PublicApi sends the public payload and returns status", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValue({ status: 204 });

    const api = new MidjourneyApi(
      makeConfig({ fetch: fetchMock as any })
    );
    // Pre-populate cache
    api.cache["public"] = {
      id: "cmd-id-public",
      name: "public",
      version: "v-public",
      type: 1,
      application_id: "app-id",
    } as any;

    const status = await api.PublicApi("nonce");
    expect(status).toBe(204);
    // Last call should be the interactions POST
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(lastCall[0]).toContain("/interactions");
    const body = JSON.parse(lastCall[1].body);
    expect(body.data.name).toBe("public");
  });

  it("PrivateApi sends the private payload and returns status", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValue({ status: 204 });

    const api = new MidjourneyApi(
      makeConfig({ fetch: fetchMock as any })
    );
    api.cache["private"] = {
      id: "cmd-id-private",
      name: "private",
      version: "v-private",
      type: 1,
      application_id: "app-id",
    } as any;

    const status = await api.PrivateApi("nonce");
    expect(status).toBe(204);
  });

  it("StealthApi sends the stealth payload and returns status", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValue({ status: 204 });

    const api = new MidjourneyApi(
      makeConfig({ fetch: fetchMock as any })
    );
    api.cache["stealth"] = {
      id: "cmd-id-stealth",
      name: "stealth",
      version: "v-stealth",
      type: 1,
      application_id: "app-id",
    } as any;

    const status = await api.StealthApi("nonce");
    expect(status).toBe(204);
  });

  it("returns non-204 status when the interaction fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 403 });

    const api = new MidjourneyApi(
      makeConfig({ fetch: fetchMock as any })
    );
    api.cache["public"] = {
      id: "cmd-id-public",
      name: "public",
      version: "v-public",
      type: 1,
      application_id: "app-id",
    } as any;

    const status = await api.PublicApi("nonce");
    expect(status).toBe(403);
  });

  it("returns 500 when fetch throws", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("network error"));

    const api = new MidjourneyApi(
      makeConfig({ fetch: fetchMock as any })
    );
    api.cache["private"] = {
      id: "cmd-id-private",
      name: "private",
      version: "v-private",
      type: 1,
      application_id: "app-id",
    } as any;

    const status = await api.PrivateApi("nonce");
    expect(status).toBe(500);
  });
});

// ── High-level Midjourney class tests ────────────────────────────────

describe("Midjourney visibility mode methods", () => {
  function makeClient(httpStatus: number) {
    const fetchMock = jest.fn().mockResolvedValue({ status: httpStatus });
    const client = new Midjourney({
      SalaiToken: "test-token",
      ChannelId: "test-channel",
      ServerId: "test-server",
      Ws: false,
      fetch: fetchMock as any,
    });
    // Pre-populate command caches so we skip the fetch for command discovery
    for (const name of ["public", "private", "stealth"]) {
      client.MJApi.cache[name as keyof typeof client.MJApi.cache] = {
        id: `cmd-id-${name}`,
        name,
        version: `v-${name}`,
        type: 1,
        application_id: "app-id",
      } as any;
    }
    return { client, fetchMock };
  }

  it("Public() succeeds when status is 204", async () => {
    const { client } = makeClient(204);
    await expect(client.Public()).resolves.toBeNull();
  });

  it("Private() succeeds when status is 204", async () => {
    const { client } = makeClient(204);
    await expect(client.Private()).resolves.toBeNull();
  });

  it("Stealth() succeeds when status is 204", async () => {
    const { client } = makeClient(204);
    await expect(client.Stealth()).resolves.toBeNull();
  });

  it("Public() throws on non-204 status", async () => {
    const { client } = makeClient(403);
    await expect(client.Public()).rejects.toThrow(
      "Public mode switch failed with status 403"
    );
  });

  it("Private() throws on non-204 status", async () => {
    const { client } = makeClient(500);
    await expect(client.Private()).rejects.toThrow(
      "Private mode switch failed with status 500"
    );
  });

  it("Stealth() throws on non-204 status", async () => {
    const { client } = makeClient(401);
    await expect(client.Stealth()).rejects.toThrow(
      "Stealth mode switch failed with status 401"
    );
  });

  it("sends POST to /interactions with the right body shape", async () => {
    const { client, fetchMock } = makeClient(204);
    await client.Private();

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("/api/v9/interactions");
    const body = JSON.parse(call[1].body);
    expect(body.type).toBe(2);
    expect(body.data.name).toBe("private");
    expect(body.channel_id).toBe("test-channel");
    expect(body.guild_id).toBe("test-server");
  });
});

// ── WsMessage.waitModeConfirmation tests ─────────────────────────────

describe("WsMessage.waitModeConfirmation", () => {
  // We need to test the WsMessage class directly, but it requires a real
  // WebSocket. We'll create a minimal mock and only test the event logic.
  it("resolves with mode data when event is emitted", async () => {
    // Use a lightweight approach: instantiate WsMessage with a fake ws
    // that we control, then emit the event manually.
    const { WsMessage } = require("../src/discord.ws");

    // Create a fake WebSocket
    const fakeWs: any = {
      readyState: 1,
      OPEN: 1,
      send: jest.fn(),
      addEventListener: jest.fn(),
      close: jest.fn(),
    };

    const config = makeConfig({
      WebSocket: jest.fn().mockReturnValue(fakeWs) as any,
    });

    const api = new MidjourneyApi(config);
    const wsMsg = new WsMessage(config, api);

    // Trigger the confirmation after a short delay
    setTimeout(() => {
      wsMsg.emit("visibility-mode", { mode: "private", content: "You are now in Private mode" });
    }, 50);

    const result = await wsMsg.waitModeConfirmation(2000);
    expect(result).toEqual({ mode: "private", content: "You are now in Private mode" });
    wsMsg.close();
  });

  it("resolves with null on timeout", async () => {
    const { WsMessage } = require("../src/discord.ws");

    const fakeWs: any = {
      readyState: 1,
      OPEN: 1,
      send: jest.fn(),
      addEventListener: jest.fn(),
      close: jest.fn(),
    };

    const config = makeConfig({
      WebSocket: jest.fn().mockReturnValue(fakeWs) as any,
    });

    const api = new MidjourneyApi(config);
    const wsMsg = new WsMessage(config, api);

    const result = await wsMsg.waitModeConfirmation(100);
    expect(result).toBeNull();
    wsMsg.close();
  });
});

// ── WebSocket branch: mode switch with confirmation ──────────────────

describe("Midjourney visibility mode with WebSocket", () => {
  it("returns confirmation object when ws is enabled and event fires", async () => {
    const { WsMessage } = require("../src/discord.ws");

    // Build a fake ws
    const fakeWs: any = {
      readyState: 1,
      OPEN: 1,
      send: jest.fn(),
      addEventListener: jest.fn(),
      close: jest.fn(),
    };

    const fetchMock = jest.fn().mockResolvedValue({ status: 204 });

    const client = new Midjourney({
      SalaiToken: "test-token",
      ChannelId: "test-channel",
      ServerId: "test-server",
      Ws: true,
      fetch: fetchMock as any,
      WebSocket: jest.fn().mockReturnValue(fakeWs) as any,
    });

    // Pre-populate caches
    for (const name of ["public", "private", "stealth"]) {
      client.MJApi.cache[name as keyof typeof client.MJApi.cache] = {
        id: `cmd-id-${name}`,
        name,
        version: `v-${name}`,
        type: 1,
        application_id: "app-id",
      } as any;
    }

    // Manually inject a wsClient so we don't need a real connection
    const api = client.MJApi;
    const wsMsg = new WsMessage(client.config, api);
    (client as any).wsClient = wsMsg;

    // Fire the confirmation event after a brief delay
    setTimeout(() => {
      wsMsg.emit("visibility-mode", { mode: "stealth", content: "You are now in Stealth mode" });
    }, 50);

    const result = await client.Stealth();
    expect(result).toEqual({ mode: "stealth", content: "You are now in Stealth mode" });
    wsMsg.close();
  });
});
