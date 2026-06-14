# Settings Management API

The SDK provides a complete settings management layer on top of the
Midjourney `/settings` command. You can read current settings, check
whether individual options are active, and switch settings by label or
custom ID — all without manually parsing `options` arrays.

> **Requires `Ws: true`** — settings operations rely on the WebSocket
> connection to receive the ephemeral settings message.

---

## Reading Settings

### `Settings()`

Fetches the current `/settings` message from the Midjourney bot.

```typescript
const settings = await client.Settings();
// settings.options — array of MJOptions (buttons)
// settings.id      — message ID (needed for button clicks)
// settings.flags   — message flags
```

### `isSettingActive(option)`

Returns `true` if the given option is currently active (pressed/on).
Internally checks whether the Discord button style is `3` (success/green).

```typescript
const settings = await client.Settings();
const remix = client.findSettingOption(settings, "Remix mode");
if (remix && client.isSettingActive(remix)) {
  console.log("Remix mode is ON");
}
```

### `findSettingOption(settings, label)`

Finds a setting option by its exact label string.

```typescript
const niji = client.findSettingOption(settings, "Niji version 5");
```

### `findSettingByCustomId(settings, customId)`

Finds a setting option by its `custom_id`.

```typescript
const opt = client.findSettingByCustomId(settings, "MJ::Settings::v5");
```

---

## Updating Settings

### `updateSetting(params)`

The core method for changing a setting. It:

1. Fetches current settings.
2. Locates the target button by `label` or `customId`.
3. Checks whether the button is already in the desired state.
4. Clicks the button only if necessary (unless `force: true`).
5. Returns an `MJSettingUpdateResult` describing what happened.

**Parameters:**

| Param         | Type      | Description                                                |
| ------------- | --------- | ---------------------------------------------------------- |
| `label`       | `string?` | The button label to target (e.g. `"Remix mode"`).          |
| `customId`    | `string?` | Alternatively, target by `custom_id` directly.             |
| `targetState` | `boolean?`| Desired state: `true` = active, `false` = inactive.        |
| `force`       | `boolean?`| Click the button even if already in target state.          |

At least one of `label` or `customId` is required.

**Returns:** `MJSettingUpdateResult`

```typescript
interface MJSettingUpdateResult {
  label: string;     // the setting that was targeted
  wasActive: boolean; // state before the operation
  isActive: boolean;  // state after the operation
  toggled: boolean;   // whether the button was actually clicked
}
```

**Examples:**

```typescript
// Enable Remix mode (skip if already enabled)
const result = await client.updateSetting({
  label: "Remix mode",
  targetState: true,
});
console.log(result.toggled); // false if was already on

// Force-click a setting regardless of current state
await client.updateSetting({
  label: "Niji version 5",
  force: true,
});

// Toggle a setting without specifying target state
await client.updateSetting({ label: "Turbo mode" });

// Target by custom_id
await client.updateSetting({
  customId: "MJ::Settings::some_id",
  targetState: true,
});
```

---

## Remix Mode

### `ensureRemixMode(enabled?)`

State-aware method to enable or disable Remix mode. Unlike the raw
`SwitchRemix()` (which blindly toggles), this method:

- Checks the current Remix state first.
- Only clicks the button if the state needs to change.
- Automatically updates `config.Remix` so subsequent `Variation()` calls
  behave correctly.

```typescript
// Enable Remix (no-op if already on)
await client.ensureRemixMode(true);

// Disable Remix (no-op if already off)
await client.ensureRemixMode(false);

// Default is true
await client.ensureRemixMode(); // enables Remix
```

### `SwitchRemix()` *(deprecated)*

Legacy method that blindly toggles Remix via the `/prefer remix` slash
command. Use `ensureRemixMode()` instead for state-aware control.

---

## Reset

### `Reset()`

Resets all Midjourney settings to their defaults.

```typescript
await client.Reset();
```

---

## Typical Workflow

```typescript
import { Midjourney } from "midjourney";

const client = new Midjourney({
  SalaiToken: process.env.SALAI_TOKEN,
  ServerId: process.env.SERVER_ID,
  ChannelId: process.env.CHANNEL_ID,
  Ws: true,
});
await client.Connect();

// 1. Read all current settings
const settings = await client.Settings();
for (const opt of settings.options) {
  console.log(
    `[${client.isSettingActive(opt) ? "ON" : "OFF"}] ${opt.label}`
  );
}

// 2. Switch to Niji v5 model (state-aware)
await client.updateSetting({ label: "Niji version 5", targetState: true });

// 3. Enable Remix mode
await client.ensureRemixMode(true);

// 4. Reset everything to defaults
await client.Reset();

client.Close();
```
