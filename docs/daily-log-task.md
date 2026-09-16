# 每日日志定时分析（dsh-tasks）

用 [@weibaohui/dsh-tasks](https://github.com/weibaohui/dsh-tasks) 插件实现：
宿主机每天放入前一天的日志压缩包 → 定时新开会话分析 → 报告写回压缩包同级目录。

## 链路

```
宿主机 /opt/dsh-web/demosite-log/luoshu-log-YYYYMMDD.tar.gz
  ↓ docker -v 挂载
容器内工作区 /workspace/logAnalyze/daily/demosite/
  ↓ cron 到点，dsh-tasks 新建会话（绑定 logAnalyze 工作区）并提交 prompt
agent：取最新包 → 解压到 attachments/<日期时间>-<包名>/ → 按 .dsh/skills 分析
  → 报告写 daily/demosite/<包名>.分析报告.md + present
  ↓ 挂载实时同步
宿主机 /opt/dsh-web/demosite-log/luoshu-log-YYYYMMDD.分析报告.md
```

报告在会话内也可点击预览（就在工作区内），证据引用支持 `路径:行号` 跳转。

## 建任务（Web UI 一次性操作）

设置 → 定时任务 → 新建：

| 字段 | 值 |
|---|---|
| 标题 | demosite 每日日志分析 |
| 工作区 | logAnalyze |
| cron | `30 7 * * *`（每天 07:30，宿主机凌晨放包后） |

提示词（整段粘贴）：

```text
执行每日日志分析定时任务，按 logAnalyze 工作区 AGENTS.md 中「每日日志源目录 daily/」
的流程处理 daily/demosite/ 源目录：

1. 取该目录内修改时间最新的日志压缩包；
2. 若它对应的「<压缩包名>.分析报告.md」已存在于同目录，回复"今日已分析"并结束；
3. 解压到本会话专属目录 attachments/<日期时间>-<包名>/；
4. 按 .dsh/skills/ 的 openapi-error-log 与 opendoc-error-log 两个 skill，
   分析归类当天文档打开与 OpenAPI 两类错误；
5. 报告写入 daily/demosite/<压缩包名>.分析报告.md（与包同名 + .分析报告.md 后缀），
   结构：概况 → 错误归类（按 skill 输出格式）→ 处理建议 → 结论，
   日志证据引用遵守 AGENTS.md 回复引用规范（可点击 路径:行号），
   写完用 present 交付该报告；
6. daily/ 下已有文件不得移动、重命名、修改或删除。
```

## 新增日志源（如 f10）

1. `deploy/docker-compose.yml` 加一行挂载：
   `-/opt/dsh-web/f10:/workspace/logAnalyze/daily/f10`，`docker compose up -d` 重建；
2. Web UI 再建一个任务，提示词同上，把其中 `daily/demosite/` 换成 `daily/f10/`。

## 注意

- 权限预设为 `workspace-write`：agent 只能写工作区内（daily/ 挂载点在内，报告可写），
  工作区外写入被 landlock 沙箱拦截；需要升权的操作会弹审批，**定时会话无人审批会卡住**
  ——正常分析全程在工作区内不会触发；若日志显示任务卡住，检查会话里是否有待审批请求。
- 任务面板保留最近 20 次执行记录；会话以「任务标题 · 时间」挂在 logAnalyze 侧栏下。
- 本地开发（start.sh，非 docker）：`sudo mount --bind /opt/dsh-web/demosite-log \
  ~/dsh-workspaces/logAnalyze/daily/demosite` 模拟挂载（重启后需重新执行）。
