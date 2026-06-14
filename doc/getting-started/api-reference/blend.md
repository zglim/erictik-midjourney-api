# Blend

The `Blend` method sends Midjourney's `/blend` slash command, which merges 2-5 images into a single composition. Unlike simply concatenating image URLs into an `Imagine` prompt, this uses the proper `/blend` interaction — images are uploaded to Discord first and then attached to the command, just like the Discord bot client does.

## Input

```typescript
interface BlendInput {
  /** 2-5 images. Each element can be a remote URL (string) or a Blob. */
  images: Array<string | Blob>;
  /** Optional aspect-ratio hint, e.g. "1:1", "16:9", "9:16", "4:3", "3:2", "2:3". */
  dimensions?: string;
}
```

| Parameter    | Type                  | Required | Description                                                    |
| ------------ | --------------------- | -------- | -------------------------------------------------------------- |
| `images`     | `Array<string\|Blob>` | Yes      | 2-5 image sources. Strings are treated as remote URLs.        |
| `dimensions` | `string`              | No       | Aspect-ratio hint passed to Midjourney (e.g. `"1:1"`).         |

## Usage

### Blend from remote URLs

```typescript
import { Midjourney } from "midjourney";

const client = new Midjourney({
  ServerId: process.env.SERVER_ID,
  ChannelId: process.env.CHANNEL_ID,
  SalaiToken: process.env.SALAI_TOKEN,
  Ws: true,
});
await client.Connect();

const msg = await client.Blend({
  images: [
    "https://example.com/image-a.png",
    "https://example.com/image-b.png",
  ],
  dimensions: "1:1",
});

console.log(msg);
// { uri, id, hash, content, flags, options, progress: "done", ... }
```

### Blend with a loading callback

```typescript
const msg = await client.Blend(
  {
    images: [url1, url2, url3],
  },
  (uri, progress) => {
    console.log(`Loading: ${uri} — ${progress}`);
  }
);
```

### Blend from Blob objects

```typescript
const blob1 = new Blob([buffer1], { type: "image/png" });
const blob2 = new Blob([buffer2], { type: "image/png" });

const msg = await client.Blend({ images: [blob1, blob2] });
```

### Mix URLs and Blobs

```typescript
const msg = await client.Blend({
  images: ["https://example.com/a.png", blob],
});
```

## Return Value

Returns a `MJMessage | null`:

```typescript
interface MJMessage {
  uri: string;
  proxy_url?: string;
  content: string;
  flags: number;
  id?: string;
  hash?: string;
  progress?: string;   // "done" when finished
  options?: MJOptions[];
  width?: number;
  height?: number;
}
```

## Errors

| Error                                  | Cause                                          |
| -------------------------------------- | ---------------------------------------------- |
| `Blend requires at least 2 images`     | `images` array has fewer than 2 elements.      |
| `Blend supports at most 5 images`      | `images` array has more than 5 elements.       |
| `Image at index N is invalid or missing an id` | An uploaded image did not return a valid id. |
| `BlendApi failed with status N`        | Discord rejected the interaction request.      |

## Notes

- **WebSocket mode (`Ws: true`) is required.** The `/blend` command produces a standard image message, and `waitImageMessage` relies on the WS connection to correlate the response by nonce.
- Uploaded images reuse the existing `UploadImageByUri` / `UploadImageByBole` pipeline, so there is no duplicated image-handling logic.
- The `dimensions` parameter is forwarded as a string option to the Discord interaction. Midjourney's own validation applies.
