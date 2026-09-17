# 每日日志收集推送 · 运维操作手册

定时收集日志产出方服务器上 luoshu 前一天的日志，推送到 dsh-web 服务器，
由 dsh-web 侧的定时任务自动分析并生成报告——形成完整闭环：

```
日志产出方（推送方）                                                  dsh-web 服务器（172.16.52.27）
/opt/zdocs/luoshu_log/*/combined-*                                  /opt/dsh-web/demosite-log/
                         │  每天 01:00 crontab 触发 logCollection.sh
                         ├── tar 打包昨天的 combined/error/java 日志
                         └── scp 推送 ──────→  luoshu-log-YYYYMMDD.tar.gz
                                                                      ←─ dsh 每天 09:00，定时分析后写回同级
                                                                   /opt/dsh-web/demosite-log/luoshu-log-YYYYMMDD.分析报告.md
```

## 一、推送方操作（日志产出方服务器）

### 1. 安装脚本

```bash
mkdir -p /opt/dsh-web
# 把项目 scripts/logCollection.sh 上传/拷贝到推送方服务器：
vi /opt/dsh-web/logCollection.sh        # 粘贴脚本内容，按需修改顶部配置段
chmod +x /opt/dsh-web/logCollection.sh
```

脚本顶部可按环境修改的配置：

| 配置 | 默认值 | 说明 |
|---|---|---|
| `LOG_ROOT` | `/opt/zdocs/luoshu_log` | luoshu 日志根目录（各节点子目录在其下） |
| `TARGET_HOST` | `172.16.52.27` | dsh-web 服务器 |
| `TARGET_PORT` / `TARGET_USER` / `TARGET_PASS` | `22` / `root` / `lenovolabs` | 接收方 SSH |
| `TARGET_DIR` | `/opt/dsh-web/demosite-log` | 接收目录 |
| `KEEP_DAYS` | `7` | 本地历史压缩包保留天数 |

### 2. 安装依赖

```bash
yum install -y sshpass      # CentOS/RHEL
# apt install -y sshpass    # Debian/Ubuntu
```

### 3. 手动执行一次验证

```bash
/opt/dsh-web/logCollection.sh
```

预期输出：`开始收集 … → 打包完成 → 推送完成 → 完成`。
然后到 dsh-web 服务器确认文件到达：

```bash
ssh root@172.16.52.27 'ls -lh /opt/dsh-web/demosite-log/'
# 应看到 luoshu-log-YYYYMMDD.tar.gz（YYYYMMDD 为昨天日期）
```

常见失败：

| 现象 | 处理 |
|---|---|
| `缺少 sshpass` | 执行第 2 步安装 |
| `未收集到任何日志` | 确认 `LOG_ROOT` 下存在昨天的 `combined-*` / `error-*` / `java*` 文件 |
| scp 超时/拒绝 | 检查到 172.16.52.27 的网络与 22 端口连通性、账号密码 |

### 4. 配置 crontab（每天凌晨 01:00）

```bash
crontab -e
```

追加一行：

```cron
0 1 * * * /opt/dsh-web/logCollection.sh >> /opt/dsh-web/logCollection.log 2>&1
```

保存生效。之后每天的执行输出都在 `/opt/dsh-web/logCollection.log`，排查问题先看它。

```bash
crontab -l                 # 确认已登记
tail -f /opt/dsh-web/logCollection.log
```

### 5.（推荐）改用 SSH 密钥，去掉明文密码

脚本中的密码是明文，内网测试环境可用；生产建议改免密：

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519     # 已有密钥可跳过
ssh-copy-id root@172.16.52.27
```

然后把脚本里的 `sshpass -p "$TARGET_PASS" scp` / `ssh` 两行中的
`sshpass -p "$TARGET_PASS" ` 前缀删掉即可（其余不变）。

## 二、接收方操作（dsh-web 服务器 172.16.52.27）

只需保证接收目录存在且 compose 已挂载（本项目 docker-compose.yml 已内置）：

```bash
mkdir -p /opt/dsh-web/demosite-log
ls /opt/dsh-web/demosite-log/    # 收到推送的 .tar.gz；分析报告也会写回这里
```

## 三、与 dsh 定时任务的衔接

- 推送包名 `luoshu-log-YYYYMMDD.tar.gz`，dsh 端报告自动生成在同目录：
  `luoshu-log-YYYYMMDD.分析报告.md`。
- dsh 定时任务（每天 09:00）取目录内**最新**压缩包分析；若该包的报告已存在则跳过，
  所以同一天重复推送/补传历史包不会重复分析。
- 补分析某天的包：把对应 tar.gz 拷入 `demosite-log/` 并确保它是目录内最新的
  （临时 `touch` 它），然后 dsh-web 设置 → 定时任务 → 该任务「立即执行」。
