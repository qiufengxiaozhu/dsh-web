#!/usr/bin/env bash
# 构建 dsh-web 镜像并导出 tar.gz 到宿主机（Windows）桌面。
# 按约定只构建导出，不启动容器。
set -euo pipefail

cd "$(dirname "$0")"

DESKTOP=/mnt/c/Users/lenovocloud/Desktop
IMAGE=dsh
OUT="$DESKTOP/dsh-web.tar.gz"

echo "[build] 构建 $IMAGE（dsh 0.1.0-rc.7 + dsh-web-startup-auth，均来自 npm）"
docker build -t "$IMAGE" .

echo "[build] 导出到 $OUT"
docker save "$IMAGE" | gzip > "$OUT"

echo "[build] 完成：$OUT"
