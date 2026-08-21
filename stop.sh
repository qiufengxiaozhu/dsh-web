#!/usr/bin/env bash
# 停止 start.sh 启动的本地 dsh web。
# 按命令行匹配（dsh web + start.sh 默认/DSH_PORT 端口），逐个终止。
set -euo pipefail

PORT="${DSH_PORT:-9090}"
PIDS="$(pgrep -f "dsh web .*--port $PORT" || true)"
if [ -z "$PIDS" ]; then
  # 兜底：匹配不到带端口的（如默认参数启动），退回宽泛匹配。
  PIDS="$(pgrep -f "bin/dsh web" || true)"
fi
if [ -z "$PIDS" ]; then
  echo "[stop] 没有在运行的 dsh web"
  exit 0
fi
echo "$PIDS" | xargs kill
sleep 1
LEFT="$(echo "$PIDS" | xargs -r pgrep -f 'dsh web' 2>/dev/null || true)"
if [ -n "$LEFT" ]; then
  echo "[stop] 未退出，强制终止: $LEFT"
  echo "$LEFT" | xargs kill -9 2>/dev/null || true
fi
echo "[stop] 已停止 (pid: $(echo "$PIDS" | tr '\n' ' '))"
