// 浏览器半侧：增强回复中行内代码的文件引用解析。
//
// 原生链路（dsh v0.1.6-alpha.1）：
//   chat 渲染消息时调用 ctx.get("chatFileMentions").forClosing(owner, sessionId)
//   拿到一个 resolver，把行内代码文本交给 resolver.resolve(value)；
//   命中「本轮 present 交付 / 产出文件」的 value 渲染为可点击 button
//   （<code><button class=_fileMention_xxx>…</button></code>），
//   点击执行 resolver 返回的 open() —— 但原生 open() 固定 openFile(path)，
//   不携带行号；且行内代码写成 `path:12` 后整串不匹配路径，直接变纯文本。
//
// 两层机制：
// 1. resolver patch：对 ctx.get() 返回的活对象做 forClosing 方法包装
//   （cordis 同名 service 二次注册会 throw，不能重新 provide）：
//   - `path:num(:num)*` 后缀逐级剥离、每级询问原 resolver（容忍交付路径
//     本身带行号残留），任一级命中即可点击；
//   - open() 用完全剥离后的真实路径 + 最后一段数字调
//     owner.openFile(path, { line })，预览面板滚动定位到该行。
// 2. DOM 补偿层（本文件后半）：React 渲染时机与交付状态恢复存在竞态——
//   刷新浏览器后首屏渲染时 turn-tail / 交付状态尚未就绪，mentions 为空，
//   行内代码渲染为裸 <code>；状态就绪后没有任何东西再触发重渲染，Button
//   永远不出现（切换会话重新渲染才恢复）。补偿层周期扫描「文本能被
//   resolver 命中、但 DOM 里还是裸 code」的元素，手动包一层仿原生 button。
//   React 之后若重渲染会重建 DOM（dataset 丢失），扫描器再次补偿，幂等。
// 任何一步异常都回退到原生行为，最坏情况退化为「不可点击」。
window.__ModuleLoader__.load({
  id: "@agent-hub/dsh-web-line-jump",
  factory: () => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // 尾部行号段：`path`、`path:7665`、`path:12:7707`（容忍 1–4 段数字）。
    const TRAILING_RE = /^(.+?)((?::\d{1,7}){1,4})$/;
    // deliverables 插件惰性物化，chatFileMentions 出现时机不定；2s 轮询
    // 直到 patch 成功。DOM 补偿扫描周期同。
    const POLL_MS = 2000;
    const SCAN_MS = 2000;

    function parseTrailing(value) {
      const m = TRAILING_RE.exec(value);
      if (!m) return null;
      const nums = m[2].slice(1).split(":").map(Number);
      return { path: m[1], nums };
    }

    // 候选序列：`p:12:7707` → [`p:12:7707`, `p:12`, `p`]（依次丢最后一个
    // 数字段）。注意 TRAILING_RE 一次会剥光全部数字段，必须按 nums 重建
    // 中间形态，否则会漏掉「交付路径本身带一段行号」的命中。
    function candidatesOf(trimmed, parsed) {
      const list = [trimmed];
      if (parsed) {
        for (let k = parsed.nums.length - 1; k >= 1; k--) {
          list.push(parsed.path + ":" + parsed.nums.slice(0, k).join(":"));
        }
        list.push(parsed.path);
      }
      return list;
    }

    function tryResolve(resolver, value) {
      try {
        return resolver.resolve(value) || undefined;
      } catch {
        return undefined;
      }
    }

    function stripAll(value) {
      let s = value;
      for (;;) {
        const p = parseTrailing(s);
        if (!p) return s;
        s = p.path;
      }
    }

    // 仿原生 fileMention 按钮样式（原生 class 是 CSS modules 构建哈希，
    // 随版本变，故自带样式；规则抄自原生 ._fileMention_*）。
    const COMPENSATE_CSS =
      "code>button.dsh-lj-mention{margin:0;padding:0;border:none;background:none;" +
      "font:inherit;font-weight:500;color:var(--dsw-alias-link);text-decoration:none;cursor:pointer}" +
      "code>button.dsh-lj-mention:hover,code>button.dsh-lj-mention:focus{outline:none;" +
      "text-decoration:underline dotted var(--dsw-alias-link);text-underline-offset:3px}";

    function injectStyle() {
      if (document.querySelector("style[data-dsh-line-jump]") !== null) return;
      const tag = document.createElement("style");
      tag.dataset.dshLineJump = "1";
      tag.textContent = COMPENSATE_CSS;
      document.head.appendChild(tag);
    }

    // 当前会话最近一次渲染的 turn 载体与 resolver 来源（forClosing 每次渲染
    // 都被 chat 调用，patch 里顺手记录；DOM 补偿层用它拿 openFile 与实时
    // resolver——交付状态就绪后即使首屏那次不命中，新调用也能命中）。
    let latestOwner = null;
    let latestSessionId = null;

    function apply(ctx) {
      let timer = null;
      let scanTimer = null;

      // DOM 补偿扫描（第二版）：不依赖 forClosing 被调用。实测刷新浏览器后
      // dsh 恢复历史会话时 turn 载体（owner）始终为 undefined，原生渲染路径
      // 与「记录 latestOwner」的方案全部失效；而切会话正常。改为直接从
      // sessions 服务取当前会话与 cwd，对形状像路径的裸行内代码一律渲染
      // 可点击按钮，点击时拼 dsh-resource 地址交 sidebarRight 打开并定位行。
      const DEBUG = false; // 排障时改 true：scan/forClosing 各分支日志
      const FILE_PREFIX = "dsh-resource://file/session/";
      const encodeSegment = (s) => encodeURIComponent(s).replace(/%3A/gi, ":");
      const sessionFileAddress = (sessionId, path) =>
        FILE_PREFIX + encodeSegment(sessionId) + "/" + path.split("/").map(encodeSegment).join("/");
      const isAbsoluteWorkspacePath = (p) => p.startsWith("/") || /^[A-Za-z]:[/\\]/.test(p) || p.startsWith("\\\\");
      function fileAddress(sessionId, cwd, path) {
        const normalized = path.replace(/\\/g, "/");
        if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
        const root = cwd === undefined ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
        if (root !== "" && normalized.startsWith(root + "/")) {
          return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
        }
        return sessionFileAddress(sessionId, normalized);
      }
      // 形状过滤：完整路径感（含 /、无空白、带扩展名），避免把普通代码词变按钮。
      function looksLikePath(text) {
        if (text.length < 4 || text.length > 300 || /\s/.test(text)) return false;
        if (!text.includes("/")) return false;
        const base = text.split("/").pop();
        return /\.[A-Za-z0-9]{1,10}$/.test(base) && !base.endsWith(".");
      }
      function scan() {
        try {
          const sessions = ctx.get("sessions");
          if (!sessions || !sessions.list) return;
          const snap = sessions.list.getSnapshot();
          const sessionId = snap.current;
          if (!sessionId) {
            if (DEBUG) console.info("[line-jump] scan: 无当前会话（sessions.list.current 为空）");
            return;
          }
          const cwd = snap.byId[sessionId]?.cwd;
          let sb;
          try {
            sb = ctx.get("sidebarRight");
          } catch {
            sb = null;
          }
          if (!sb || typeof sb.openResource !== "function") {
            if (DEBUG) console.info("[line-jump] scan: sidebarRight 服务不可用");
            return;
          }
          let codes = 0;
          let hits = 0;
          for (const el of document.querySelectorAll("code")) {
            if (el.closest("pre")) continue; // 代码块内不处理
            if (el.dataset.dshLj) continue; // 已处理过（1=补偿过，2=原生已有）
            if (el.querySelector("button")) {
              el.dataset.dshLj = "2";
              continue;
            }
            const text = (el.textContent || "").trim();
            // 形状检查必须用剥离行号后的纯路径：`xxx.log:2` 以 `:2` 结尾，
            // 直接检查会因不满足"扩展名结尾"而漏掉所有带行号的引用。
            if (!looksLikePath(stripAll(text))) continue;
            codes++;
            const parsed = parseTrailing(text);
            const owner = latestOwner; // 仅作 openFile 兜底（正常渲染路径产物）
            const openPath = stripAll(text);
            const line = parsed ? parsed.nums[parsed.nums.length - 1] : undefined;
            const address = fileAddress(sessionId, cwd, openPath);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dsh-lj-mention";
            btn.title = openPath;
            btn.textContent = text; // 原生按钮还带一个文件图标，这里省略
            btn.addEventListener("click", (ev) => {
              ev.preventDefault();
              try {
                if (owner && typeof owner.openFile === "function") {
                  const r = owner.openFile(openPath, line === undefined ? undefined : { line });
                  if (r && typeof r.catch === "function") r.catch(() => sb.openResource(address));
                  return;
                }
                sb.openResource(address, line === undefined ? undefined : { params: { line } });
              } catch {
                try {
                  sb.openResource(address);
                } catch {}
              }
            });
            el.textContent = "";
            el.appendChild(btn);
            el.dataset.dshLj = "1";
            hits++;
            if (DEBUG) console.info("[line-jump] scan: 补偿按钮 →", text, "@", address);
          }
          if (DEBUG && (codes > 0 || hits > 0)) {
            console.info("[line-jump] scan 完成:", { 候选: codes, 已补: hits, sessionId });
          }
        } catch (e) {
          if (DEBUG) console.info("[line-jump] scan 异常:", e && e.message);
        }
      }

      timer = setInterval(() => {
        let svc = null;
        try {
          svc = ctx.get("chatFileMentions");
        } catch {
          return;
        }
        if (!svc || svc.__dshLineJump || typeof svc.forClosing !== "function") return;
        const origForClosing = svc.forClosing;
        svc.forClosing = function wrapped(owner, sessionId) {
          if (DEBUG) console.info("[line-jump] forClosing 被调用, owner:", owner ? "有" : "无", "sessionId:", sessionId);
          // 记录最近一次渲染的载体，供 DOM 补偿层使用。
          latestOwner = owner;
          latestSessionId = sessionId;
          let resolver;
          try {
            resolver = origForClosing.call(this, owner, sessionId);
          } catch {
            return undefined;
          }
          if (!resolver || typeof resolver.resolve !== "function") return resolver;
          return {
            resolve(value) {
              if (typeof value !== "string") return resolver.resolve(value);
              const trimmed = value.trim();
              const parsed = parseTrailing(trimmed);
              // 无数字后缀：与原生行为完全一致（纯路径可点击保持不变）。
              if (!parsed) return resolver.resolve(trimmed);
              // 逐级剥离尝试：`p:12:7707` → `p:12` → `p`，任一级命中交付
              // 集合即可点击（容忍交付路径本身带了 `:12` 之类的行号残留）。
              let hit;
              for (const candidate of candidatesOf(trimmed, parsed)) {
                hit = tryResolve(resolver, candidate);
                if (hit) break;
              }
              if (!hit) return undefined;
              // 打开用完全剥离后的真实路径；行号取最后一段数字。
              const openPath = stripAll(trimmed);
              const line = parsed.nums[parsed.nums.length - 1];
              return Object.assign({}, hit, {
                open() {
                  try {
                    const r = owner.openFile(openPath, { line });
                    if (r && typeof r.catch === "function") {
                      r.catch(() => {
                        try {
                          hit.open();
                        } catch {}
                      });
                    }
                  } catch {
                    try {
                      hit.open();
                    } catch {}
                  }
                },
              });
            },
          };
        };
        try {
          svc.__dshLineJump = true;
          console.info("[line-jump] patched chatFileMentions; DOM 补偿扫描已启动");
          clearInterval(timer);
          timer = null;
          injectStyle();
          scanTimer = setInterval(scan, SCAN_MS);
          scan();
        } catch {}
      }, POLL_MS);
      try {
        // cordis effect 约定：立即执行回调、返回值作为清理函数——
        // 所以这里必须返回一个 disposer，而不是直接 clearInterval。
        ctx.effect(() => () => {
          if (timer) clearInterval(timer);
          if (scanTimer) clearInterval(scanTimer);
        });
      } catch {}
    }

    exports.apply = apply;
    exports.inject = [];
    return module.exports;
  },
});
