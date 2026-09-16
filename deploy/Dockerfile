FROM node:24

ARG DSH_VERSION=0.1.6-alpha.1
RUN npm install -g pnpm@11 @deepseek-ai/dsh@${DSH_VERSION}

# 1、安装线上插件；临时设置 DSH_HOME 指向构建期的种子目录 /opt/seed/.dsh，HOME=/root 让 pnpm 用 root 的缓存。
RUN DSH_HOME=/opt/seed/.dsh HOME=/root \
    dsh plugin --profile web add dsh-web-startup-auth --config.auto-install-peers=false

# 2、预置默认工作区（logAnalyze，含工作区级 skills 与 AGENTS.md），
COPY workspace-seed /opt/seed/workspace-seed

# 3、种子插件清单：entrypoint 逐个检查、缺哪个补哪个（增量同步）。
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
