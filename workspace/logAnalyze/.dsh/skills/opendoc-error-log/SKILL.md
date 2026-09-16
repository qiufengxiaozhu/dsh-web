---
name: opendoc-error-log
description: 分析洛书服务文档打开（预览+编辑）错误日志。覆盖 HTTP入口→WebSocket→文档转换→Draft加载→保存发布→资源加载全阶段。当用户提到文档打不开、预览白屏、编辑报错、转换失败、保存失败时触发。场景详见 references/opendoc-error-scenarios.md。
---

# 文档打开（预览+编辑）错误日志分析

## 输出格式（必须遵守）

分析结果必须按以下五个部分输出，顺序固定，不得增删：

### 1. 故障概况

用表格给出基本信息（有多少填多少，未知项写"待确认"）。
**有准确文件名必须给出文件名；docId / taskId 有则必须给出**：

| 项目 | 内容 |
|------|------|
| 文档 | 文件名 |
| docId | |
| 仓库 | |
| 文件大小 | 字节数（约 xx KB） |
| 文件类型 | MIME 类型（格式） |
| 操作模式 | 预览 (view) / 编辑 (edit) |
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

- 有日志文件时，行内代码里写**完整文件路径**（相对工作区根，与 present 交付的路径一致），
  需要定位时在路径后加 `:行号`（行号 1 起算，不带列号），如
  `attachments/20260916-1418-log0914/opt/zdocs/luoshu_log/NewDocServer_5/combined-2026-06-01.log:2737`；
  由行号插件解析，点击在右侧栏预览并定位到该行。
- 用户直接粘贴的日志用时间戳定位（如 `11:16:37.431`）。

**关键字段完整输出**：taskId / docId / 文件名 / 关键日志原文必须完整，即使很长也**不得用
`…` / `...` 截断中间部分**——用户要靠它们回原文件定位；超长时换行展示，不要截断。
如 `Result of Conversion task [5e442d98-4e59-4cf3-b22e-c169806c8f41]: [1215] download error: aborted`
不得写成 `[5e442d98…]`。

**分析结束前**：把证据链涉及的关键日志文件用 `present` 工具交付（每次最多 8 个，
交付路径必须与证据链中引用的行内代码完全一致）。交付后，回复中这些路径可点击，
在右侧栏打开文件预览。

### 4. 处理建议

按可操作性给出建议（如：重试转换、检查源文件、更换格式后重新上传、联系管理员等），
区分"用户可自行处理"与"需后台/管理员处理"。

### 5. 结论

- 面向**非技术读者**，用平实语言，一两句话说清"发生了什么、为什么、影响是什么、下一步做什么"。
- 不要堆砌错误码原文；确需引用时用括号附带并解释含义。
- 中间件/引擎名称（Aspose、Canvas 等）**可以说**，但只点到为止，不展开内部实现细节。

## 用户应提供

| 必须 | 建议 |
|------|------|
| 错误时间（精确到分钟） | 文件类型(docx/xlsx等) |
| docId 或 taskId | 前端错误截图 |
| 错误现象描述 | — |

## 请求链路

```
① HTTP入口 → 认证/License/权限/格式校验
② WebSocket → JWT校验+连接数限制
③ 文档打开 → meta状态判断 → INACTIVE触发转换/ACTIVE直接加入/ERROR返回错误
④ 转换(TaskServer) → 下载源文件 → CL/Aspose转换 → 上传结果 → 回调DocsServer
⑤ Draft加载 → 拉取JSON/PDF draft
⑦ 保存/发布 → applyMsg → convert → uploadNewVersion
⑧ 资源加载 → 图片/字体/WMF懒转换
```

## 按现象定位

| 现象 | 阶段 | 日志关键字 |
|------|------|-----------|
| 错误页面(error.ejs) | ①HTTP入口 | `[apigateway_api_docs]` |
| 白屏/转圈不动 | ②③④ | `[ConnectionManager]` `[DocumentService]` |
| "转换服务不可用"+ErrorCode | ④转换失败 | `[ConvertWorker]` |
| "转换服务不可用"+1214+格式不识别 | ④Java格式异常 | `UnsupportedFileFormatException`(java) |
| "无法打开文档"+1203 | ④MIME校验失败 | `convert import error` |
| 一直转换中不结束 | ④IMPORTING超时 | `importFailProcess` |
| "无权编辑" | ①③权限 | `[apigateway_api_docs]` |
| License错误 | ①License | `LICENSE_EXPIRE` |
| 保存失败 | ⑦保存 | `[ExportDocWorker]` |
| 图片不显示 | ⑧资源 | `[attachment]` |
| draft加载失败 | ⑤Draft | `[DraftStorageService]` |
| 文字乱码/方块 | 字体缺失(非错误) | 无错误日志,需上传字体 |
| SmartArt图片缺失/404 | ④SmartArt转图失败 | `Grpsp2pngConverter` `Unknown image format`(java) |

> 场景详细诊断见 `references/opendoc-error-scenarios.md`

## 核心搜索关键字

| 阶段 | grep_log 搜索 pattern | 搜索范围 |
|------|----------------------|---------|
| 全链路 | `<docId>` 或 `<taskId>` | 全部日志 |
| ①入口 | `errorCode\|error\.ejs\|LICENSE_EXPIRE\|NO_RIGHT` | combined*.log |
| ②WebSocket | `AUTH_OTHER_ERROR\|SESSION_EXPIRE\|REACH_MAX` | combined*.log |
| ③打开 | `startConvert\|needConvert\|importFailProcess` | combined*.log |
| ④转换(Node) | `Result of Conversion task\|Catch Exception\|CLConvertor.*ExitCode` | combined*.log + error*.log |
| ④转换(Java) | `SEVERE\|Exception\|OutOfMemory\|CellsException\|UnsupportedFileFormatException` | **全部 java-systemOut*.log（含轮转文件）** |
| ④SmartArt转图 | `Grpsp2pngConverter\|Unknown image format` | **全部 java-systemOut*.log（含轮转文件）** |
| ④ENOENT症状 | `ENOENT.*grpsp\|target file not exist` | error*.log + combined*.log |
| ④下载 | `Download\|fileSize` | combined*.log |
| ⑤Draft | `Could not find draft\|Could not get draft` | combined*.log |
| ⑦保存 | `PUBLISH_REMOTE_ERROR\|applyMessages.*error` | combined*.log |

> **重要**：
> - Java 日志时间 = Node 时间 - 8h（Java UTC+0，Node UTC+8）。搜索 Java 日志时必须先换算时区
> - `total: 30, limit: 30` 说明结果被截断，需缩小范围继续搜索
> - 搜索必须覆盖**全部 TaskServer 节点**的**全部轮转文件**（java-systemOut.0.log ~ java-systemOut.19.log 等）
> - **grep_log 返回 30 条全是旧 INFO 级日志时**：不代表没有 SEVERE 错误，换用 `Grpsp2pngConverter|SEVERE` 或 `Unknown image format` 等更精确关键词重搜
> - **Node 端 ENOENT 是症状不是根因**：看到 `ENOENT: Pictures/grpsp*.png` 后，必须去 Java 日志找 `Grpsp2pngConverter` 的 SEVERE 报错

## 错误码速查

| code | 含义 |
|------|------|
| 1299 | 成功 |
| 1203 | MIME/格式错误（detail 415=MIME不匹配, 529=损坏） |
| 1214 | 转换失败（通用，必须看日志确认原因） |

| DocsErrorCode | ConvertErrCode | 含义 |
|---------------|---------------|------|
| CONVERSION_UNKNOWN | 520,525,526,1215-1299 | 未知转换错误 |
| CONVERSION_TIMEOUT | 495,521,1006 | 超时 |
| CONVERSION_FOTMAT_ERR | 415,529 | MIME/格式 |
| CONVERSION_DOWNLOAD_ERR | 1001 | 下载失败 |
| CONVERSION_INVALID_PASSWORD | 491 | 加密密码错误 |
| CONVERSION_SERVER_BUSY | 493,1011 | 引擎繁忙 |
| CONTENT_TOOLARGE | 413 | 文件过大 |
| DOWNLOAD_FILE_TOO_SMALL | 1014 | 下载文件过小 |

## Meta 状态机

| 状态 | 行为 |
|------|------|
| INACTIVE | 触发转换 |
| IMPORTING | 等待中，3min后importFailProcess，最多重试3次 |
| ACTIVE | 直接加入会话 |
| ERROR | 返回持久化errorCode |

## 任务判定

| 日志 | 成功 | 失败 |
|------|------|------|
| `Result of Conversion task [tid]: [code]` | 1299 | ≠1299 |
| `Done the execution ... with code [code]` | 200 | ≠200 |

> CLConvertor ExitCode code=112 可能伴随parser error，但最终Result=1299则任务**成功**。

## 超时配置

Convert 180s | ExportDoc 300s | CL/Java 300s | IMPORTING 3min×3次(max60min) | WS disconnect 60s

## 文件大小限制

Word 300MB | Sheet 300MB | PPT 100MB | PDF 200-300MB

## 脚本辅助

```bash
python3 $SCRIPTS_DIR/analyze_task_failure.py --logDir $LOG_DIR --docId <docId>
python3 $SCRIPTS_DIR/analyze_task_failure.py --logDir $LOG_DIR --taskId <taskId>
```

参考：`references/opendoc-error-scenarios.md` | `references/error-codes.md`
