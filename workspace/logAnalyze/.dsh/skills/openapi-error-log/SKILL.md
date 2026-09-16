---
name: openapi-error-log
description: 分析 luoshu-server OpenAPI 错误日志，覆盖鉴权→参数校验→任务入队→下载→校验→转换→回调→下载全链路。当用户提到 OpenAPI 报错、转换失败、回调失败、任务超时时触发。场景详见 references/openapi-error-scenarios.md。
---

# OpenAPI 错误日志分析

## 输出格式（必须遵守）

分析结果必须按以下五个部分输出，顺序固定，不得增删：

### 1. 故障概况

用表格给出基本信息（有多少填多少，未知项写"待确认"）。
**有准确文件名必须给出文件名；docId / taskId 有则必须给出**。OpenAPI 场景字段示例：

| 项目 | 内容 |
|------|------|
| taskId | |
| 接口/操作 | 如 文档转换(word2pdf) |
| 文件 | 文件名（大小、格式） |
| callback 结果 | code + detail.msg（如 TaskFailNotify / conversion timeout） |
| 错误现象 | 一句话描述 |

### 2. 根因分析

分两层展开，让读者明白"底层报错到底是啥"：

- **直接原因**：哪个环节、哪个组件返回了失败/异常，导致了最终报错（指出具体引擎/中间件名，
  如 Canvas、Aspose、CL 等，以及关键报错原文如 `processResult: false`、`ENOENT`）。
- **底层原因**：追溯上游——是什么输入/状态让该组件失败（如源文件大小异常、格式不支持、
  元数据缺失等）。每层附关键日志片段（日志为粘贴提供无行号时，标注时间戳即可）。

### 3. 日志证据链

列 **5 条左右**关键证据。区分"根因"与"症状"，每条用一两句话说明它证明了什么。

**来源标注格式（必须遵守，违反会导致界面无法点击跳转）**：

- 有日志文件时，行内代码里写**完整文件路径 + 单个 `:行号`**（相对工作区根，行号 1 起算），
  如 `attachments/20260916-1418-log0914/opt/zdocs/luoshu_log/TaskServer_2/combined-2026-06-01.log:11482`。
  **只允许一段数字**：写成 `路径:12:11482` 两段、或不带行号，都会导致点击定位失效。
- 用户直接粘贴的日志用时间戳定位（如 `11:16:37.431`）。

**关键字段完整输出**：taskId / docId / 文件名 / 关键日志原文必须完整，即使很长也**不得用
`…` / `...` 截断中间部分**——用户要靠它们回原文件定位；超长时换行展示，不要截断。
如 `Result of Conversion task [5e442d98-4e59-4cf3-b22e-c169806c8f41]: [1215] download error: aborted`
不得写成 `[5e442d98…]`。

**分析结束前**：把证据链涉及的关键日志文件用 `present` 工具交付（每次最多 8 个）。
**交付的 path 必须是纯路径，严禁带 `:行号` 后缀**（交付 `xxx.log:12` ✗），
与引用路径去掉 `:行号` 后完全一致。交付后，回复中这些路径可点击并在预览中定位。

### 4. 处理建议

按可操作性给出建议（如：重试任务、检查 fileUrl 可访问性、修正签名参数、更换格式等），
区分"调用方可自行处理"与"需服务端/管理员处理"。
**注意**：客户获取任务结果有两条途径——回调通知（callbackUrl）或主动轮询任务结果查询接口；
大多数客户用的是轮询查询。因此**不要把"回调接口返回 405/未收到通知"当作需要客户修正的问题提出**——
回调只是可选途径，回调失败不影响客户通过查询接口获取结果。仅当用户明确说他们依赖回调时才分析回调链路。

### 5. 结论

- 面向**非技术读者**，用平实语言，一两句话说清"发生了什么、为什么、影响是什么、下一步做什么"。
- 不要堆砌错误码原文；确需引用时用括号附带并解释含义。
- 中间件/引擎名称（Aspose、Canvas 等）**可以说**，但只点到为止，不展开内部实现细节。

## 用户应提供

| 必须 | 建议 |
|------|------|
| 错误时间 | callback收到的code/msg |
| taskId | 调用的接口路径 |
| 错误现象描述 | — |

## 快速定位：通过 callback 判断

先看 callback（或 queryTaskStatus）的 `code` + `detail.msg` 快速定位：

| code | 含义 |
|------|------|
| TaskSuccessNotify | 成功，用contentId下载 |
| TaskFailNotify | 失败，看detail.msg |
| TaskHandingNotify | 处理中 |
| InvalidTaskId | 过期(>60min TTL) |

| detail.msg关键词 | 含义 |
|-----------------|------|
| conversion unknown | 通用转换失败 |
| conversion timeout | 超时 |
| conversion download err | 下载失败 |
| conversion invalid password | 加密 |
| conversion fotmat err | 格式/MIME错误 |
| conversion soffice err | 引擎错误 |
| content toolarge | 文件过大 |
| model op busy/fail/error | ModelOp失败 |

> 场景详细诊断见 `references/openapi-error-scenarios.md`

## 请求链路

```
① 鉴权 → HMAC签名+License+Quota
② 参数校验 → filename/fileUrl/callback/水印/白名单
③ 任务入队 → Redis锁+限流+Bull队列
④ 下载(TaskServer) → fileUrl HTTP下载(10s超时)
⑤ 文件校验 → 空文件/大小/MIME/加密检测
⑥ 转换执行 → CL/Aspose/Canvas/Puppeteer等引擎
⑦ 回调通知 → POST callbackUrl(5s超时,无重试)
⑧ 下载 → taskId+contentId获取结果
```

## 按现象定位

| 现象 | 阶段 | 日志关键字 |
|------|------|-----------|
| HTTP 401 | ①鉴权 | `verify token fail` |
| HTTP 412+ResCode | ②参数 | ResCode名称 |
| HTTP 200+ServerBusy | ③入队 | `get queue lock fail` |
| callback收到FAIL | ④⑤⑥ | `[ConvertWorker]` |
| callback未收到 | ⑦回调 | `task notify with error` |
| 下载报错 | ⑧下载 | `[downloadResult]` |

## 核心搜索关键字

| 阶段 | grep_log 搜索 pattern | 搜索范围 |
|------|----------------------|---------|
| 全链路 | `<taskId>` | 全部日志 |
| ①鉴权 | `verify token fail\|Token format is invalid\|Public API is disabled` | combined*.log |
| ③入队 | `get queue lock fail\|maxActiveTask\|concurrent exceeds` | combined*.log |
| ④下载 | `download error\|CONVERT_DOWNLOAD_ERROR\|0 bytes\|is too small` | combined*.log |
| ⑤校验 | `Invalid File mime type\|Password Protected\|FILE_TOO_LARGE` | combined*.log |
| ⑥转换(Node) | `Result of Conversion task\|Catch Exception\|CLConvertor.*ExitCode` | combined*.log + error*.log |
| ⑥转换(Java) | `SEVERE\|Exception\|OutOfMemory\|CellsException\|UnsupportedFileFormatException` | **全部 java-systemOut*.log（含轮转文件）** |
| ⑥ModelOp | `model op busy\|model op fail\|Worker.*killed\|modelOpUnSupport` | combined*.log |
| ⑥SmartArt转图 | `Grpsp2pngConverter\|Unknown image format` | **全部 java-systemOut*.log（含轮转文件）** |
| ⑥ENOENT症状 | `ENOENT.*grpsp\|target file not exist` | error*.log + combined*.log |
| ⑦回调 | `notify.*Success\|notify res fail\|task notify with error` | combined*.log |

> **重要**：
> - Java 日志时间 = Node 时间 - 8h（Java UTC+0，Node UTC+8）。搜索 Java 日志时必须先换算时区
> - `total: 30, limit: 30` 说明结果被截断，需缩小范围继续搜索
> - 搜索必须覆盖**全部 TaskServer 节点**的**全部轮转文件**（java-systemOut.0.log ~ java-systemOut.19.log 等）
> - **grep_log 返回 30 条全是旧 INFO 级日志时**：不代表没有 SEVERE 错误，换用 `Grpsp2pngConverter|SEVERE` 或 `Unknown image format` 等更精确关键词重搜
> - **Node 端 ENOENT 是症状不是根因**：看到 `ENOENT: Pictures/grpsp*.png` 后，必须去 Java 日志找 `Grpsp2pngConverter` 的 SEVERE 报错

## ResCode 速查

**401鉴权**：InvalidAuthHeader(400) InvalidAuthRepoID(401) InvalidAuthTimestamp(402) TokenIsInvalid(403) PublicApiIsDisable(464)

**412参数**：FilenameIsNull(410) CallbackIsNull(414) FileUrlNotAllowed(419) CallbackUrlNotAllowed(420) DocTypeNotSupport(421)

**入队**：TaskQueueCongestion(505) ServerBusy(506) NotSupportTask(513)

**回调/下载**：TaskSuccessNotify(509) TaskFailNotify(510) InvalidTaskId(423) ContentIdError(425)

## ConvertErrCode 速查

| Code | 值 | 含义 |
|------|----|------|
| CONVERSION_DONE | 200 | 完成 |
| FILE_TOO_LARGE | 413 | 过大 |
| FILE_INVALID_MIMETYPE | 415 | MIME无效 |
| INVALID_PASSWORD | 491 | 加密 |
| SOFFICE_BUSY | 493 | 引擎忙 |
| UNKNOWN | 520 | 未知 |
| CL_TIMEOUT | 521 | CL超时 |
| CORRUPTED_FILE | 529 | 损坏 |
| CONVERT_DOWNLOAD_ERROR | 1001 | 下载失败 |
| CONVERT_STANDALONE_BUSY | 1011 | 实例忙 |
| DOWNLOAD_FILE_TOO_SMALL | 1014 | 文件过小 |

## 任务判定

| 日志 | 成功 | 失败 |
|------|------|------|
| `Result of Conversion task [tid]: [code]` | 1299 | ≠1299 |
| `Done the execution ... with code [code]` | 200 | ≠200 |

## 超时配置

Bull 180s | CL/Java 300s | ModelOp 300s | JavaSA锁 120s | 下载 10s | 回调 5s(无重试) | 下载TTL 60min

## 文件大小限制

Word→PDF 50MB | Sheet→PDF 50MB | PPT→PDF 100MB | 水印 50MB | merge 400MB | OOXML最小 1KB

## 脚本辅助

```bash
python3 $SCRIPTS_DIR/analyze_openapi_failure.py --logDir $LOG_DIR --taskId <taskId>
```

参考：`references/openapi-error-scenarios.md` | `references/error-codes.md`
