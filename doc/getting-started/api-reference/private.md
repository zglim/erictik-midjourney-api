# private

Switch the Midjourney bot to **private** visibility mode. Generated images will
only be visible to you and will not appear in the public gallery.

> Requires a Midjourney subscription that includes private mode (e.g. Pro
> plan or higher).

```typescript
await client.Private();
```

## Verifying the change

After switching, call `Info()` (or the convenience wrapper
`verifyVisibilityMode()`) to confirm the mode was actually applied:

```typescript
await client.Private();
const mode = await client.verifyVisibilityMode();
console.log(mode); // "Private"
```

## WebSocket behaviour

When `Ws: true` is set, `Private()` will also wait for the system
confirmation message that the Midjourney bot sends after the switch and return
it:

```typescript
const confirmation = await client.Private();
// confirmation: { mode: "private", content: "..." } | null
```

## See also

- [public](public.md)
- [stealth](stealth.md)
- [fast](fast.md) / [relax](relax.md)
