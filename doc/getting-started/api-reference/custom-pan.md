# CustomPan

Pan (extend) an upscaled image in a given direction using the high-level `CustomPan` API.

## Usage

```typescript
import { Midjourney } from "midjourney";

const client = new Midjourney({
  ServerId: process.env.SERVER_ID,
  ChannelId: process.env.CHANNEL_ID,
  SalaiToken: process.env.SALAI_TOKEN,
  Ws: true, // WebSocket is required for CustomPan
});
await client.init();

// 1. Generate an image
const imagine = await client.Imagine("a cozy cabin in the woods");

// 2. Upscale one of the results
const upscale = await client.Upscale({
  index: 1,
  msgId: imagine.id,
  hash: imagine.hash,
  flags: imagine.flags,
});

// 3. Pan right
const panRight = await client.CustomPan({
  msgId: upscale.id,
  flags: upscale.flags,
  direction: "right", // "left" | "right" | "up" | "down"
  amount: 2,          // pan multiplier (default: 2)
  prompt: "a cozy cabin in the woods",
  options: upscale.options,
});
```

## Parameters

| Parameter   | Type                                      | Required | Description                                      |
|-------------|-------------------------------------------|----------|--------------------------------------------------|
| `msgId`     | `string`                                  | Yes      | The message ID of the upscaled image             |
| `flags`     | `number`                                  | Yes      | Message flags from the source message            |
| `direction` | `"left" \| "right" \| "up" \| "down"`     | Yes      | Direction to pan the image                       |
| `amount`    | `number`                                  | No       | Pan multiplier (default: `2`)                    |
| `prompt`    | `string`                                  | No       | The prompt to use (defaults to empty string)     |
| `options`   | `MJOptions[]`                             | No       | Options from the source message                  |
| `loading`   | `(uri: string, progress: string) => void` | No       | Loading callback                                 |

## Notes

- Keep **Remix mode** turned off in your settings for pan to work correctly.
- Pan buttons (`⬅️ ⬆️ ⬇️ ➡️`) are typically available on upscaled images.
- The `options` parameter should be passed from the source message's `options` array so the SDK can locate the correct pan button automatically.

## CustomButton

For other button-based operations that don't have a dedicated high-level API, use `CustomButton`:

```typescript
const result = await client.CustomButton({
  msgId: upscale.id,
  flags: upscale.flags,
  label: "Vary (Strong)",
  options: upscale.options,
  content: "a cozy cabin in the woods", // optional, for remix-like operations
});
```

`CustomButton` finds the button by its label in the message options and delegates to `Custom`. This works for any button visible in the message options, including `Custom Zoom`, `Vary (Strong)`, `Vary (Subtle)`, pan directions, etc.

## Example

See [example/custompan.ts](https://github.com/erictik/midjourney-client/blob/main/example/custompan.ts) for a complete working example.
