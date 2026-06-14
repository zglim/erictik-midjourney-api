# describe

Describe an image and receive four prompt suggestions.

## Signature

```typescript
async Describe(source: ImageSource): Promise<MJDescribe | undefined>
```

`ImageSource` can be:
- **Remote URL** (string starting with `http://` or `https://`)
- **Local file path** (any other string)
- **Blob** (browser or Node.js 18+ Blob)
- **Buffer** (Node.js Buffer)

## Examples

### Remote URL

```typescript
const result = await client.Describe(
  "https://cdn.discordapp.com/attachments/.../photo.png"
);
console.log(result?.descriptions);
```

### Local file

```typescript
const result = await client.Describe("./images/photo.png");
console.log(result?.descriptions);
```

### Buffer

```typescript
import * as fs from "fs";
const buf = fs.readFileSync("./images/photo.png");
const result = await client.Describe(buf);
console.log(result?.descriptions);
```

### Blob (backward compatible)

```typescript
// Using the legacy DescribeByBlob entry point (still works):
const result = await client.DescribeByBlob(blob);

// Or directly via the unified Describe:
const result = await client.Describe(blob);
```

## See also

- [example/describe.ts](../../example/describe.ts) — URL input
- [example/describe-local.ts](../../example/describe-local.ts) — local file input
- [example/describe-buffer.ts](../../example/describe-buffer.ts) — Buffer input
