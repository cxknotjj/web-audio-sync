'use strict';

/* ================================================================
 * 全站注入（MAIN world，document_start）：只把 hls.js 的缓冲目标调大
 *
 * 和 inject-main.js 分开的理由：
 *   inject-main 会 hook MediaSource 并**复制音频片段** —— 那是双向模式的
 *   数据来源，只在用户授权过的站点上跑。这个文件只改一个配置数字，
 *   不读、不复制、不上传任何内容，所以可以放心全站注入。
 *
 * 为什么只能在主世界：
 *   隔离世界拿到的是另一份 Hls，改了不生效。
 *
 * 为什么要 document_start：
 *   hls.js 的 config 是实例属性，构造时定下。必须赶在页面创建实例之前
 *   把原型方法挂上，否则只能眼睁睁看着它用默认的 30 秒。
 *
 * 代价：多缓冲 60 秒。按 5 Mbps 算约 35 MB 内存，不落盘、不额外拉流
 * （只是让播放器别太早停手）。
 * ================================================================ */

(function () {
  if (window.__adsBufHooked) return;
  window.__adsBufHooked = true;

  const TARGET_S = 90;

  function apply(hls) {
    const cfg = hls && hls.config;
    if (!cfg || cfg.__adsBufTarget) return;
    cfg.__adsBufTarget = true;
    try {
      if (!(cfg.maxBufferLength >= TARGET_S)) cfg.maxBufferLength = TARGET_S;
      /* maxMaxBufferLength 是硬上限（默认 600）。它比目标还小的话，
         目标设了也不生效 —— 这里托个底。 */
      if (!(cfg.maxMaxBufferLength >= TARGET_S * 2)) {
        cfg.maxMaxBufferLength = TARGET_S * 2;
      }
    } catch (e) { /* 站点把 config 设成不可写就放弃，不影响播放 */ }
  }

  function hook(Hls) {
    if (!Hls || !Hls.prototype || Hls.prototype.__adsHlsBuf) return;
    try {
      const orig = Hls.prototype.attachMedia;
      if (typeof orig !== 'function') return;
      Hls.prototype.__adsHlsBuf = true;
      Hls.prototype.attachMedia = function (media) {
        apply(this);
        return orig.call(this, media);
      };
    } catch (e) {}
  }

  if (window.Hls) {
    hook(window.Hls);
  } else {
    /* 页面在 document_start 之后才加载 hls.js：拦住那次赋值。
       UMD 构建会走 window.Hls = ...，能拦到。
       用 ESM 直接 import 的页面拿不到实例，静默跳过。 */
    let stored;
    try {
      Object.defineProperty(window, 'Hls', {
        configurable: true,
        get: function () { return stored; },
        set: function (v) { stored = v; hook(v); }
      });
    } catch (e) {}
  }
})();
