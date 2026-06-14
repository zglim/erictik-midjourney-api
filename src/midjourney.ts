import {
  DefaultMJConfig,
  LoadingHandler,
  MJConfig,
  MJConfigParam,
  MJSettings,
  MJSettingsTarget,
} from "./interfaces";
import { MidjourneyApi } from "./midjourney.api";
import { MidjourneyMessage } from "./discord.message";
import {
  toRemixCustom,
  custom2Type,
  nextNonce,
  random,
  base64ToBlob,
  findSettingsOption,
  isSettingEnabled,
} from "./utils";
import { WsMessage } from "./discord.ws";
import { faceSwap } from "./face.swap";
export class Midjourney extends MidjourneyMessage {
  public config: MJConfig;
  private wsClient?: WsMessage;
  public MJApi: MidjourneyApi;
  constructor(defaults: MJConfigParam) {
    const { SalaiToken } = defaults;
    if (!SalaiToken) {
      throw new Error("SalaiToken are required");
    }
    super(defaults);
    this.config = {
      ...DefaultMJConfig,
      ...defaults,
    };
    this.MJApi = new MidjourneyApi(this.config);
  }
  async Connect() {
    if (!this.config.Ws) {
      return this;
    }
    await this.MJApi.allCommand();
    if (this.wsClient) return this;
    this.wsClient = new WsMessage(this.config, this.MJApi);
    await this.wsClient.onceReady();
    return this;
  }
  async init() {
    await this.Connect();
    const settings = await this.Settings();
    if (settings) {
      // this.log(`settings:`, settings.content);
      this.syncRemixConfig(settings);
    }
    return this;
  }
  async Imagine(prompt: string, loading?: LoadingHandler) {
    prompt = prompt.trim();
    if (!this.config.Ws) {
      const seed = random(1000000000, 9999999999);
      prompt = `[${seed}] ${prompt}`;
    } else {
      await this.getWsClient();
    }

    const nonce = nextNonce();
    this.log(`Imagine`, prompt, "nonce", nonce);
    const httpStatus = await this.MJApi.ImagineApi(prompt, nonce);
    if (httpStatus !== 204) {
      throw new Error(`ImagineApi failed with status ${httpStatus}`);
    }
    if (this.wsClient) {
      return await this.wsClient.waitImageMessage({ nonce, loading, prompt });
    } else {
      this.log(`await generate image`);
      const msg = await this.WaitMessage(prompt, loading);
      this.log(`image generated`, prompt, msg?.uri);
      return msg;
    }
  }
  // check ws enabled && connect
  private async getWsClient() {
    if (!this.config.Ws) {
      throw new Error(`ws not enabled`);
    }
    if (!this.wsClient) {
      await this.Connect();
    }
    if (!this.wsClient) {
      throw new Error(`ws not connected`);
    }
    return this.wsClient;
  }

  /**
   * Read capability: fetch the current `/settings` panel (`MJSettings`),
   * including every toggle/option and its on/off state.
   */
  async Settings() {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.SettingsApi(nonce);
    if (httpStatus !== 204) {
      throw new Error(`SettingsApi failed with status ${httpStatus}`);
    }
    return wsClient.waitSettings();
  }

  /**
   * Write capability: click / toggle a single entry on the `/settings` panel by
   * label, custom id, or an explicit {@link MJSettingsTarget}, instead of
   * manually parsing `options` and calling `CustomApi`. Pass an existing
   * `settings` snapshot to reuse it instead of re-fetching the panel. Returns
   * the refreshed panel reflecting the new state.
   */
  async UpdateSetting(
    target: string | MJSettingsTarget,
    settings?: MJSettings
  ) {
    const current = settings ?? (await this.Settings());
    if (!current) {
      throw new Error(`Settings not found`);
    }
    const option = findSettingsOption(current.options, target);
    if (!option) {
      throw new Error(
        `Settings option not found: ${this.describeTarget(target)}`
      );
    }
    const httpStatus = await this.MJApi.CustomApi({
      msgId: current.id,
      customId: option.custom,
      flags: current.flags,
    });
    if (httpStatus !== 204) {
      throw new Error(`UpdateSetting failed with status ${httpStatus}`);
    }
    return this.Settings();
  }

  /**
   * Closed-loop capability: make sure a toggle style setting (e.g. "Remix mode")
   * ends up `enabled`/disabled, reading its current state first and skipping the
   * click when it is already correct. Returns the panel reflecting the final
   * state.
   */
  async EnsureSetting(
    target: string | MJSettingsTarget,
    enabled: boolean,
    settings?: MJSettings
  ) {
    const current = settings ?? (await this.Settings());
    if (!current) {
      throw new Error(`Settings not found`);
    }
    const option = findSettingsOption(current.options, target);
    if (!option) {
      throw new Error(
        `Settings option not found: ${this.describeTarget(target)}`
      );
    }
    if (isSettingEnabled(option) === enabled) {
      // already in the desired state, avoid a useless toggle
      return current;
    }
    return this.UpdateSetting(target, current);
  }

  private describeTarget(target: string | MJSettingsTarget) {
    if (typeof target === "string") return target;
    return target.label ?? target.custom ?? "";
  }

  /**
   * Reset all settings to default. Delegates to the shared {@link UpdateSetting}
   * flow by clicking the "Reset Settings" entry on the `/settings` panel.
   */
  async Reset() {
    await this.UpdateSetting("Reset Settings");
  }

  async Info() {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.InfoApi(nonce);
    if (httpStatus !== 204) {
      throw new Error(`InfoApi failed with status ${httpStatus}`);
    }
    return wsClient.waitInfo();
  }

  async Fast() {
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.FastApi(nonce);
    if (httpStatus !== 204) {
      throw new Error(`FastApi failed with status ${httpStatus}`);
    }
    return null;
  }
  async Relax() {
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.RelaxApi(nonce);
    if (httpStatus !== 204) {
      throw new Error(`RelaxApi failed with status ${httpStatus}`);
    }
    return null;
  }
  /**
   * Toggle "Remix mode" through the shared {@link UpdateSetting} flow and keep
   * `config.Remix` in sync. Use {@link SetRemix} when you need a specific state
   * instead of a blind toggle.
   */
  async SwitchRemix() {
    const settings = await this.UpdateSetting("Remix mode");
    return this.syncRemixConfig(settings);
  }

  /**
   * Ensure "Remix mode" ends up `enabled`/disabled without toggling blindly,
   * keeping `config.Remix` in sync. Builds on {@link EnsureSetting}.
   */
  async SetRemix(enabled: boolean) {
    const settings = await this.EnsureSetting("Remix mode", enabled);
    return this.syncRemixConfig(settings);
  }

  private syncRemixConfig(settings: MJSettings | null) {
    if (settings) {
      const remix = findSettingsOption(settings.options, "Remix mode");
      if (remix) {
        this.config.Remix = isSettingEnabled(remix);
        this.log(`Remix mode ${this.config.Remix ? "enabled" : "disabled"}`);
      }
    }
    return settings;
  }
  async Describe(imgUri: string) {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const DcImage = await this.MJApi.UploadImageByUri(imgUri);
    this.log(`Describe`, DcImage);
    const httpStatus = await this.MJApi.DescribeApi(DcImage, nonce);
    if (httpStatus !== 204) {
      throw new Error(`DescribeApi failed with status ${httpStatus}`);
    }
    return wsClient.waitDescribe(nonce);
  }
  async DescribeByBlob(blob: Blob) {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const DcImage = await this.MJApi.UploadImageByBole(blob);
    this.log(`Describe`, DcImage);
    const httpStatus = await this.MJApi.DescribeApi(DcImage, nonce);
    if (httpStatus !== 204) {
      throw new Error(`DescribeApi failed with status ${httpStatus}`);
    }
    return wsClient.waitDescribe(nonce);
  }

  async Shorten(prompt: string) {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.ShortenApi(prompt, nonce);
    if (httpStatus !== 204) {
      throw new Error(`ShortenApi failed with status ${httpStatus}`);
    }
    return wsClient.waitShorten(nonce);
  }

  async Variation({
    index,
    msgId,
    hash,
    content,
    flags,
    loading,
  }: {
    index: 1 | 2 | 3 | 4;
    msgId: string;
    hash: string;
    content?: string;
    flags: number;
    loading?: LoadingHandler;
  }) {
    return await this.Custom({
      customId: `MJ::JOB::variation::${index}::${hash}`,
      msgId,
      content,
      flags,
      loading,
    });
  }

  async Upscale({
    index,
    msgId,
    hash,
    content,
    flags,
    loading,
  }: {
    index: 1 | 2 | 3 | 4;
    msgId: string;
    hash: string;
    content?: string;
    flags: number;
    loading?: LoadingHandler;
  }) {
    return await this.Custom({
      customId: `MJ::JOB::upsample::${index}::${hash}`,
      msgId,
      content,
      flags,
      loading,
    });
  }

  async Custom({
    msgId,
    customId,
    content,
    flags,
    loading,
  }: {
    msgId: string;
    customId: string;
    content?: string;
    flags: number;
    loading?: LoadingHandler;
  }) {
    if (this.config.Ws) {
      await this.getWsClient();
    }
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.CustomApi({
      msgId,
      customId,
      flags,
      nonce,
    });
    if (httpStatus !== 204) {
      throw new Error(`CustomApi failed with status ${httpStatus}`);
    }
    if (this.wsClient) {
      return await this.wsClient.waitImageMessage({
        nonce,
        loading,
        messageId: msgId,
        prompt: content,
        onmodal: async (nonde, id) => {
          if (content === undefined || content === "") {
            return "";
          }
          const newNonce = nextNonce();
          switch (custom2Type(customId)) {
            case "customZoom":
              const httpStatus = await this.MJApi.CustomZoomImagineApi({
                msgId: id,
                customId,
                prompt: content,
                nonce: newNonce,
              });
              if (httpStatus !== 204) {
                throw new Error(
                  `CustomZoomImagineApi failed with status ${httpStatus}`
                );
              }
              return newNonce;
            case "variation":
              if (this.config.Remix !== true) {
                return "";
              }
              customId = toRemixCustom(customId);
              const remixHttpStatus = await this.MJApi.RemixApi({
                msgId: id,
                customId,
                prompt: content,
                nonce: newNonce,
              });
              if (remixHttpStatus !== 204) {
                throw new Error(
                  `RemixApi failed with status ${remixHttpStatus}`
                );
              }
              return newNonce;
            default:
              return "";
              throw new Error(`unknown customId ${customId}`);
          }
        },
      });
    }
    if (content === undefined || content === "") {
      throw new Error(`content is required`);
    }
    return await this.WaitMessage(content, loading);
  }

  async ZoomOut({
    level,
    msgId,
    hash,
    content,
    flags,
    loading,
  }: {
    level: "high" | "low" | "2x" | "1.5x";
    msgId: string;
    hash: string;
    content?: string;
    flags: number;
    loading?: LoadingHandler;
  }) {
    let customId: string;
    switch (level) {
      case "high":
        customId = `MJ::JOB::high_variation::1::${hash}::SOLO`;
        break;
      case "low":
        customId = `MJ::JOB::low_variation::1::${hash}::SOLO`;
        break;
      case "2x":
        customId = `MJ::Outpaint::50::1::${hash}::SOLO`;
        break;
      case "1.5x":
        customId = `MJ::Outpaint::75::1::${hash}::SOLO`;
        break;
    }
    return this.Custom({
      msgId,
      customId,
      content,
      flags,
      loading,
    });
  }

  async Reroll({
    msgId,
    hash,
    content,
    flags,
    loading,
  }: {
    msgId: string;
    hash: string;
    content?: string;
    flags: number;
    loading?: LoadingHandler;
  }) {
    return await this.Custom({
      customId: `MJ::JOB::reroll::0::${hash}::SOLO`,
      msgId,
      content,
      flags,
      loading,
    });
  }

  async FaceSwap(target: string, source: string) {
    const wsClient = await this.getWsClient();
    const app = new faceSwap(this.config.HuggingFaceToken);
    const Target = await (await this.config.fetch(target)).blob();
    const Source = await (await this.config.fetch(source)).blob();
    const res = await app.changeFace(Target, Source);
    this.log(res[0]);
    const blob = await base64ToBlob(res[0] as string);
    const DcImage = await this.MJApi.UploadImageByBole(blob);
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.DescribeApi(DcImage, nonce);
    if (httpStatus !== 204) {
      throw new Error(`DescribeApi failed with status ${httpStatus}`);
    }
    return wsClient.waitDescribe(nonce);
  }

  Close() {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = undefined;
    }
  }
}
