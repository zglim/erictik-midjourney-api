# blend

`Blend` merges 2–5 images into a single new image using the Midjourney `/blend`
command. It follows the same calling convention as `Imagine`: provide an
optional `loading` handler for progress updates, and the returned value is the
final image message (`MJMessage`) or `null`.

Websocket mode (`Ws: true`) is **required**, because the blend result is
delivered as an ephemeral discord message — the same requirement as `Describe`.

### Parameters

| name         | type              | required | description                                                                           |
| ------------ | ----------------- | -------- | ------------------------------------------------------------------------------------- |
| `images`     | `BlendImage[]`    | yes      | 2 to 5 source images. Each item may be a remote URL string, `{ uri }`, or `{ blob }`. |
| `dimensions` | `BlendDimensions` | no       | Output aspect ratio: `Portrait` (2:3), `Square` (1:1, default), `Landscape` (3:2).    |
| `loading`    | `LoadingHandler`  | no       | Called with `(uri, progress)` while the blend is generating.                          |

Every entry in `images` is uploaded through the existing upload pipeline
(`UploadImageByUri` / `UploadImageByBole`), so remote URLs and in-memory Blobs
share one code path — there is no separate image pre-processing for blend.

<pre class="language-typescript"><code class="lang-typescript"><strong>import { BlendDimensions, Midjourney } from "midjourney";
</strong>async function main() {
  const client = new Midjourney({
    ServerId: "1082500871478329374",
    ChannelId: "1094892992281718894",
    SalaiToken: "your discord token",
    Ws: true, // required for blend
  });
  await client.Connect();
  const blend = await client.Blend({
    images: [
      "https://cdn.discordapp.com/attachments/.../image-one.png",
      "https://cdn.discordapp.com/attachments/.../image-two.png",
    ],
    dimensions: BlendDimensions.Square,
    loading: (uri: string, progress: string) => {
      console.log("blend.loading", uri, "progress", progress);
    },
  });
  console.log( blend );
  client.Close();
}
</code></pre>

You can also blend a local image by passing a `Blob`:

<pre class="language-typescript"><code class="lang-typescript">const blend = await client.Blend({
  images: [
    { uri: "https://cdn.discordapp.com/attachments/.../image-one.png" },
    { blob: myBlob, filename: "local.png" },
  ],
});
</code></pre>
