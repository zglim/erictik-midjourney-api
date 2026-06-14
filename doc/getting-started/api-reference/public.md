# public

Switch the Midjourney bot to **public** visibility mode. Generated images will
be visible in the public gallery.

```typescript
await client.Public();
```

## Verifying the change

After switching, call `Info()` (or the convenience wrapper
`verifyVisibilityMode()`) to confirm the mode was actually applied:

```typescript
await client.Public();
const mode = await client.verifyVisibilityMode();
console.log(mode); // "Public"
```

## WebSocket behaviour

When `Ws: true` is set, `Public()` will also wait for the system
confirmation message that the Midjourney bot sends after the switch and return
it:

```typescript
const confirmation = await client.Public();
// confirmation: { mode: "public", content: "..." } | null
```

## See also

- [private](private.md)
- [stealth](stealth.md)
- [fast](fast.md) / [relax](relax.md)
