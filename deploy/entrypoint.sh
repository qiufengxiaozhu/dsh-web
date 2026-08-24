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
mkdir -p "$PROFILE_DIR"

# 增量同步种子插件：逐个检查能否从数据卷 profile 解析，缺哪个补哪个。
# 同时把缺的包名合并进 package.json 的 dependencies 与 dsh.profile.bundles，
# 保证 dsh 启动时能作为 bundle 层加载。
# 覆盖策略分两类：本地自定义插件（种子里有源码实体）每次启动强制覆盖，
# 始终以镜像为最新；线上 npm 插件已装的不动（保留用户改动与版本）。
sync_plugins() {
  local pkg dir scope name seed_dir force
  while IFS= read -r pkg; do
    [ -n "$pkg" ] || continue
    seed_dir="/opt/seed/.dsh/profiles/web/node_modules/$pkg"
    # 本地插件判据：种子 package.json 里该依赖是 link:/file: 形式
    #（构建时已解引用成实体目录）。本地插件强制覆盖，npm 插件已装不动。
    force=false
    node -e "
      const deps = require('/opt/seed/.dsh/profiles/web/package.json').dependencies || {};
      const spec = deps['$pkg'] || '';
      process.exit(/^(link|file):/.test(spec) ? 0 : 1);
    " && force=true
    if [ "$force" = false ] \
      && node -e "require.resolve('$pkg/package.json', { paths: ['$PROFILE_DIR'] })" >/dev/null 2>&1; then
      continue
    fi
    [ "$force" = true ] && echo "[entrypoint] 本地插件 $pkg 强制覆盖同步"
    [ "$force" = false ] && echo "[entrypoint] 数据卷缺插件 $pkg，从镜像种子拷入"
    # node_modules 里按 scope/name 落盘（@scope/name 或 name）。
    case "$pkg" in
      @*/*) scope="${pkg%%/*}"; name="${pkg#*/}"; dir="$PROFILE_DIR/node_modules/$scope/$name" ;;
      *)    dir="$PROFILE_DIR/node_modules/$pkg" ;;
    esac
    mkdir -p "$(dirname "$dir")"
    # 种子以解引用的真实目录分发（link: 依赖已在构建期 cp 成实体）。
    if [ ! -d "$seed_dir" ]; then
      echo "[entrypoint] 种子中无 $pkg，跳过" >&2; continue
    fi
    # 强制覆盖：先删旧目录再拷，保证与镜像种子完全一致。
    [ "$force" = true ] && rm -rf "$dir"
    cp -a "$seed_dir" "$dir"
    # pnpm hoisted 布局：插件的 peer/host 依赖提升在 node_modules 顶层与 .pnpm。
    # 全新数据卷缺这些骨架，逐项补齐（已存在的项不动，保留数据卷现状）。
    local item
    for item in /opt/seed/.dsh/profiles/web/node_modules/* /opt/seed/.dsh/profiles/web/node_modules/.pnpm /opt/seed/.dsh/profiles/web/node_modules/.*.yaml /opt/seed/.dsh/profiles/web/node_modules/.*.json; do
      [ -e "$item" ] || continue
      local base; base="$(basename "$item")"
      [ -e "$PROFILE_DIR/node_modules/$base" ] || cp -a "$item" "$PROFILE_DIR/node_modules/"
    done
    # 合并 package.json：dependencies 版本以种子为准，bundles 追加缺失项。
    ( cd /opt/seed/.dsh/profiles/web \
      && node -e "
        const fs = require('fs');
        const seed = require('./package.json');
        const dstPath = '$PROFILE_DIR/package.json';
        const dst = fs.existsSync(dstPath) ? require(dstPath) : { name: 'dsh-profile-web', private: true };
        dst.dependencies = dst.dependencies || {};
        if (seed.dependencies && seed.dependencies['$pkg']) dst.dependencies['$pkg'] = seed.dependencies['$pkg'];
        dst.dsh = dst.dsh || { profile: {} };
        dst.dsh.profile = dst.dsh.profile || {};
        dst.dsh.profile.bundles = dst.dsh.profile.bundles || [];
        // 全新数据卷：profile 从未初始化，先注入 web 模板的 in-box bundles
        //（dsh-base/dsh-web-app 提供 webServer 等 service，缺了插件永远 pending）。
        if (dst.dsh.profile.bundles.length === 0) {
          dst.dsh.profile.bundles.push('@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app');
        }
        if (!dst.dsh.profile.bundles.includes('$pkg')) dst.dsh.profile.bundles.push('$pkg');
        fs.writeFileSync(dstPath, JSON.stringify(dst, null, 2) + '\n');
      " )
    node -e "require.resolve('$pkg/package.json', { paths: ['$PROFILE_DIR'] })" \
      || { echo "[entrypoint] $pkg 拷入后仍无法解析，终止" >&2; exit 1; }
  done < /opt/seed/plugins.txt
}
[ -f /opt/seed/plugins.txt ] && sync_plugins

# 预置默认工作区：镜像构建时装好的 openApi/openDoc（含 skills），首次启动
# 拷进数据卷；工作区其余内容不覆盖。
for ws in /opt/seed/workspace-seed/*; do
  name="$(basename "$ws")"
  if [ ! -d "/workspace/$name" ]; then
    echo "[entrypoint] 初始化默认工作区 /workspace/$name"
    cp -a "$ws" "/workspace/$name"
  else
    # 已存在的工作区：skills 与 CLAUDE.md 每次启动强制以镜像为最新覆盖，
    # 防止对话过程中大模型按用户要求改动这些内容后偏离源代码。
    for item in .claude/skills CLAUDE.md; do
      if [ -e "$ws/$item" ]; then
        rm -rf "/workspace/$name/$item"
        cp -a "$ws/$item" "/workspace/$name/$item"
      fi
    done
  fi
done

# 运行时把 skills 目录与 CLAUDE.md 设为只读（chmod 444/555），给大模型的
# 覆盖写制造阻力：普通 write/edit 会因权限被拒。dsh 的 workspace-write
# 沙箱下 rm+重写也能绕过 chmod（目录本身可写），所以这层是"防误改"而
# 非安全边界；真正的保障仍靠每次启动的强制覆盖（上一段）。
find /workspace -path '*/.claude/skills*' -type d -exec chmod 555 {} + 2>/dev/null || true
find /workspace -path '*/.claude/skills*' -type f -exec chmod 444 {} + 2>/dev/null || true
find /workspace -maxdepth 2 -name CLAUDE.md -exec chmod 444 {} + 2>/dev/null || true

TRUST_ARGS=()
for authority in ${DSH_TRUSTED_HOSTS:-}; do
  TRUST_ARGS+=(--trusted-host "$authority")
done
# --host 0.0.0.0 由 dsh-web-startup-auth 替换的原版 startup 放行；
# 认证由该插件的登录/注册页承担，不再使用 DSH_WEB_ACCESS_KEY 密钥门禁。
exec dsh web --host 0.0.0.0 --port 9090 ${TRUST_ARGS[@]+"${TRUST_ARGS[@]}"}
