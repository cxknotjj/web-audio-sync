# 🎬 Audio Delay Sync

[简体中文](README.md) · **🌐 English**

**Don't change players, don't touch the timeline — just delay the sound on its way to the speakers.**

A browser extension that adds an adjustable delay to **the current tab's audio**, so you can fix audio/video sync without touching the player. Set the amount, adjust it live, stop when you're done — all from a small panel in the corner of the page.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-4dd9ff.svg?logo=git&logoColor=white)](https://github.com/cxknotjj/web-av-sync/releases)
[![Platform](https://img.shields.io/badge/platform-Chromium%20116%2B-4a5563.svg?logo=googlechrome&logoColor=white)](#install)
[![Demo](https://img.shields.io/badge/demo-live-00b894.svg?logo=html5&logoColor=white)](https://deerfect.me/web-audio-sync/)
[![Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-install-0078d7.svg?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/dppjkonmajnmkgepepheieignphmbkfe)
[![Stars](https://img.shields.io/github/stars/cxknotjj/web-av-sync?color=ffd75e&logo=github&logoColor=white)](https://github.com/cxknotjj/web-av-sync/stargazers)

> **▶ Try it without installing anything** — [open the live page](https://deerfect.me/web-audio-sync/): the extension's own panel is built in, so you can drag the 52-second video's audio later or earlier and hit zero to restore sync. If the link won't open, download [`index.html`](index.html) and [`demo-1min.mp4`](demo-1min.mp4), serve the folder (e.g. `npx serve`) and open the local URL. Double-clicking the file only plays the picture — browsers block Web Audio processing of `file://` video.

![The player keeps working; a panel appears in the bottom-right corner](store/screenshot-4-live-delay.png)

<sub>In real use: the player keeps working, and a panel appears in the bottom-right corner.</sub>

---

## 🎧 When you need it

Even a small audio lag is annoying. Common causes:

| Setup | Typical delay |
| --- | --- |
| Bluetooth headphones / speakers | 100–300 ms |
| Casting to a TV or projector | tens to hundreds of ms |
| External sound card, DSP, amplifier | depends on the device |
| The player itself is out of sync | varies |

Turn the number up until the lips match.

---

## 📦 Install

**🛍️ Option 1: Extension store (easiest)**

[Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/dppjkonmajnmkgepepheieignphmbkfe) · requires Chromium **116+**

The store build is missing route ② compared to the full build. On native HLS sites it falls back to route ③ — same behavior, it just downloads that stream twice.

**🧩 Option 2: Load from source (full build / hacking)**

1. Clone or download this repository
2. Open `edge://extensions` (or `chrome://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the repository folder
5. Pin the extension to the toolbar

The full-build zip is on the [Releases](https://github.com/cxknotjj/web-av-sync/releases) page.

The only difference between the two builds is route ②; see the [build comparison in USAGE.md](USAGE.md#7-两个构建版本). **Don't install both in the same browser** — they have different extension IDs and will be treated as two separate extensions.

---

## 💡 Why I built it

During online classes, the teacher's lips were always half a beat ahead of the sound. Switching players, scrubbing the timeline, reinstalling drivers — nothing helped, because the delay happens at the very last step before the audio leaves the computer.

If the problem is in the "on its way to the speakers" stage, then only that stage needs to change. So this extension does exactly that: it doesn't touch the player, doesn't modify the page, and only takes over the current tab's audio to delay it by tens or hundreds of milliseconds.

If it helps you get back in sync, there's a small favor at the end of this page.

---

## 🚀 How to use

No technical knowledge required: **open a video → click the icon → drag the slider.**

![Panel overview](store/screenshot-2-panel.png)

1. Open the video page and **let it start playing** — a silent tab can't be captured
2. **Click the toolbar icon** (or press `Alt+Shift+D`) to take over the audio; a panel appears in the bottom-right corner
3. Drag the slider or scroll the wheel until the lips match the sound

To stop, click the icon again (or press the shortcut again); audio returns to the page immediately. You can drag the panel anywhere. `−` collapses it into a strip; `×` stops it and closes it.

The shortcut can be changed at `edge://extensions/shortcuts`. You don't have to leave fullscreen to find the icon.

### 🔍 What's on the panel

| Element | What it does |
| --- | --- |
| Big number | Current delay in seconds. A minus sign means audio is early |
| Slider | −10 s to +10 s |
| `−1s` `−100` `归零` `+100` `+1s` | Quick presets |
| Level meter | Moves when there's sound, idle when there isn't. **Use this to check output** — not the player's own volume bar |
| Status text | Current mode, and whether this page supports bidirectional. Bidirectional adds a route indicator |
| Stop | Ends capture; audio returns to the page |

### 🎛️ Three ways to adjust

- **Slider**: click and drag
- **Wheel**: hover the panel and scroll — 100 ms per notch, 1 s with `Shift`. Scrolling up increases the delay. Only affects the panel, never the page
- **Keyboard**: with the pointer over the panel, `←` `→` step 100 ms, `Shift + ←/→` step 1 s, `Home` resets to zero. Only while hovered, so it won't fight the player's own arrow keys

---

## ⏪ Advanced: make the audio early (bidirectional mode)

<details>
<summary><b>Expand: how to enable bidirectional mode, and what it costs</b></summary>

By default you can only make audio **later**. The extension captures audio the browser has already rendered — there is no "future" sound in it, so it physically cannot move it earlier.

Bidirectional mode takes a different path: it reads the audio the page has **already downloaded but not yet played**, and plays it ahead of time. That only works for streaming video (progressive download), not fully downloaded files.

- **Enable**: start playback → click the icon → click 「启用双向」 on the panel. The page reloads once and comes back already in bidirectional mode (the reload is how the enhancement script gets registered — no second click needed)
- **Routes**: ① reuse the page's segments (no extra traffic) / ② grab already-downloaded segments (no extra traffic, full build only) / ③ fetch a second stream (roughly double traffic)
- **Buffering**: on every site, the player's buffer target is raised from 30 s to 90 s — so "safe to advance" has more headroom and seeking doesn't stall at the edge (costs a few dozen MB of RAM, no extra traffic)
- **Buffering, seeking, ad breaks, fullscreen, exit**: every behavior, automatic downgrade and fallback rule is documented in [USAGE.md (Chinese)](USAGE.md#3-双向模式)

> Route ② is the only difference between the full and store builds. It requires the `debugger` permission, whose install warnings ("Read and change all your data on all websites", "Access the page debugger backend") are too heavy for a store listing.

</details>

---

## ❓ FAQ

<details>
<summary><b>Expand: 15 common questions</b></summary>

**I clicked the icon and nothing happened**

Make sure the video is **actually producing sound**. Muted, paused, or zero-volume tabs can't be captured; a red toast at the top of the page explains why.

**Captured, the page's volume bar is normal, but I hear nothing**

That's expected, not a bug. While the extension is in control, the browser mutes the tab and the audio goes through the extension. Check the level meter on the panel — if it moves, audio is flowing. If it doesn't, click the page once and try again.

**The panel doesn't appear**

A few pages disallow script injection (browser internal pages, extension stores, the PDF viewer). Audio can't be captured there anyway; the icon briefly shows a red `!` badge.

**Two panels appear on the page**

Fixed; builds from 1.0.1 on include the fix. On sites that embed the player in an iframe (most streaming sites), early development builds drew one panel per frame. Now it only appears in the frame that actually has the player. If you still see it, send me the URL.

**I change the number but hear no difference**

- Make sure the video is playing and the level meter moves
- Very small delays (tens of ms) are subtle; try ±1000 ms
- If the number changes but the sound doesn't move at all, capture may have dropped — stop and start again

**The panel says 「此页不支持双向」 (this page doesn't support bidirectional)**

No video element was found. The page may still be loading, the player may live in another frame, or the content hasn't loaded yet. Wait for the page to finish loading and playback to start.

**The panel says 「启用双向」 and clicking it reloads the page**

That's expected: the enhancement script has to be registered before the page loads, so the click registers it and reloads once. It enters bidirectional mode on its own when the page comes back — no second click.

If it's still showing 「启用双向」 after the reload, the registration didn't go through (service worker was recycled, or site access was turned off). Check that the extension's site access isn't set to "on click" in the browser's extension manager, then try once more.

**In bidirectional mode, audio is out of sync after seeking**

Fixed in builds from 1.0.1: seeking moves the audio to the new position and drops the skipped buffer. If you're on an older build, reload the extension.

**Bidirectional mode doubled my traffic**

That means route ③ ("fetch a second stream"). It's the fallback when the page has no reusable segments. Hover the indicator to see why: either the site serves a plain mp4, or segment capture failed and it downgraded.

**It only goes 2–3 seconds ahead before stuttering**

That's the buffer limit. How far you can go ahead equals how far the video has downloaded. Let it buffer longer to go further.

**The video freezes in bidirectional mode and the panel says 「等缓冲 · 还差 N 秒」 (waiting for buffer)**

It's not frozen — the extension is holding the picture until segments arrive (routes ① and ③ only). A shrinking number means normal waiting; if it never changes, the site can't feed it, and the extension automatically lowers the lead and resumes playback after a few seconds.

**The panel says 「音频重新加载中，画面继续」 (audio reloading, video continues) and there's no sound**

That's the normal intermediate state of route ②: after seeking, audio is re-buffered in the background while the video keeps going. It usually reconnects within seconds; after 8 seconds the extension downgrades to route ③ (double traffic). If it happens often, this site is slow at serving segments; the extension handles it automatically.

**After clicking reset, audio is still slightly late**

The ~1.6 s zero-delay offset in route ② was fixed in 1.0.1. If you still see it, check the status on the right of the panel: 「音频重新加载中」 means wait for it to reconnect; 「可安全提前」 but still late means stop and capture again.

**There's a slight click when I drag**

The delay value is smoothed over 60 ms while dragging. Very rapid large drags can occasionally produce a small jump — an inherent property of the audio processing nodes, not fully avoidable.

**Switching tabs / entering fullscreen**

Switching tabs stops the previous capture. The panel follows into fullscreen and keeps its position.

</details>

---

## ⚠️ Known limitations

<details>
<summary><b>Expand: what it can't do</b></summary>

| Limitation | Why |
| --- | --- |
| Chromium only | Firefox has no `tabCapture` |
| Delay only by default | Early audio requires bidirectional mode, and only works on streaming pages |
| Captures the whole tab | Notification sounds and ads are delayed too. Isolating the video track isn't possible |
| One tab at a time | Browser limitation |
| The original player is muted while captured | Expected; audio is routed through the extension |
| Browser internal pages are unsupported | Settings, extension stores, PDF viewer |

</details>

---

## 📝 Changelog

### 1.1.0

- Added a [live interactive demo](https://deerfect.me/web-audio-sync/) — no install needed: drag the slider and watch the sound get pulled back into place
- Fixed route ② leaving the audio at the old position after a seek, with the panel stuck on "aligning, audio N s behind"
- Reworked the README first screen, added badges and a demo entry

<details>
<summary><b>Expand: 1.0.1 / 1.0.2</b></summary>

### 1.0.2

- Route ② segment decoding is ~28× faster (175 KB segment: 11.4 ms → 0.4 ms), fewer dropped frames on high-bitrate sites
- mux.js is now loaded only when entering bidirectional mode, instead of injecting 112 KB into every page and iframe
- Iframes without a player on authorized sites no longer wake up every 0.4 s
- Status refresh in background tabs drops from once per second to once every 5 s
- Exiting bidirectional mode no longer overrides the user's own mute state
- Repeated stop/start cycles no longer accumulate event listeners
- The panel's diagnostic field now shows why a message failed to deliver
- Fixed audio stuck at the beginning when enabling bidirectional after playback has already started
- UI in Chinese / English, following the browser language

### 1.0.1

- Route ② now prioritizes video and catches audio up asynchronously: seeking no longer freezes the picture waiting for cache
- Fixed the ~1.6 s constant delay in route ② when set to zero
- Fixed route ② getting stuck at "audio reloading" with no output after unmuting
- Fixed route ② staying at "audio reloading" after a mid-roll ad at the 5-minute mark
- Fixed DelayNode being reset to zero when a positive delay was applied, disabling the delay entirely
- Fixed the "safe to advance" indicator flickering between 0 and 10 seconds
- Fixed route ① accumulating raw segments during bidirectional playback (memory growth)
- Fixed duplicate panels when the player is inside an iframe

</details>

---

## 🔒 Privacy

No data is collected or uploaded. Everything ships inside the extension and works offline.

Audio stays in your computer's memory only for the delay you set, then goes to the speakers — never written to disk, never transmitted.

## 📄 License

[MIT](LICENSE) © 2026 cxknotjj. Use it, modify it, sell it, ship it closed-source — just keep the copyright notice.

Bundles [mux.js](https://github.com/videojs/mux.js) 7.0.3 (Apache-2.0, © Brightcove, Inc.). See [`LICENSE-APACHE-2.0.txt`](LICENSE-APACHE-2.0.txt) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## 🛠️ Under the hood

<details>
<summary><b>Expand: file map and development docs</b></summary>

Architecture, the three capture routes, measurements, dev setup and debugging are all in [`DEVELOPMENT.md`](DEVELOPMENT.md).

Bidirectional mode is split into five modules, injected in dependency order:

| File | Responsibility |
| --- | --- |
| `ads-enh-core.js` | Shared state and constants, buffer geometry, audio alignment, route selection |
| `ads-enh-panel.js` | Panel copy: route indicator, safe-to-advance, status publishing |
| `ads-enh-route.js` | The three routes: reuse MSE / grab segments / fetch a second stream |
| `ads-enh-sync.js` | Sync loop: 250 ms alignment tick, buffer waits, seeking |
| `ads-enhance.js` | Lifecycle: enter/exit bidirectional, failure downgrade |

UI copy ships in Chinese and English, following the browser language. To add a third language, see the "界面文案" section of [`DEVELOPMENT.md`](DEVELOPMENT.md).

</details>

---

**If it got your lips and sound back together, a Star ⭐ helps more people find it.**

[![Star this repo](https://img.shields.io/badge/Star_this_repo-ffd75e?style=for-the-badge&logo=github)](https://github.com/cxknotjj/web-av-sync/stargazers)
