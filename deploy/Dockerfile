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
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Harness 主目录（会话、profile）放在 /data 数据卷上。
ENV DSH_HOME=/data/.dsh
VOLUME /data
# 端口绑定由 dsh-web-startup-auth 放行的 --host 0.0.0.0 控制，固定 9090。
EXPOSE 9090
ENTRYPOINT ["/entrypoint.sh"]
