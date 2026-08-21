# 纯 dsh（npm 线上版）+ dsh-web-startup-auth 插件（同样从 npm 拉取）。
# 不 COPY 任何本地插件源码——排查"本地源码插件在服务器上异常"的问题，
# 验证纯 npm 线上包是否正常。

FROM node:24
# dsh CLI + 它的 `dsh plugin` 子命令所调用的 pnpm。
ARG DSH_VERSION=0.1.0-rc.7
RUN npm install -g pnpm@11 @deepseek-ai/dsh@${DSH_VERSION}
# 构建时（本机可访问 npm）把插件装进种子 profile，随镜像分发；
# 服务器启动时入口脚本把种子拷进 /data 数据卷，部署环境全程离线。
RUN DSH_HOME=/opt/seed/.dsh HOME=/root \
    dsh plugin --profile web add dsh-web-startup-auth --config.auto-install-peers=false
# 本地维护的自定义插件（dsh-plugins/），从源码目录装进种子 profile。
# dsh-workspace-file-upload 已打补丁：允许远程同源上传（原版仅限 loopback）。
COPY dsh-plugins /opt/seed/dsh-plugins
RUN DSH_HOME=/opt/seed/.dsh HOME=/root \
    dsh plugin --profile web add /opt/seed/dsh-plugins/dsh-workspace-file-upload --config.auto-install-peers=false
# pnpm 以相对 symlink 落盘 link: 依赖，种子 profile 拷进 /data 后路径失效；
# 解引用为真实目录，随 profile 一起拷贝即可用。
RUN cd /opt/seed/.dsh/profiles/web/node_modules/@agent-hub \
    && rm dsh-workspace-file-upload \
    && cp -r /opt/seed/dsh-plugins/dsh-workspace-file-upload dsh-workspace-file-upload
# 预置默认工作区（openApi/openDoc，含工作区级 skills 与 CLAUDE.md），
# 启动时由入口脚本拷进 /workspace 数据卷。
COPY workspace-seed /opt/seed/workspace-seed
# 种子插件清单：entrypoint 逐个检查、缺哪个补哪个（增量同步，无需重置数据卷）。
RUN cd /opt/seed/.dsh/profiles/web \
    && node -e "const p=require('./package.json'); \
        const list=(p.dsh?.profile?.bundles||[]).filter(n=>!n.startsWith('@deepseek-ai/')); \
        require('fs').writeFileSync('/opt/seed/plugins.json', JSON.stringify(list,null,1))" \
    && node -e "console.log(require('/opt/seed/plugins.json').join('\n'))" > /opt/seed/plugins.txt
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Harness 主目录（会话、profile）放在 /data 数据卷上。
ENV DSH_HOME=/data/.dsh
VOLUME /data
# 端口绑定由 dsh-web-startup-auth 放行的 --host 0.0.0.0 控制，固定 9090。
EXPOSE 9090
ENTRYPOINT ["/entrypoint.sh"]
