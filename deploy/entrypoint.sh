#!/usr/bin/env bash
# 容器入口：把镜像构建时装好的种子 profile（含 npm 线上版 dsh-web-startup-auth）
# 拷进数据卷（仅首次，幂等），然后运行 web UI。部署环境全程离线。
# dsh-web-startup-auth 是 DSH bundle（自带补丁），拷贝后自动生效：
# 替换原版 startup 放行 --host 0.0.0.0，并提供登录/注册页 + 会话认证。
set -euo pipefail

export DSH_HOME="${DSH_HOME:-/data/.dsh}"
# 目录选择器默认从 os.homedir() 开始浏览；把 HOME 指到 /workspace。
export HOME=/workspace
# 固定 pnpm store：种子 profile 的 node_modules 链到 /data/.pnpm-store，
# HOME 改为 /workspace 后 pnpm 会换默认 store 而报 ERR_PNPM_UNEXPECTED_STORE。
export npm_config_store_dir=/data/.pnpm-store
# pnpm 的缓存与配置写到 /data，避免落进工作区。
export XDG_CACHE_HOME=/data/xdg-cache
export XDG_CONFIG_HOME=/data/xdg-config
mkdir -p /workspace "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME"
PROFILE_DIR="$DSH_HOME/profiles/web"
SEED_DIR=/opt/seed/.dsh/profiles/web
mkdir -p "$PROFILE_DIR"

if ! node -e "require.resolve('dsh-web-startup-auth/package.json', { paths: ['$PROFILE_DIR'] })" >/dev/null 2>&1; then
  echo "[entrypoint] 数据卷无插件，从镜像种子 profile 拷入 dsh-web-startup-auth"
  # 覆盖式拷贝：node_modules 内含 pnpm store 的硬链接相对布局，整目录拷最稳。
  cp -a "$SEED_DIR/." "$PROFILE_DIR/"
  node -e "require.resolve('dsh-web-startup-auth/package.json', { paths: ['$PROFILE_DIR'] })" \
    || { echo "[entrypoint] 插件拷入后仍无法解析，终止" >&2; exit 1; }
fi

TRUST_ARGS=()
for authority in ${DSH_TRUSTED_HOSTS:-}; do
  TRUST_ARGS+=(--trusted-host "$authority")
done
# --host 0.0.0.0 由 dsh-web-startup-auth 替换的原版 startup 放行；
# 认证由该插件的登录/注册页承担，不再使用 DSH_WEB_ACCESS_KEY 密钥门禁。
exec dsh web --host 0.0.0.0 --port 9090 ${TRUST_ARGS[@]+"${TRUST_ARGS[@]}"}
