import {
  CustomZoomModalSubmitID,
  DescribeModalSubmitID,
  DiscordImage,
  MJConfig,
  ModalSubmitID,
  RemixModalSubmitID,
  ShortenModalSubmitID,
  UploadParam,
  UploadSlot,
} from "./interfaces";
import {
  ImageSource,
  resolveImageSource,
  validateResolvedImage,
} from "./image-source";

import { nextNonce, sleep } from "./utils";
import { Command } from "./command";
import async from "async";

export class MidjourneyApi extends Command {
  UpId = Date.now() % 10; // upload id
  constructor(public config: MJConfig) {
    super(config);
  }
  private safeIteractions = (request: any) => {
    return new Promise<number>((resolve, reject) => {
      this.queue.push(
        {
          request,
          callback: (any: any) => {
            resolve(any);
          },
        },
        (error: any, result: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  };
  private processRequest = async ({
    request,
    callback,
  }: {
    request: any;
    callback: (any: any) => void;
  }) => {
    const httpStatus = await this.interactions(request);
    callback(httpStatus);
    await sleep(this.config.ApiInterval);
  };
  private queue = async.queue(this.processRequest, 1);
  private interactions = async (payload: any) => {
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: this.config.SalaiToken,
      };
      const response = await this.config.fetch(
        `${this.config.DiscordBaseUrl}/api/v9/interactions`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: headers,
        }
      );
      if (response.status >= 400) {
        console.error("api.error.config", {
          payload: JSON.stringify(payload),
          config: this.config,
        });
      }
      return response.status;
    } catch (error) {
      console.error(error);
      return 500;
    }
  };

  async ImagineApi(prompt: string, nonce: string = nextNonce()) {
    const payload = await this.imaginePayload(prompt, nonce);
    return this.safeIteractions(payload);
  }

  async SwitchRemixApi(nonce: string = nextNonce()) {
    const payload = await this.PreferPayload(nonce);
    return this.safeIteractions(payload);
  }

  async ShortenApi(prompt: string, nonce: string = nextNonce()) {
    const payload = await this.shortenPayload(prompt, nonce);
    return this.safeIteractions(payload);
  }

  async VariationApi({
    index,
    msgId,
    hash,
    nonce = nextNonce(),
    flags = 0,
  }: {
    index: 1 | 2 | 3 | 4;
    msgId: string;
    hash: string;
    nonce?: string;
    flags?: number;
  }) {
    return this.CustomApi({
      msgId,
      customId: `MJ::JOB::variation::${index}::${hash}`,
      flags,
      nonce,
    });
  }

  async UpscaleApi({
    index,
    msgId,
    hash,
    nonce = nextNonce(),
    flags,
  }: {
    index: 1 | 2 | 3 | 4;
    msgId: string;
    hash: string;
    nonce?: string;
    flags: number;
  }) {
    return this.CustomApi({
      msgId,
      customId: `MJ::JOB::upsample::${index}::${hash}`,
      flags,
      nonce,
    });
  }

  async RerollApi({
    msgId,
    hash,
    nonce = nextNonce(),
    flags,
  }: {
    msgId: string;
    hash: string;
    nonce?: string;
    flags: number;
  }) {
    return this.CustomApi({
      msgId,
      customId: `MJ::JOB::reroll::0::${hash}::SOLO`,
      flags,
      nonce,
    });
  }

  async CustomApi({
    msgId,
    customId,
    flags,
    nonce = nextNonce(),
  }: {
    msgId: string;
    customId: string;
    flags: number;
    nonce?: string;
  }) {
    if (!msgId) throw new Error("msgId is empty");
    if (flags === undefined) throw new Error("flags is undefined");
    const payload = {
      type: 3,
      nonce,
      guild_id: this.config.ServerId,
      channel_id: this.config.ChannelId,
      message_flags: flags,
      message_id: msgId,
      application_id: this.config.BotId,
      session_id: this.config.SessionId,
      data: {
        component_type: 2,
        custom_id: customId,
      },
    };
    return this.safeIteractions(payload);
  }

  //FIXME: get SubmitCustomId from discord api
  async ModalSubmitApi({
    nonce,
    msgId,
    customId,
    prompt,
    submitCustomId,
  }: {
    nonce: string;
    msgId: string;
    customId: string;
    prompt: string;
    submitCustomId: ModalSubmitID;
  }) {
    var payload = {
      type: 5,
      application_id: this.config.BotId,
      channel_id: this.config.ChannelId,
      guild_id: this.config.ServerId,
      data: {
        id: msgId,
        custom_id: customId,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: submitCustomId,
                value: prompt,
              },
            ],
          },
        ],
      },
      session_id: this.config.SessionId,
      nonce,
    };
    console.log("submitCustomId", JSON.stringify(payload));
    return this.safeIteractions(payload);
  }

  async RemixApi({
    nonce,
    msgId,
    customId,
    prompt,
  }: {
    nonce: string;
    msgId: string;
    customId: string;
    prompt: string;
  }) {
    return this.ModalSubmitApi({
      nonce,
      msgId,
      customId,
      prompt,
      submitCustomId: RemixModalSubmitID,
    });
  }

  async ShortenImagineApi({
    nonce,
    msgId,
    customId,
    prompt,
  }: {
    nonce: string;
    msgId: string;
    customId: string;
    prompt: string;
  }) {
    return this.ModalSubmitApi({
      nonce,
      msgId,
      customId,
      prompt,
      submitCustomId: ShortenModalSubmitID,
    });
  }

  async DescribeImagineApi({
    nonce,
    msgId,
    customId,
    prompt,
  }: {
    nonce: string;
    msgId: string;
    customId: string;
    prompt: string;
  }) {
    return this.ModalSubmitApi({
      nonce,
      msgId,
      customId,
      prompt,
      submitCustomId: DescribeModalSubmitID,
    });
  }

  async CustomZoomImagineApi({
    nonce,
    msgId,
    customId,
    prompt,
  }: {
    nonce: string;
    msgId: string;
    customId: string;
    prompt: string;
  }) {
    customId = customId.replace(
      "MJ::CustomZoom",
      "MJ::OutpaintCustomZoomModal"
    );
    return this.ModalSubmitApi({
      nonce,
      msgId,
      customId,
      prompt,
      submitCustomId: CustomZoomModalSubmitID,
    });
  }

  async InfoApi(nonce?: string) {
    const payload = await this.infoPayload(nonce);
    return this.safeIteractions(payload);
  }

  async SettingsApi(nonce?: string) {
    const payload = await this.settingsPayload(nonce);
    return this.safeIteractions(payload);
  }

  async FastApi(nonce?: string) {
    const payload = await this.fastPayload(nonce);
    return this.safeIteractions(payload);
  }

  async RelaxApi(nonce?: string) {
    const payload = await this.relaxPayload(nonce);
    return this.safeIteractions(payload);
  }

  /**
   * Unified image upload: accepts URL, local path, Blob or Buffer and
   * returns a {@link DiscordImage} ready for Discord API payloads.
   *
   * This is the single entry-point that all image-consuming features
   * (Describe, FaceSwap, Blend …) should delegate to.
   */
  async uploadImage(source: ImageSource): Promise<DiscordImage> {
    const resolved = await resolveImageSource(source, this.config.fetch);
    validateResolvedImage(resolved);
    const { data: fileData, mimeType, filename } = resolved;
    const file_size = fileData.byteLength;
    const { attachments } = await this.attachments({
      filename,
      file_size,
      id: this.UpId++,
    });
    const slot = attachments[0];
    await this.uploadImageToSlot(slot, fileData, mimeType);
    const resp: DiscordImage = {
      id: slot.id,
      filename: slot.upload_filename.split("/").pop() || filename,
      upload_filename: slot.upload_filename,
    };
    return resp;
  }

  /**
   * @deprecated Use `uploadImage(source)` instead. Kept for backward compatibility.
   * @param fileUrl http file path
   * @returns
   */
  async UploadImageByUri(fileUrl: string): Promise<DiscordImage> {
    return this.uploadImage(fileUrl);
  }

  /**
   * @deprecated Use `uploadImage(source)` instead. Kept for backward compatibility.
   */
  async UploadImageByBole(
    blob: Blob,
    filename?: string
  ): Promise<DiscordImage> {
    // If a custom filename was provided, we still go through the unified
    // pipeline. We resolve the blob then override the resolved filename.
    const resolved = await resolveImageSource(blob, this.config.fetch);
    if (filename) {
      resolved.filename = filename;
    }
    validateResolvedImage(resolved);
    const { data: fileData, mimeType } = resolved;
    const file_size = fileData.byteLength;
    const { attachments } = await this.attachments({
      filename: resolved.filename,
      file_size,
      id: this.UpId++,
    });
    const slot = attachments[0];
    await this.uploadImageToSlot(slot, fileData, mimeType);
    const resp: DiscordImage = {
      id: slot.id,
      filename: slot.upload_filename.split("/").pop() || resolved.filename,
      upload_filename: slot.upload_filename,
    };
    return resp;
  }

  /**
   * prepare an attachement to upload an image.
   */
  private async attachments(
    ...files: UploadParam[]
  ): Promise<{ attachments: UploadSlot[] }> {
    const { SalaiToken, DiscordBaseUrl, ChannelId, fetch } = this.config;
    const headers = {
      Authorization: SalaiToken,
      "content-type": "application/json",
    };
    const url = new URL(
      `${DiscordBaseUrl}/api/v9/channels/${ChannelId}/attachments`
    );
    const body = { files };
    const response = await this.config.fetch(url, {
      headers,
      method: "POST",
      body: JSON.stringify(body),
    });
    if (response.status === 200) {
      return (await response.json()) as { attachments: UploadSlot[] };
    }
    const error = `Attachments return ${response.status} ${
      response.statusText
    } ${await response.text()}`;
    throw new Error(error);
  }

  private async uploadImageToSlot(
    slot: UploadSlot,
    data: ArrayBuffer,
    contentType: string
  ): Promise<void> {
    const body = new Uint8Array(data);
    const headers = { "content-type": contentType };
    const response = await this.config.fetch(slot.upload_url, {
      method: "PUT",
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(
        `uploadImageToSlot return ${response.status} ${
          response.statusText
        } ${await response.text()}`
      );
    }
  }

  async DescribeApi(image: DiscordImage, nonce?: string) {
    const payload = await this.describePayload(image, nonce);
    return this.safeIteractions(payload);
  }
  async upImageApi(image: DiscordImage, nonce?: string) {
    const { SalaiToken, DiscordBaseUrl, ChannelId, fetch } = this.config;
    const payload = {
      content: "",
      nonce,
      channel_id: ChannelId,
      type: 0,
      sticker_ids: [],
      attachments: [image],
    };

    const url = new URL(
      `${DiscordBaseUrl}/api/v9/channels/${ChannelId}/messages`
    );
    const headers = {
      Authorization: SalaiToken,
      "content-type": "application/json",
    };
    const response = await fetch(url, {
      headers,
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.status;
  }
}
