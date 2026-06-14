# pan

Custom Pan expands an (upscaled) image in a direction. The pan buttons
(`⬅️ ⬆️ ⬇️ ➡️`) only appear on a message's `options`, so `Pan` takes the
message you want to pan from and resolves the right button for you — no manual
`options.find(...)` needed.

> Keep remix turned off in your settings for this to work, and enable `Ws: true`.

## `client.Pan`

```typescript
const PanRight = await client.Pan({
  msg: Upscale, // a message that carries the pan buttons (e.g. an upscale result)
  direction: "right", // "left" | "right" | "up" | "down"
  amount: 2, // optional, defaults to 2
  prompt, // optional, submit content becomes `${prompt} --pan_right ${amount}`
  loading: (uri, progress) => console.log("loading", uri, progress),
});
```

| param       | type                                  | description                                                                     |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| `msg`       | `MJMessage`                           | The message to pan from. Its `options` must contain the pan button.             |
| `direction` | `"left" \| "right" \| "up" \| "down"` | Pan direction. Throws on any other value.                                       |
| `amount`    | `number`                              | Optional pan amount, defaults to `2`.                                           |
| `prompt`    | `string`                              | Optional. When set, submit content is `${prompt} --pan_${direction} ${amount}`. |
| `content`   | `string`                              | Optional. Overrides the generated submit content entirely.                      |
| `loading`   | `(uri, progress) => void`             | Optional progress callback.                                                     |

## `client.CustomByLabel`

`Pan` is built on `CustomByLabel`, a generic helper for pressing any button
that is only reachable from a message's `options` (custom zoom, pan, …):

```typescript
const CustomZoom = await client.CustomByLabel({
  msg: Upscale,
  label: "Custom Zoom",
  content: `${prompt} --zoom 2`,
});
```

It finds the option whose `label` matches, then runs it through the shared
`Custom` pipeline (loading callback + websocket wait). It throws
`option "<label>" not found` when the button is missing.

See the full runnable example at
[`example/custompan.ts`](https://github.com/erictik/midjourney-client/blob/main/example/custompan.ts):

```bash
npx tsx example/custompan.ts
```
