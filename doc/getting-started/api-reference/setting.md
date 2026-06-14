# setting

The settings API has two kinds of capability:

- **Read** – `Settings()` returns the current `/settings` panel (`MJSettings`), including every option and whether each toggle is currently on.
- **Write** – `UpdateSetting()` / `EnsureSetting()` (and the high level `Reset()`, `SwitchRemix()`, `SetRemix()`) change a setting by `label`, `custom` id, or an explicit target, instead of manually parsing `options` and calling `MJApi.CustomApi`.

> `Ws: true` is required for the settings API (the panel is an ephemeral message).

## read the current settings

<pre class="language-typescript"><code class="lang-typescript"><strong>import { Midjourney } from "midjourney";
</strong>async function main() {
  const client = new Midjourney({
    ServerId: "your server id",
    ChannelId: "your channel id",
    SalaiToken: "your discord token",
    Ws: true,
  });
  await client.Connect();
  const settings = await client.Settings();
  console.log(settings?.options.map((o) => o.label));
  client.Close();
}
</code></pre>

## switch a setting (write)

`UpdateSetting` clicks a single entry on the panel. The target can be the
visible button label, a `{ custom }` id, or `{ label }`. It returns the
refreshed panel.

<pre class="language-typescript"><code class="lang-typescript">// by label
await client.UpdateSetting("Niji version 5");
// or by raw custom id
await client.UpdateSetting({ custom: "MJ::Settings::..." });
</code></pre>

## ensure a setting state (closed-loop)

`EnsureSetting` reads the current state first and only clicks when the toggle is
not already in the desired state, so it is safe to call repeatedly.

<pre class="language-typescript"><code class="lang-typescript">// make sure "Remix mode" is ON (no-op if it already is)
await client.EnsureSetting("Remix mode", true);
</code></pre>

## remix helpers

`SwitchRemix()` toggles "Remix mode" and keeps `config.Remix` in sync.
`SetRemix(enabled)` ensures a specific state via the closed-loop flow.

<pre class="language-typescript"><code class="lang-typescript">await client.SetRemix(true); // ensure remix on
await client.SwitchRemix(); // blind toggle
</code></pre>

## reset

`Reset()` clicks "Reset Settings" through the same shared flow.

<pre class="language-typescript"><code class="lang-typescript">await client.Reset();
</code></pre>
