# stealth

Switch the generation visibility mode. There are three modes, all exposed on the
`Midjourney` instance with the same calling convention as `Fast` / `Relax`:

- `Public()` &nbsp;&mdash; generations are visible in the public gallery.
- `Private()` / `Stealth()` &nbsp;&mdash; hide generations from the public gallery (requires a plan that supports stealth mode).

In websocket mode the call resolves with the bot's confirmation message
(e.g. `Stealth mode turned on!`). Without websocket it resolves with `null` once
the request is accepted. Use `Visibility()` (or `Info()`) to confirm the change.

```typescript
import { Midjourney } from "midjourney";

const client = new Midjourney({
  ServerId: <string>process.env.SERVER_ID,
  ChannelId: <string>process.env.CHANNEL_ID,
  SalaiToken: <string>process.env.SALAI_TOKEN,
  Ws: true, // ws is required to receive the confirmation message
});
await client.Connect();

console.log("before:", await client.Visibility());
const msg = await client.Stealth(); // or client.Public() / client.Private()
console.log("confirmation:", msg);
console.log("after:", await client.Visibility());

client.Close();
```
