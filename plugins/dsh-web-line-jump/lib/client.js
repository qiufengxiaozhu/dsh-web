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
// 活对象做方法包装（monkey-patch）：剥出 `path:line(:column)?` 后缀，
// 用剥离后的 path 询问原 resolver；命中则返回带行号的 open()。
// 任何一步异常都回退到原生行为，最坏情况退化为「不可点击」。
window.__ModuleLoader__.load({
  id: "@agent-hub/dsh-web-line-jump",
  factory: () => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // `完整路径:行号` 或 `完整路径:行号:列`。行号 1 起算（与预览行号一致）。
    const LINE_RE = /^(.+?):(\d{1,7})(?::(\d{1,5}))?$/;
    // deliverables 插件惰性物化，chatFileMentions 出现时机不定；2s 轮询
    // 直到 patch 成功。chat 每次渲染都重新调用 forClosing，patch 生效后
    // 新渲染即走增强逻辑。ctx.effect 在插件卸载时清理定时器。
    const POLL_MS = 2000;

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
              const m = LINE_RE.exec(value.trim());
              // 无行号后缀：与原生行为完全一致（纯路径可点击保持不变）。
              if (!m) return resolver.resolve(value);
              // 有行号后缀：用剥离后的 path 询问原 resolver——
              // 未命中本轮交付集合则保持惰性（不可点击），不误伤普通代码。
              let hit;
              try {
                hit = resolver.resolve(m[1]);
              } catch {
                return undefined;
              }
              if (!hit) return undefined;
              const path = m[1];
              const line = Number(m[2]);
              const column = m[3] !== undefined ? Number(m[3]) : undefined;
              return Object.assign({}, hit, {
                open() {
                  try {
                    // chat 侧 openFile 的实现签名是 (path, options?)，
                    // options.line 由 openResource 转给预览面板滚动定位。
                    // TurnTail 侧类型标注只有 (path)，运行时是同一函数。
                    const r = owner.openFile(path, { line, column });
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

    exports.apply = apply;
    exports.inject = [];
    return module.exports;
  },
});
