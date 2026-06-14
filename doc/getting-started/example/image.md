# Image

All image features (`Describe`, `FaceSwap`) and the shared upload helpers accept
the same set of image sources, so you never have to convert inputs by hand:

| Input                                   | Example                                    |
| --------------------------------------- | ------------------------------------------ |
| remote URL                              | `"https://example.com/cat.png"`            |
| local file path (Node.js)               | `"./images/cat.png"`                       |
| `data:` URI                             | `"data:image/png;base64,..."`              |
| `Blob`                                  | `new Blob([bytes], { type: "image/png" })` |
| `Buffer` / `Uint8Array` / `ArrayBuffer` | `await fs.promises.readFile("cat.png")`    |

## Upload an image

`MJApi.UploadImage` is the single entry point used internally by every image
feature. It resolves any supported input and returns the Discord attachment
descriptor.

```typescript
import { readFile } from "fs/promises";
import { Midjourney } from "midjourney";

const client = new Midjourney({
  ServerId: <string>process.env.SERVER_ID,
  ChannelId: <string>process.env.CHANNEL_ID,
  SalaiToken: <string>process.env.SALAI_TOKEN,
});

// local file path
await client.MJApi.UploadImage("./images/cat.png");

// Buffer
await client.MJApi.UploadImage(await readFile("./images/cat.png"));

// Blob
await client.MJApi.UploadImage(
  new Blob([await readFile("./images/cat.png")], { type: "image/png" })
);

// remote URL
await client.MJApi.UploadImage("https://example.com/cat.png");
```

## Upload several images

`MJApi.UploadImages` validates the number of images up-front (before any network
request), which is handy for features like blend that expect a bounded list.

```typescript
const images = await client.MJApi.UploadImages(
  ["./images/a.png", "./images/b.png"],
  { min: 2, max: 5 }
);
```

## Low-level resolver

If you only need the normalized bytes (for example to feed another API), use
`resolveImage` / `resolveImages` directly:

```typescript
import { resolveImage } from "midjourney";

const resolved = await resolveImage("./images/cat.png");
// { data: Uint8Array, mimeType: "image/png", filename: "cat.png", file_size: 12345 }
```

## Validation

Invalid inputs fail fast with a clear error before any Discord request is made:

- empty input (`""`, `null`, empty `Buffer`/`Blob`)
- local file that does not exist
- unsupported input type
- wrong number of images for `UploadImages` / `resolveImages`

See [example/describe.ts](https://github.com/erictik/midjourney-client/blob/main/example/describe.ts),
[example/upload-image.ts](https://github.com/erictik/midjourney-client/blob/main/example/upload-image.ts)
and [example/faceswap-local.ts](https://github.com/erictik/midjourney-client/blob/main/example/faceswap-local.ts).
