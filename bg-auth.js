'use strict';

/* sendToTab 在 background.js 里（同一个 SW 全局作用域）；下面几个导出给
   background.js 的消息分发用，本文件内部不调用。 */
/* global sendToTab */
/* exported contentScriptFiles, registerEnhanced, ensureEnhanced, registerOnly,
            checkOrigin, requestEnhanceInline, settleEnhance, peekPendingEnhance,
            clearPendingEnhance, clearNeedGesture, pendingCache, PENDING_TTL */

/* ================================================================
 * 增强脚本的按站点注册
 *
 * 1.1.0 起 host_permissions 是安装时授予的全站权限，面板按钮走
 * registerOnly() 直接补注册 —— 不需要权限、也不需要手势。
 * 文件后半段那套 pending / 手势补偿是 optional 权限时代的遗留，
 * 目前没有调用方（保留是因为删它要连带改 onClicked 和 toggle 里的
 * stale 检查，收益不大）。
 * ================================================================ */
const ENHANCED_IDS = ['ads-main', 'ads-content'];

/** 内容脚本的注入顺序。build-info.js 必须第一个：后面几个都要读 ADS_BUILD。
 *  双向模式那五块也必须按依赖顺序排：它们加载时会直接解构上一个模块导出的
 *  函数，顺序错了拿到的是 undefined，而且要到用户点按钮才报错。
 *
 *  mux.min.js（112KB）**不在这里**。它只服务链路②，而注册是 allFrames 的 ——
 *  放进来意味着每个授权页面的每个 iframe 都要在 document_start 解析一遍，
 *  其中绝大多数根本不会走链路②。改成进链路② 之前由 SW 用
 *  chrome.scripting.executeScript 按需注入（见 background.js 的 loadMux）。
 *  上架版本来就没有这个文件，按需注入时 CAPTURE_BUILD 会直接回失败。 */
function contentScriptFiles() {
  return [
    'build-info.js',
    /* i18n 必须排在所有会输出文案的模块前面：它们加载时就要拿到 T */
    'ads-i18n.js',
    'ads-template.js', 'ads-ui.js', 'ads-detect.js',
    /* core → panel → route → sync → enhance：单向依赖，没有回头箭头 */
    'ads-enh-core.js', 'ads-enh-panel.js', 'ads-enh-route.js',
    'ads-enh-sync.js', 'ads-enhance.js',
    /* 入口必须最后：它要读前面挂到 window.ADS 上的东西 */
    'content.js'
  ];
}

async function registerEnhanced(origins) {
  const matches = (origins || [])
    .map(function (o) { return String(o).replace(/\/\*$/, '') + '/*'; })
    .filter(function (m) { return /^https?:/i.test(m); });

  /* 没有可注册的站点就什么都不做。
     绝不能在这里顺手 unregister —— 那会把已有注册删掉却不补回来。 */
  if (!matches.length) return;

  try {
    const old = await chrome.scripting.getRegisteredContentScripts({ ids: ENHANCED_IDS });
    if (old && old.length) await chrome.scripting.unregisterContentScripts({ ids: ENHANCED_IDS });
  } catch (e) {}

  /* allFrames 必须是 true：大量影视站把播放器放在跨域 iframe 里
     （父页面只有外壳，video 元素在嵌进来的第三方播放器中），
     只注入顶层框架的话，panel 挂在一个没有 video 的页面上，双向模式永远不可用。
     多层 iframe 里的面板由 content.js 自行判断要不要显形。 */
  await chrome.scripting.registerContentScripts([
    {
      id: 'ads-main',
      matches: matches,
      js: ['inject-main.js'],
      runAt: 'document_start',
      world: 'MAIN',
      allFrames: true
    },
    {
      id: 'ads-content',
      matches: matches,
      /* 顺序有讲究：构建标记 → 样式常量 → 面板 → 双向 →（可选）mux.js → 入口。
         入口最后跑，前面几个都挂到 window.ADS 上。 */
      js: contentScriptFiles(),
      runAt: 'document_start',
      allFrames: true
    }
  ]);
}

/**
 * 已授权站点的本地账本。
 * 不依赖 chrome.permissions.getAll() —— 它返回什么、什么时候返回，
 * 不同版本行为不一致；曾经出现过拿到空数组导致注册被清掉的情况。
 */
async function rememberEnhancedOrigin(origin) {
  if (!origin) return;
  try {
    const r = await chrome.storage.local.get('enhancedOrigins');
    const list = Array.isArray(r.enhancedOrigins) ? r.enhancedOrigins.slice() : [];
    if (list.indexOf(origin) === -1) {
      list.push(origin);
      await chrome.storage.local.set({ enhancedOrigins: list });
    }
  } catch (e) {}
}

async function forgetEnhancedOrigin(origin) {
  try {
    const r = await chrome.storage.local.get('enhancedOrigins');
    const list = (Array.isArray(r.enhancedOrigins) ? r.enhancedOrigins : [])
      .filter(function (o) { return o !== origin; });
    await chrome.storage.local.set({ enhancedOrigins: list });
  } catch (e) {}
}

/**
 * SW 启动时校准一次注册状态：只补，不重建。
 *
 * 动态注册默认 persistAcrossSessions，本来就跨 SW 重启保留。
 * 每次启动都 unregister + register 会留出窗口期——页面恰好在那时加载就
 * 注入不到，表现正是「授权了，刷新后还提示需要授权」。
 */
async function ensureEnhanced() {
  try {
    const stored = await chrome.storage.local.get('enhancedOrigins');
    const remembered = Array.isArray(stored.enhancedOrigins) ? stored.enhancedOrigins : [];

    /* getAll() 作为补充来源，两个来源取并集 */
    let granted = [];
    try {
      const perms = await chrome.permissions.getAll();
      granted = ((perms && perms.origins) || []).filter(function (o) {
        return /^https?:/i.test(o);
      });
    } catch (e) {}

    const origins = [];
    remembered.concat(granted).forEach(function (o) {
      const base = String(o).replace(/\/\*$/, '');
      if (/^https?:/i.test(base) && origins.indexOf(base) === -1) origins.push(base);
    });

    if (!origins.length) return;

    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ENHANCED_IDS });
    if (existing && existing.length === ENHANCED_IDS.length) return;

    await registerEnhanced(origins);
  } catch (e) {}
}

/* 刷新后自动进双向的一次性标记：按 tab 存，取一次就删。
   storage.session 在同一浏览器会话内跨页面刷新保留，正好够用；不用
   storage.local 是免得重启浏览器之后还残留一个「自动接管」的意图。 */
const AUTO_ENTER_PREFIX = 'autoEnter:';
const AUTO_ENTER_TTL = 90000;

async function markAutoEnter(tabId) {
  if (typeof tabId !== 'number') return;
  try {
    const o = {};
    o[AUTO_ENTER_PREFIX + tabId] = Date.now();
    await chrome.storage.session.set(o);
  } catch (e) {}
}

async function takeAutoEnter(tabId) {
  if (typeof tabId !== 'number') return false;
  const k = AUTO_ENTER_PREFIX + tabId;
  try {
    const o = await chrome.storage.session.get(k);
    const at = o && o[k];
    if (!at) return false;
    await chrome.storage.session.remove(k);
    return Date.now() - at <= AUTO_ENTER_TTL;
  } catch (e) {
    return false;
  }
}

/**
 * 补注册增强脚本，然后刷新当前页。
 * 站点访问权限随安装一次性授予，这条路不需要申请权限、也不需要手势。
 *
 * @param {boolean} autoEnter 刷新完是否直接进双向（用户点的是「启用双向」，
 *                            刷新只是补装脚本的副作用，不该让他再点一次）
 */
async function registerOnly(origin, tabId, autoEnter) {
  if (!origin || !/^https?:/i.test(origin)) {
    return { ok: false, error: '这个页面不支持（只对 http / https 站点生效）' };
  }

  try {
    await rememberEnhancedOrigin(origin);
    await registerEnhanced([origin]);
    if (autoEnter) await markAutoEnter(tabId);

    if (typeof tabId === 'number') {
      setTimeout(function () {
        chrome.tabs.reload(tabId).catch(function () {});
      }, 350);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '注册失败：' + ((e && e.message) || String(e)) };
  }
}

/**
 * content 侧启动时问一次：这次页面加载要不要顺手把双向开起来。
 * 顺便补一次注册，让「注册完成前就加载了」的页面下次刷新就能用上。
 */
async function checkOrigin(origin, tabId) {
  if (!origin || !/^https?:/i.test(origin)) return { autoEnter: false };
  try { ensureEnhanced().catch(function () {}); } catch (e) {}
  return { autoEnter: await takeAutoEnter(tabId) };
}

/* 权限被撤销时把失效的站点从注册里摘掉 */
if (chrome.permissions.onRemoved) {
  chrome.permissions.onRemoved.addListener(function (removed) {
    const gone = ((removed && removed.origins) || []).map(function (o) {
      return String(o).replace(/\/\*$/, '');
    });
    Promise.all(gone.map(forgetEnhancedOrigin))
      .then(function () {
        return chrome.permissions.getAll();
      })
      .then(function (perms) {
        const origins = ((perms && perms.origins) || []).filter(function (o) {
          return /^https?:/i.test(o);
        });
        if (!origins.length) {
          return chrome.scripting.unregisterContentScripts({ ids: ENHANCED_IDS });
        }
        return registerEnhanced(origins);
      })
      .catch(function () {});
  });
}

/* ---------------- 双向模式授权（遗留，当前无调用方） ----------------
 * optional 权限时代的做法：host 权限按站点申请，而 permissions.request
 * 要求发生在「用户手势」里。content script 的点击经 sendMessage 到 SW 时
 * 手势在跨进程那一步就丢了，只能退回「登记意图、等下一次点图标」。
 *
 * 现在权限随安装授予，这条路不再被调用；面板按钮走 registerOnly()。
 * 留在这里的代码仍然能跑，但别在新增功能时照着它写。
 */

const PENDING_KEY = 'pendingEnhance';
const PENDING_TTL = 5 * 60 * 1000;

/* 内存镜像。onClicked 里必须「同步」拿到 origin —— 只要 await 一次，
   手势就被判失效，permissions.request 会报 "must be called during a user gesture"。 */
let pendingCache = null;

function setPendingEnhance(tabId, origin) {
  pendingCache = { tabId: tabId, origin: origin, at: Date.now() };
  return chrome.storage.session
    .set({ [PENDING_KEY]: pendingCache })
    .catch(function () {});
}

async function peekPendingEnhance() {
  if (pendingCache && Date.now() - (pendingCache.at || 0) <= PENDING_TTL) return pendingCache;
  try {
    const r = await chrome.storage.session.get(PENDING_KEY);
    const p = r && r[PENDING_KEY];
    if (!p || typeof p.tabId !== 'number') return null;
    if (Date.now() - (p.at || 0) > PENDING_TTL) {
      await chrome.storage.session.remove(PENDING_KEY);
      return null;
    }
    pendingCache = p;
    return p;
  } catch (e) {
    return null;
  }
}

function clearPendingEnhance() {
  pendingCache = null;
  return chrome.storage.session.remove(PENDING_KEY).catch(function () {});
}

/* SW 启动时预热缓存：万一上次的 pending 还没处理完 */
peekPendingEnhance().catch(function () {});

/** 图标上打个标记，明确告诉用户「下一步点这里」 */
async function markNeedGesture(tabId) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#22d3ee', tabId: tabId });
    await chrome.action.setBadgeText({ tabId: tabId, text: '↑' });
    await chrome.action.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('actionTitleAuth') || '点一下图标，完成双向模式授权'
    });
  } catch (e) {}
}

async function clearNeedGesture(tabId) {
  try {
    await chrome.action.setBadgeText({ tabId: tabId, text: '' });
    await chrome.action.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('actionTitle') || '音画不同步调节器 · 点一下接管当前标签页'
    });
  } catch (e) {}
}

/**
 * 面板按钮直接授权。
 *
 * 关键：permissions.request 必须是这个消息处理器里「第一个异步操作」。
 * 手势能撑过 content script → service worker 这一跳，但撑不过任何 await。
 *
 * 不过 1.1.0 起 host_permissions 已经是全站必需权限，这个 origin 必然已授予。
 * 先 contains 问一句：授过了就直接往下走，压根不碰 request
 * （request 只能请求 optional 权限，对必需权限会抛 not in optional permissions）。
 * 没授过的情况留作兜底 —— 那时 contains 会先吃掉手势，request 报错，
 * 用户重新点一次即可。这条分支在当前 manifest 下走不到。
 */
function requestEnhanceInline(origin, tabId, sendResponse) {
  if (!origin || !/^https?:/i.test(origin)) {
    sendResponse({ ok: false, error: '这个页面不支持（只对 http / https 站点生效）' });
    return false;
  }

  chrome.permissions.contains({ origins: [origin + '/*'] })
    .then(function (yes) {
      if (yes) return true;
      return chrome.permissions.request({ origins: [origin + '/*'] });
    })
    .then(function (granted) {
      if (!granted) {
        sendResponse({ ok: false, error: '没有授权。想用双向模式时可以再点一次。' });
        return undefined;
      }
      return rememberEnhancedOrigin(origin)
        .then(function () { return registerEnhanced([origin]); })
        .then(function () {
          sendResponse({ ok: true, needsReload: true });

          /* 脚本是 document_start 注入的，不刷新当前页等于没装。
             让用户自己刷很容易刷早（注册还没落），干脆替他把这步做掉。 */
          if (typeof tabId === 'number') {
            setTimeout(function () {
              chrome.tabs.reload(tabId).catch(function () {});
            }, 350);
          }
        });
    })
    .catch(function (e) {
      const msg = (e && e.message) || String(e);

      /* 万一某些版本没把手势传过来：退回「点图标」这条路，别让用户卡死 */
      if (/user gesture/i.test(msg) && typeof tabId === 'number') {
        setPendingEnhance(tabId, origin);
        markNeedGesture(tabId);
        sendResponse({
          ok: false,
          needGesture: true,
          error: '这个环境下手势没能传过来。点一下工具栏图标即可完成授权（图标角标已亮）。'
        });
        return;
      }

      sendResponse({ ok: false, error: '授权失败：' + msg });
    });

  return true; /* 异步 sendResponse */
}

/**
 * 授权的收尾：只处理结果，不发起请求。
 * 请求本身必须在 onClicked 的同步段里发起（见下面的 onClicked）。
 */
async function settleEnhance(tabId, origin, granted, err) {
  await clearNeedGesture(tabId);
  await clearPendingEnhance();

  if (err) {
    await sendToTab(tabId, {
      type: 'panel-notice',
      kind: 'error',
      text: '授权失败：' + ((err && err.message) || String(err))
    });
    return;
  }

  if (!granted) {
    await sendToTab(tabId, {
      type: 'panel-notice',
      kind: 'error',
      text: '没有授权，双向模式仍然不可用。需要时可以再点一次面板上的按钮。'
    });
    return;
  }

  await registerEnhanced([origin]);
  await sendToTab(tabId, {
    type: 'panel-notice',
    kind: 'ok',
    text: '已授权，正在刷新页面…'
  });

  /* 同 requestEnhanceInline：不刷新等于没装 */
  setTimeout(function () {
    chrome.tabs.reload(tabId).catch(function () {});
  }, 350);
}

/* 每次 SW 启动把已授权站点重新注册一遍（浏览器可能清掉动态脚本） */
ensureEnhanced();

