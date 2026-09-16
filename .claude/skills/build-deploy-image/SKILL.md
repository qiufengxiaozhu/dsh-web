---
name: build-deploy-image
description: 构建 dsh-web Docker 镜像并导出 tar.gz 到宿主机（Windows）桌面，供服务器部署。当用户要求"build 镜像""打包 tar""导出镜像到桌面"时使用。
---

# 构建并导出 dsh-web 部署镜像

## 命令流程

只需一条命令，deploy/build.sh 已封装全部步骤：

```bash
cd /opt/dsh-web && ./deploy/build.sh
```

脚本内部做三件事（按约定**只构建导出，不启动容器**）：

1. `docker build -f deploy/Dockerfile -t dsh ..`（构建上下文是仓库根目录，
   因为要把 `workspace/` 打进镜像）
2. `docker save dsh | gzip > /mnt/c/Users/lenovocloud/Desktop/dsh-web.tar.gz`
3. 输出产物路径

## 前置检查

- Docker daemon 在运行（WSL2 里 `docker info` 能通）。
- 桌面路径 `/mnt/c/Users/lenovocloud/Desktop` 存在（换机器需改 build.sh 里的 `DESKTOP`）。
- 构建需要访问 npm registry（dsh 与 dsh-web-startup-auth 从线上拉取）；
  离线环境会失败。

## 常见调整

- 改 dsh 版本：`deploy/Dockerfile` 顶部的 `ARG DSH_VERSION`。
- 改本地插件：改 `dsh-plugins/` 下源码即可，Dockerfile 构建时拷入。
- 改 entrypoint/settings 合并逻辑：改 `deploy/entrypoint.sh`，需重新 build。

## 服务器部署（提示给用户即可，不在本地执行）

```bash
docker load < dsh-web.tar.gz
# dsh-web.tar.gz、docker-compose.yml、.env 三文件同目录
docker compose up -d
```
