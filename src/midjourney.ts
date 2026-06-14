import {
  DefaultMJConfig,
  LoadingHandler,
  MJConfig,
  MJConfigParam,
  MJOptions,
  MJSettingUpdateResult,
  MJSettings,
  ButtonStyle,
} from "./interfaces";
import { MidjourneyApi } from "./midjourney.api";
import { MidjourneyMessage } from "./discord.message";
import {
  toRemixCustom,
  custom2Type,
  nextNonce,
  random,
  base64ToBlob,
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
      // Use the new helper to detect remix state
      const remix = this.findSettingOption(settings, "Remix mode");
      if (remix && this.isSettingActive(remix)) {
        this.config.Remix = true;
        this.log(`Remix mode enabled`);
      }
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

  async Settings() {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.SettingsApi(nonce);
    if (httpStatus !== 204) {
      throw new Error(`SettingsApi failed with status ${httpStatus}`);
    }
    return wsClient.waitSettings();
  }

  // ========== Settings Management API ==========

  /**
   * Check whether a setting option is currently active (pressed/on).
   * Discord uses button style 3 (success/green) for the active setting.
   */
  isSettingActive(option: MJOptions): boolean {
    return option.style === ButtonStyle.Success;
  }

  /**
   * Find a setting option by its label (exact match).
   * @param settings  The settings message returned by Settings().
   * @param label     The label to search for (e.g. "Remix mode", "Niji version 5").
   * @returns         The matching MJOptions, or undefined if not found.
   */
  findSettingOption(
    settings: MJSettings,
    label: string
  ): MJOptions | undefined {
    return settings.options.find((o) => o.label === label);
  }

  /**
   * Find a setting option by its custom_id.
   * @param settings   The settings message returned by Settings().
   * @param customId   The custom_id to match against.
   * @returns          The matching MJOptions, or undefined if not found.
   */
  findSettingByCustomId(
    settings: MJSettings,
    customId: string
  ): MJOptions | undefined {
    return settings.options.find((o) => o.custom === customId);
  }

  /**
   * Click a setting button by its custom_id on the settings message.
   * This is the low-level primitive that all high-level setting methods
   * delegate to.
   */
  private async clickSettingButton(
    settings: MJSettings,
    customId: string
  ): Promise<number> {
    return this.MJApi.CustomApi({
      msgId: settings.id,
      customId,
      flags: settings.flags,
    });
  }

  /**
   * Ensure a specific setting is in the desired state (active or inactive).
   *
   * This is the core settings-management method. It:
   * 1. Fetches current settings.
   * 2. Locates the target setting by `label` (or `customId`).
   * 3. Checks whether the setting is already in the desired state.
   * 4. If not (or if `force` is true), clicks the button to toggle it.
   * 5. Returns a result describing what happened.
   *
   * @param params.label       The label of the setting to target (e.g. "Remix mode").
   * @param params.customId    Alternatively, target by custom_id directly.
   * @param params.targetState Desired state: true = active, false = inactive.
   *                           If omitted, the button is clicked unconditionally (toggle).
   * @param params.force       If true, click even if already in target state. Default false.
   * @returns MJSettingUpdateResult describing the operation outcome.
   *
   * @example
   * ```ts
   * // Enable Remix mode (skip if already enabled)
   * await client.updateSetting({ label: "Remix mode", targetState: true });
   *
   * // Force-toggle Niji version 5 regardless of current state
   * await client.updateSetting({ label: "Niji version 5", force: true });
   * ```
   */
  async updateSetting(params: {
    label?: string;
    customId?: string;
    targetState?: boolean;
    force?: boolean;
  }): Promise<MJSettingUpdateResult> {
    const { label, customId, targetState, force } = params;
    if (!label && !customId) {
      throw new Error(
        "updateSetting: at least one of `label` or `customId` is required"
      );
    }

    const settings = await this.Settings();
    if (!settings) {
      throw new Error("Settings not found");
    }

    // Find the target option
    const option = label
      ? this.findSettingOption(settings, label)
      : this.findSettingByCustomId(settings, customId!);

    if (!option) {
      const searchDesc = label ? `label "${label}"` : `customId "${customId}"`;
      throw new Error(`Setting not found: ${searchDesc}`);
    }

    const wasActive = this.isSettingActive(option);

    // If targetState is specified and already matches, skip unless forced
    if (targetState !== undefined && !force) {
      if (wasActive === targetState) {
        return {
          label: option.label,
          wasActive,
          isActive: wasActive,
          toggled: false,
        };
      }
    }

    // Click the button
    const httpStatus = await this.clickSettingButton(settings, option.custom);
    if (httpStatus !== 204) {
      throw new Error(
        `updateSetting: click failed with status ${httpStatus} for "${option.label}"`
      );
    }

    // After clicking a toggle, the state flips
    const isActive = targetState !== undefined ? targetState : !wasActive;

    return {
      label: option.label,
      wasActive,
      isActive,
      toggled: true,
    };
  }

  /**
   * Ensure Remix mode is in the desired state.
   *
   * Unlike the raw SwitchRemix() (which blindly toggles), this method
   * checks the current Remix state first and only acts if needed.
   * It also updates `config.Remix` so that subsequent Variation calls
   * work correctly.
   *
   * @param enabled  true to enable Remix, false to disable. Default true.
   * @returns MJSettingUpdateResult describing the operation outcome.
   *
   * @example
   * ```ts
   * // Enable remix (no-op if already on)
   * await client.ensureRemixMode(true);
   *
   * // Disable remix
   * await client.ensureRemixMode(false);
   * ```
   */
  async ensureRemixMode(
    enabled: boolean = true
  ): Promise<MJSettingUpdateResult> {
    const result = await this.updateSetting({
      label: "Remix mode",
      targetState: enabled,
    });
    // Sync config.Remix with the new state
    this.config.Remix = result.isActive;
    return result;
  }

  // ========== Legacy high-level methods (now delegated to updateSetting) ==========

  /**
   * Reset all Midjourney settings to defaults.
   * Delegates to the unified updateSetting flow internally.
   */
  async Reset() {
    const settings = await this.Settings();
    if (!settings) {
      throw new Error("Settings not found");
    }
    const reset = this.findSettingOption(settings, "Reset Settings");
    if (!reset) {
      throw new Error("Reset Settings not found");
    }
    const httpstatus = await this.clickSettingButton(settings, reset.custom);
    if (httpstatus !== 204) {
      throw new Error(`Reset failed with status ${httpstatus}`);
    }
  }

  /**
   * Toggle the Remix preference via the /prefer remix slash command.
   *
   * NOTE: This is a raw toggle — it blindly flips the state.
   * For state-aware control, use `ensureRemixMode(enabled)` instead.
   *
   * @deprecated Use `ensureRemixMode()` for state-aware remix control.
   */
  async SwitchRemix() {
    const wsClient = await this.getWsClient();
    const nonce = nextNonce();
    const httpStatus = await this.MJApi.SwitchRemixApi(nonce);
    if (httpStatus !== 204) {
      throw new Error(`SwitchRemixApi failed with status ${httpStatus}`);
    }
    return wsClient.waitContent("prefer-remix");
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
