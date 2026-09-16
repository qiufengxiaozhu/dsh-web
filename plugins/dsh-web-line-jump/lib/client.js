// 浏览器半侧：增强回复中行内代码的文件引用解析。
//
// 原生链路（dsh v0.1.6-alpha.1）：
//   chat 渲染消息时调用 ctx.get("chatFileMentions").forClosing(owner, sessionId)
//   拿到一个 resolver，把行内代码文本交给 resolver.resolve(value)；
//   命中「本轮 present 交付 / 产出文件」的 value 会被渲染成可点击样式，
//   点击执行 resolver 返回的 open() —— 但原生 open() 固定 openFile(path)，
//   不携带行号；且行内代码写成 `path:12` 后整串不匹配路径，直接变纯文本。
//
// 本插件不重新 provide（同名 service 二次注册会被 cordis 拒绝：
// `service "..." has been registered`），而是对 ctx.get() 返回的同一个
// 活对象做方法包装（monkey-patch）：
//   1. 行内代码无数字后缀 → 原样委托原 resolver，行为与原生一致；
//   2. 有 `path:num(:num)*` 后缀 → 逐级剥离后缀、每级询问原 resolver
//      （容忍模型在交付路径或引用路径上多带行号段），任一级命中即可点击；
//   3. open() 用完全剥离后的真实路径 + 最后一段数字作为行号调
//      owner.openFile(path, { line })，由预览面板滚动定位到该行。
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
    // 直到 patch 成功。chat 每次渲染都重新调用 forClosing，patch 生效后
    // 新渲染即走增强逻辑。ctx.effect 在插件卸载时清理定时器。
    const POLL_MS = 2000;

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

    function apply(ctx) {
      let timer = null;
      timer = setInterval(() => {
        let svc = null;
        try {
          svc = ctx.get("chatFileMentions");
        } catch {
          svc = null;
        }
        if (!svc || svc.__dshLineJump || typeof svc.forClosing !== "function") return;
        const origForClosing = svc.forClosing;
        svc.forClosing = function wrapped(owner, sessionId) {
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
              // 打开用完全剥离后的真实路径；行号取最后一段数字
              // （`p:7665` → 7665；`p:12:7707` → 7707）。
              const openPath = stripAll(trimmed);
              const line = parsed.nums[parsed.nums.length - 1];
              return Object.assign({}, hit, {
                open() {
                  try {
                    // chat 侧 openFile 的实现签名是 (path, options?)，
                    // options.line 由 openResource 转给预览面板滚动定位。
                    // TurnTail 侧类型标注只有 (path)，运行时是同一函数。
                    const r = owner.openFile(openPath, { line });
                    if (r && typeof r.catch === "function") {
                      r.catch(() => {
                        // 带行号打开失败（如该类型渲染器不支持行导航）：
                        // 退回不带行号的原生打开。
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
        } catch {}
      }, POLL_MS);
      try {
        ctx.effect(() => clearInterval(timer));
      } catch {}
    }

    function stripAll(value) {
      let s = value;
      for (;;) {
        const p = parseTrailing(s);
        if (!p) return s;
        s = p.path;
      }
    }

    exports.apply = apply;
    exports.inject = [];
    return module.exports;
  },
});
