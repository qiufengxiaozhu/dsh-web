# dsh-web-line-jump（行号插件）

点击回复中「`完整路径:行号`」格式的行内代码，在右侧栏打开该文件预览并**定位到指定行**。
纯客户端插件，不提供任何服务端路由。

## 原理

dsh 原生只把「本轮 `present` 交付/产出的文件」且行内代码与路径**精确匹配**的引用渲染成
可点击样式（`chatFileMentions` 服务 → MarkdownText resolver），且 `open()` 固定不带行号。

本插件对 `ctx.get("chatFileMentions")` 返回的活对象做 `forClosing` 方法包装：

1. 行内代码无 `:行号` 后缀 → 原样走原生逻辑（行为不变）；
2. 有 `path:line(:column)?` 后缀 → 剥离后询问原 resolver，命中本轮交付集合才可点击，
   `open()` 调 `owner.openFile(path, { line })` → 预览面板滚动定位到该行（1 起算）；
3. 任何异常回退原生行为，最坏退化为「不可点击」。

之所以用包装而非重新 `provide`：cordis 对同名 service 二次注册直接抛
`service "..." has been registered`。

## 已知限制

- 依赖 dsh 内部接口（`chatFileMentions` / resolver 形状 / `openFile` options），
  dsh 升级可能失效；失效表现是静默降级，不影响使用。
- 需要模型在分析结束前 `present` 交付日志文件（路径匹配的前提），配套规范见
  `workspace/logAnalyze/AGENTS.md` 与两个 error-log skill 的「日志证据链」章节。

## 安装

本地开发：`~/.dsh/profiles/web/package.json` 依赖
`"@agent-hub/dsh-web-line-jump": "link:/opt/dsh-web/plugins/dsh-web-line-jump"`
并加入 `dsh.profile.bundles`，`pnpm install` 后重启 `./start.sh`。

镜像部署：`deploy/Dockerfile` 已包含安装与 link 解引用步骤。
