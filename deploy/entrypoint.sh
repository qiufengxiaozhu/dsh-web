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
    if [ ! -d "$seed_dir" ]; then
      echo "[entrypoint] 种子中无 $pkg，跳过" >&2
      continue
    fi
    # 本地插件判据：种子 package.json 里该依赖是 link:/file: 形式
    #（构建时已解引用成实体目录）。本地插件强制覆盖，npm 插件已装不动。
    force=false
    node -e "
      const deps = require('/opt/seed/.dsh/profiles/web/package.json').dependencies || {};
      const spec = deps['$pkg'] || '';
      process.exit(/^(link|file):/.test(spec) ? 0 : 1);
    " && force=true
    # bundles/dependencies 合并对每个插件无条件执行：老版本 entrypoint 只在
    # 拷包时合并，数据卷里"已装"的插件（如手动装过包但没注册 bundles 的）
    # 会被跳过且永远不加载——包在、bundle 不在。
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
    # npm 插件已装且版本与镜像一致 → 无需拷贝；缺失或版本不符（镜像升级、
    # 旧版残留）→ 覆盖为镜像版。本地插件始终强制覆盖。
    if [ "$force" = false ] \
      && node -e "
        const seedV = require('/opt/seed/.dsh/profiles/web/node_modules/$pkg/package.json').version;
        const localV = require('$pkg/package.json', { paths: ['$PROFILE_DIR'] }).version;
        process.exit(seedV === localV ? 0 : 1);
      " 2>/dev/null; then
      continue
    fi
    [ "$force" = true ] && echo "[entrypoint] 本地插件 $pkg 强制覆盖同步"
    [ "$force" = false ] && echo "[entrypoint] 插件 $pkg 缺失或版本不符，从镜像种子覆盖同步"
    # node_modules 里按 scope/name 落盘（@scope/name 或 name）。
    case "$pkg" in
      @*/*) scope="${pkg%%/*}"; name="${pkg#*/}"; dir="$PROFILE_DIR/node_modules/$scope/$name" ;;
      *)    dir="$PROFILE_DIR/node_modules/$pkg" ;;
    esac
    mkdir -p "$(dirname "$dir")"
    # 覆盖拷贝：先删旧目录再拷，保证与镜像种子完全一致。
    # 无条件 rm：npm 插件版本不符覆盖时 dir 已存在，不先删会嵌套拷成 dir/$name。
    rm -rf "$dir"
    cp -a "$seed_dir" "$dir"
    # pnpm hoisted 布局：插件的 peer/host 依赖提升在 node_modules 顶层与 .pnpm。
    # 全新数据卷缺这些骨架，逐项补齐（已存在的项不动，保留数据卷现状）。
    local item
    for item in /opt/seed/.dsh/profiles/web/node_modules/* /opt/seed/.dsh/profiles/web/node_modules/.pnpm /opt/seed/.dsh/profiles/web/node_modules/.*.yaml /opt/seed/.dsh/profiles/web/node_modules/.*.json; do
      [ -e "$item" ] || continue
      local base; base="$(basename "$item")"
      [ -e "$PROFILE_DIR/node_modules/$base" ] || cp -a "$item" "$PROFILE_DIR/node_modules/"
    done
    node -e "require.resolve('$pkg/package.json', { paths: ['$PROFILE_DIR'] })" \
      || { echo "[entrypoint] $pkg 拷入后仍无法解析，终止" >&2; exit 1; }
  done < /opt/seed/plugins.txt
}
[ -f /opt/seed/plugins.txt ] && sync_plugins

# 预置默认工作区：镜像构建时装好的 logAnalyze（含 skills），首次启动
# 拷进数据卷；工作区其余内容不覆盖。
for ws in /opt/seed/workspace/*; do
  name="$(basename "$ws")"
  if [ ! -d "/workspace/$name" ]; then
    echo "[entrypoint] 初始化默认工作区 /workspace/$name"
    cp -a "$ws" "/workspace/$name"
  else
    # 已存在的工作区：skills/AGENTS.md 每次启动强制以镜像为最新覆盖，
    # 防止对话过程中大模型按用户要求改动这些内容后偏离源代码。
    # 父目录一并 mkdir -p：老数据卷的工作区可能没有 .dsh（cp 不建中间目录）。
    for item in .dsh/skills AGENTS.md; do
      if [ -e "$ws/$item" ]; then
        rm -rf "/workspace/$name/$item"
        mkdir -p "/workspace/$name/$(dirname "$item")"
        cp -a "$ws/$item" "/workspace/$name/$item"
      fi
    done
  fi
done

# 运行时把 skills 目录与 AGENTS.md 设为只读（chmod 444/555），给大模型的
# 覆盖写制造阻力：普通 write/edit 会因权限被拒。dsh 的 workspace-write
# 沙箱下 rm+重写也能绕过 chmod（目录本身可写），所以这层是"防误改"而
# 非安全边界；真正的保障仍靠每次启动的强制覆盖（上一段）。
find /workspace -path '*/.dsh/skills*' -type d -exec chmod 555 {} + 2>/dev/null || true
find /workspace -path '*/.dsh/skills*' -type f -exec chmod 444 {} + 2>/dev/null || true
find /workspace -maxdepth 2 -name AGENTS.md -exec chmod 444 {} + 2>/dev/null || true

# settings.yaml 后处理：dsh 对不在内置模型目录里的模型一律视为仅文本，
# 界面配置的自定义 provider 模型（glm 等）会被 MODEL_DOES_NOT_SUPPORT_IMAGES
# 拒绝图片上传。这里默认给 settings.yaml 里所有 provider 的未声明 input 的
# 模型补 [text, image]（走自建网关时模型基本都支持识图）；设
# DSH_PROVIDERS_DEFAULT_VISION=0 恢复 dsh 原生保守默认。显式写了 input 的
# 条目（含 ["text"]）不动。随后再合并 DSH_LLM_PROVIDERS（可选，env 方式
# 配置 provider 时用；同名 provider 整体覆盖，界面配置为主则无需设置）。
DSH_SETTINGS="$DSH_HOME/settings.yaml"
if [ -f "$DSH_SETTINGS" ] && [ "${DSH_PROVIDERS_DEFAULT_VISION:-1}" != "0" ]; then
  DSH_SETTINGS="$DSH_SETTINGS" node -e '
    const fs = require("fs");
    const { parse, stringify } = require(require("path").join(
      require("child_process").execSync("npm root -g").toString().trim(),
      "@deepseek-ai/dsh/node_modules/yaml"));
    const path = process.env.DSH_SETTINGS;
    const settings = parse(fs.readFileSync(path, "utf8")) || {};
    const providers = settings["llm-pi-ai"]?.providers || {};
    let touched = 0;
    for (const route of Object.values(providers)) {
      if (!route || typeof route !== "object" || !Array.isArray(route.models)) continue;
      if (route.defaultInput === undefined) route.defaultInput = ["text", "image"];
      for (const model of route.models)
        if (model && typeof model === "object" && model.input === undefined) { model.input = ["text", "image"]; touched++; }
    }
    if (touched > 0) {
      fs.writeFileSync(path, stringify(settings));
      console.log("[entrypoint] 已为 " + touched + " 个模型默认启用图片输入（DSH_PROVIDERS_DEFAULT_VISION=0 可关闭）");
    }
  ' || echo "[entrypoint] settings.yaml 图片模态补默认失败，跳过" >&2
fi
if [ -n "${DSH_LLM_PROVIDERS:-}" ]; then
  mkdir -p "$DSH_HOME"
  DSH_LLM_PROVIDERS="$DSH_LLM_PROVIDERS" DSH_SETTINGS="$DSH_SETTINGS" node -e '
    const fs = require("fs");
    const { parse, stringify } = require(require("path").join(
      require("child_process").execSync("npm root -g").toString().trim(),
      "@deepseek-ai/dsh/node_modules/yaml"));
    const path = process.env.DSH_SETTINGS;
    const providers = JSON.parse(process.env.DSH_LLM_PROVIDERS);
    let settings = {};
    try { settings = parse(fs.readFileSync(path, "utf8")) || {}; } catch {}
    settings["llm-pi-ai"] = settings["llm-pi-ai"] || {};
    settings["llm-pi-ai"].providers = { ...(settings["llm-pi-ai"].providers || {}), ...providers };
    fs.writeFileSync(path, stringify(settings));
    console.log("[entrypoint] 已合并 DSH_LLM_PROVIDERS -> settings.yaml providers: " + Object.keys(providers).join(", "));
  ' || { echo "[entrypoint] DSH_LLM_PROVIDERS 合并失败，继续用现有 settings.yaml" >&2; }
fi

# 权限预设：默认 danger-full-access（免沙盒免审批）。workspace-write 需要
# 宿主内核启用 Landlock 或容器内有 bwrap，二者皆无时沙箱 fail-closed 拒绝
# 执行（"no sandbox backend is usable"），模型每条命令都要人工升权审批，
# 无人值守的定时任务会直接卡死——2026-09-17 服务器实测确认。容器本身已是
# 隔离边界；本机开发（WSL2 内核支持 Landlock）可设 workspace-write 开沙箱。
export DSH_PERMISSION_MODE="${DSH_PERMISSION_MODE:-danger-full-access}"

# compose 的 `${VAR:-}` 写法在 .env 未配置时会把空字符串传进容器（而非"未设置"）；
# dsh-llm-deepseek 对空 baseURL 会 new URL('') 直接抛 Invalid URL 拒绝启动。
# 启动前清掉空值，让插件回落到内置默认（官方 api.deepseek.com）。
if [ -z "${DEEPSEEK_API_KEY:-}" ]; then unset DEEPSEEK_API_KEY; fi
if [ -z "${DEEPSEEK_BASE_URL:-}" ]; then unset DEEPSEEK_BASE_URL; fi

TRUST_ARGS=()
for authority in ${DSH_TRUSTED_HOSTS:-}; do
  TRUST_ARGS+=(--trusted-host "$authority")
done
# --host 0.0.0.0 由 dsh-web-startup-auth 替换的原版 startup 放行；
# 认证由该插件的登录/注册页承担，不再使用 DSH_WEB_ACCESS_KEY 密钥门禁。
exec dsh web --host 0.0.0.0 --port 9090 ${TRUST_ARGS[@]+"${TRUST_ARGS[@]}"}
