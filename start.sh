#!/usr/bin/env bash
# 本地开发启动：直接用宿主机的 dsh + web profile，不构建镜像。
# 工作区放在 ~/dsh-workspaces（首次从 workspace-seed 拷贝）。
# 插件清单装在 ~/.dsh/profiles/web（dsh plugin --profile web add ...）。
set -euo pipefail
cd "$(dirname "$0")"

# 解析 dsh/node 要在改 HOME 之前做（nvm 在原 HOME 下）。
# 脚本以非交互 bash 运行时 nvm 不加载，PATH 里没有 node/dsh；
# 回退到 nvm 的已装版本目录（要整个加进 PATH，因为 dsh 的 shebang 是
# /usr/bin/env node，运行时仍需找到 node）。
if ! command -v dsh >/dev/null 2>&1 && [ -d "$HOME/.nvm/versions/node" ]; then
  for _bin in "$HOME"/.nvm/versions/node/*/bin/dsh; do
    [ -x "$_bin" ] && export PATH="$(dirname "$_bin"):$PATH"  # 取最高版本
  done
fi
command -v dsh >/dev/null 2>&1 \
  || { echo "[start] 找不到 dsh 命令，请先: npm install -g @deepseek-ai/dsh" >&2; exit 1; }

WS_DIR="${DSH_WORKSPACES:-$HOME/dsh-workspaces}"
PORT="${DSH_PORT:-9090}"

# 插件装在真实 HOME 的 ~/.dsh/profiles/web；下面会把 HOME 指到工作区，
# 若不先固定 DSH_HOME，dsh 会在工作区下新建空 profile（插件全丢）。
export DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
# 认证凭据同理：插件按 os.homedir()/.dsh/web-auth.json 存取，固定到真实 ~/.dsh。
export DSH_WEB_AUTH_FILE="${DSH_WEB_AUTH_FILE:-$DSH_HOME/web-auth.json}"

# 首次初始化工作区；已存在的只补 .dsh 与 AGENTS.md，不覆盖用户内容。
mkdir -p "$WS_DIR"
for ws in workspace-seed/*; do
  name="$(basename "$ws")"
  if [ ! -d "$WS_DIR/$name" ]; then
    cp -a "$ws" "$WS_DIR/$name"
  else
    for item in .dsh AGENTS.md; do
      [ -e "$ws/$item" ] && [ ! -e "$WS_DIR/$name/$item" ] && cp -a "$ws/$item" "$WS_DIR/$name/$item"
    done
  fi
done

# 目录选择器默认从 HOME 开始浏览。
export HOME="$WS_DIR"
# dsh-web-startup-auth 的会话/登录页按绑定的 host 区分：绑 0.0.0.0 才启用
# 会话认证（凭据未注册时登录页可正常展示注册表单）；绑 127.0.0.1 时它视为
# 已认证，一旦凭据未注册，/ 与 /login 会互相重定向死循环。本地也绑 0.0.0.0
# 避免该问题（仅监听本机网卡可配合防火墙）。
exec dsh web --host "${DSH_HOST:-0.0.0.0}" --port "$PORT" "$@"
