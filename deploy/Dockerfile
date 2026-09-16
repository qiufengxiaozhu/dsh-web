FROM node:24

ARG DSH_VERSION=0.1.6-alpha.1
RUN npm install -g pnpm@11 @deepseek-ai/dsh@${DSH_VERSION}

# 1、安装线上插件；临时设置 DSH_HOME 指向构建期的种子目录 /opt/seed/.dsh，HOME=/root 让 pnpm 用 root 的缓存。
RUN DSH_HOME=/opt/seed/.dsh HOME=/root \
    dsh plugin --profile web add dsh-web-startup-auth --config.auto-install-peers=false

# 1.1、定时任务插件（cron 到点新开会话提交提示词，设置页管理）。
RUN DSH_HOME=/opt/seed/.dsh HOME=/root \
    dsh plugin --profile web add @weibaohui/dsh-tasks --config.auto-install-peers=false

# 2、安装本地自定义插件（纯客户端：行号跳转）
COPY plugins /opt/seed/plugins
RUN DSH_HOME=/opt/seed/.dsh HOME=/root \
    dsh plugin --profile web add /opt/seed/plugins/dsh-web-line-jump --config.auto-install-peers=false
# pnpm 以相对 symlink 落盘 link: 依赖，种子 profile 拷进 /data 后路径失效；
# 解引用为真实目录，随 profile 一起拷贝即可用。
RUN cd /opt/seed/.dsh/profiles/web/node_modules/@agent-hub \
    && rm dsh-web-line-jump \
    && cp -r /opt/seed/plugins/dsh-web-line-jump dsh-web-line-jump

# 3、预置默认工作区（logAnalyze，含工作区级 skills 与 AGENTS.md），
COPY workspace /opt/seed/workspace

# 4、种子插件清单：entrypoint 逐个检查、缺哪个补哪个（增量同步）。
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
