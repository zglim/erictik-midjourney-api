# describe

Get prompt suggestions for an image (the `/describe` command).

`Describe` accepts any supported image source: a remote `http(s)` URL, a local
file path (Node.js), a `data:` URI, a `Blob`, a `Buffer`, a `Uint8Array` or an
`ArrayBuffer`.

```typescript
import { readFile } from "fs/promises";
import { Midjourney } from "midjourney";

const client = new Midjourney({
  ServerId: <string>process.env.SERVER_ID,
  ChannelId: <string>process.env.CHANNEL_ID,
  SalaiToken: <string>process.env.SALAI_TOKEN,
  Ws: true,
});
await client.Connect();

// 1) local file path
const fromFile = await client.Describe("./images/cat.png");

// 2) Buffer
const fromBuffer = await client.Describe(await readFile("./images/cat.png"));

// 3) remote URL
const fromUrl = await client.Describe("https://example.com/cat.png");

console.log(fromFile?.descriptions);
client.Close();
```

`Describe` resolves to an `MJDescribe` (or `null`):

```typescript
export interface MJDescribe {
  id: string;
  flags: number;
  uri: string;
  proxy_url?: string;
  options: MJOptions[];
  descriptions: string[];
}
```

## Backwards compatibility

`DescribeByBlob(blob)` is still available and now delegates to the same unified
pipeline, so `Describe(blob)` and `DescribeByBlob(blob)` are equivalent.

```typescript
const blob = new Blob([await readFile("./images/cat.png")], {
  type: "image/png",
});
await client.DescribeByBlob(blob); // deprecated, prefer client.Describe(blob)
```

See [example/describe.ts](https://github.com/erictik/midjourney-client/blob/main/example/describe.ts).
