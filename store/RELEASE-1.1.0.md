# 1.1.0 发布材料

## 一、商店「此版本的新功能」

中文 listing 填中文，英文 listing 填英文。

### 中文

```
这个版本修了两个用起来最难受的问题，另外加了一个实用的改动。

· 视频播到一半才开双向，声音不会再从头开始放了
  以前会一直差着几分钟，怎么拖进度条都追不回来

· 快进、拖进度条之后，声音立刻跟到新位置
  以前会停在原处，面板一直显示「对齐中」，等多久都没用

· 用 hls.js 播放的站点会多缓冲一些（默认 30 秒 → 90 秒）
  「能提前多少」的余量跟着变大，拖完进度条也不容易卡在边缘
  代价是多占几十兆内存，不额外耗流量
  原生 HLS 站点（地址直接是 .m3u8）改不了，缓冲由浏览器决定

还有一个变化：某个位置实在抓不到声音时，现在会明确提示并退回普通
延迟模式，不会一直卡着。代价是不能再「提前」，但至少声音是通的。

装的时候浏览器会提示「读取和更改所有网站上的所有数据」——那是为了在
页面加载前就调大缓冲，这一步必须全站生效。扩展不收集、不上传任何数据，
也不读页面内容。
```

### English

```
This release fixes the two most frustrating problems and adds one useful change.

· Turning on bidirectional mode after the video has been playing no longer
  starts the sound from the beginning. It used to stay minutes behind and
  no amount of dragging could catch it up.

· After seeking or dragging the progress bar, the sound follows immediately.
  It used to stay where it was while the panel kept showing "aligning".

· On every site, the player now buffers further ahead (30 s → 90 s).
  "Safe to advance" has more headroom and seeking doesn't stall at the edge.
  Costs a few dozen MB of RAM, no extra traffic.

One more change: when the audio really can't be captured at some position,
the extension now says so and falls back to plain delay mode instead of
hanging. You lose "earlier than the picture", but the sound works.

On install the browser will warn that the extension can "read and change all
your data on all websites". That access is what lets it raise the buffer
before any page script runs. Nothing is collected, nothing is uploaded, and
no page content is read.
```

---

## 二、GitHub Release

**Tag**：`v1.1.0`

**标题**

```
1.1.0 — 声音不会再卡在开头了
```

**正文**

```markdown
修了两个让人抓狂的问题。

**播到一半才开双向，声音从头开始放**

以前会一直差着几分钟，面板写着「音频慢 400 多秒」，怎么拖进度条都追不回来。
原因是这个站点的音频时间轴和画面对不上，差的是你当前的播放位置，而代码里
把这种「差太多」的情况当成异常丢掉了。现在会正常采信，声音直接落到该在的位置。

**快进、拖进度条之后，声音停在原处**

以前面板会一直显示「对齐中」，等多久都没用。现在跳转的瞬间就把声音挪到
新位置，数据一到就能接着播。

**用 hls.js 的站点，缓冲目标放宽了**

播放器默认缓冲 30 秒就停手，「能提前多少」和「拖完要不要等」都被这个数字卡着。
现在放宽到 90 秒 —— 多占几十兆内存，不额外耗流量。

不是所有站点都适用：地址直接是 `.m3u8` 的原生 HLS 页面（不少影视站是这种），
缓冲长度由浏览器自己管，没有可调接口。这类页面上的「可安全提前」仍然等于
页面已经下载了多少，扩展变不出更多数据。

这条要全站生效，所以 1.1.0 起申请了全站主机权限。装的时候浏览器会提示
「读取和更改所有网站上的所有数据」：注入的那个脚本只有 2 KB，只做一件事
——改 hls.js 的缓冲目标，不读页面内容、不碰音频数据、不发任何请求。

一个变化

某个位置实在抓不到声音时，现在会明确提示并退回普通延迟模式，不会一直卡着。
以前会偷偷再下一路流（流量翻倍），但不一定有声音。

退回之后只能「延后」，不能「提前」——这个得提前说清楚，别以为是坏了。

其他

- 面板上的状态文字更具体了，卡在哪一步一眼能看出来

下载哪个

- `audio-delay-sync-1.1.0.zip` — 完整版，功能全
- `audio-delay-sync-1.1.0-store.zip` — 商店版

两个别装在同一个浏览器里，扩展 ID 不同，会被当成两个扩展。

从源码装：解压后打开 `edge://extensions`，开开发者模式，点「加载已解压的扩展程序」。
```

---

## 三、发布前检查

- [ ] 在真实站点验证过：画面播到 6 分钟处再开双向，声音是否直接对上
- [ ] 商店上传 `dist/audio-delay-sync-1.1.0-store.zip`（**不是**完整版那个）
- [ ] GitHub Release 两个 zip 都传
- [ ] 隐私政策链接仍可访问

## 四、如果有人追问

**为什么这次又修同一个问题？**

> 1.0.2 修的是其中一种取音频的方式，这次补上另一种。两条路取音频的办法完全
> 不同，症状一样但原因不同。

**为什么退回延迟模式，不自动换一种取法？**

> 换一种要多下一路流（流量翻倍），而且很多页面根本拉不到。与其多花流量还是
> 没声音，不如让声音立刻回来。
