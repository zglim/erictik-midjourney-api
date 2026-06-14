# stealth

Switch the Midjourney bot to **stealth** visibility mode. Generated images will
not appear in the public gallery and will not be visible to other users in the
Discord channel.

> Requires a Midjourney subscription that includes stealth mode (e.g. Pro
> plan or higher).

```typescript
await client.Stealth();
```

## Verifying the change

After switching, call `Info()` (or the convenience wrapper
`verifyVisibilityMode()`) to confirm the mode was actually applied:

```typescript
await client.Stealth();
const mode = await client.verifyVisibilityMode();
console.log(mode); // "Stealth"
```

## WebSocket behaviour

When `Ws: true` is set, `Stealth()` will also wait for the system
confirmation message that the Midjourney bot sends after the switch and return
it:

```typescript
const confirmation = await client.Stealth();
// confirmation: { mode: "stealth", content: "..." } | null
```

## See also

- [public](public.md)
- [private](private.md)
- [fast](fast.md) / [relax](relax.md)
