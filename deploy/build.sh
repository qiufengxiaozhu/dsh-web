#!/usr/bin/env bash
# 构建 dsh-web 镜像并导出 tar.gz 到宿主机（Windows）桌面。
# 按约定只构建导出，不启动容器。
set -euo pipefail

cd "$(dirname "$0")"

DESKTOP=/mnt/c/Users/lenovocloud/Desktop
IMAGE=dsh
OUT="$DESKTOP/dsh-web.tar.gz"

echo "[build] 构建 $IMAGE（dsh ${DSH_VERSION:-0.1.6-alpha.1} + 插件：startup-auth / line-jump / dsh-tasks）"
# 构建上下文上移到仓库根目录，以便把 workspace（与 deploy 平级）打进镜像。
docker build -f Dockerfile -t "$IMAGE" ..

echo "[build] 导出到 $OUT"
docker save "$IMAGE" | gzip > "$OUT"

echo "[build] 完成：$OUT"
