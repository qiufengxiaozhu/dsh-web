# dsh-web 服务器部署包（纯 npm 方案）

排查"本地源码插件在服务器上异常"：镜像内不含任何本地插件源码，
dsh（`0.1.0-rc.7`）与插件 `dsh-web-startup-auth` 全部从 npm registry 线上拉取。

与之前方案的差异：

- 插件改为 `dsh-web-startup-auth`（npm 包，DSH bundle，自带补丁），
  替代 dsh-host-auth / dsh-mcp-config / dsh-web-lan-access 三件套。
- 认证从 `DSH_WEB_ACCESS_KEY` 密钥门禁改为**登录/注册页**：首次访问注册
  管理员账号密码，之后需登录（会话 14 天）。
- `--host 0.0.0.0` 由该插件替换的原版 startup 放行，不再手写 webserver 补丁。
- 插件在**构建时装进镜像**（`/opt/seed` 种子 profile），服务器首次启动拷进
  数据卷，部署环境全程离线、无需访问 npm。

## 本地构建

```bash
./build.sh        # 构建镜像 dsh 并导出到桌面 dsh-web.tar.gz
```

## 服务器部署

```bash
# 1. 三个文件放同一目录：dsh-web.tar.gz、docker-compose.yml、.env
# 2. 导入镜像
docker load < dsh-web.tar.gz    # 或 gunzip 后 docker load -i dsh-web.tar

# 3. 配置环境（首次）
cp .env.example .env   # 编辑 .env：DEEPSEEK_API_KEY、DSH_TRUSTED_HOSTS

# 4. 启动（容器名 dsh-web，端口 9090）
docker compose up -d

# 5. 跟日志
docker compose logs -f
```

首次访问 `http://<服务器IP>:9090/` 会跳转 `/login` 注册管理员。

## 排查

| 症状 | 看什么 |
|---|---|
| 容器反复重启 | `docker compose logs` 找 `[entrypoint]` 报错（多半是数据卷/权限问题） |
| 忘记密码 | `docker compose exec dsh-web dsh --profile web auth-reset` |
| 重置凭据兜底 | 删除 `./dsh-data/.dsh/web-auth.json` 后重启 |
