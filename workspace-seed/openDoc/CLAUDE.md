# openDoc 工作区

本工作区专注于文档打开（预览+编辑）错误日志分析（HTTP入口→WebSocket→文档转换→Draft加载→保存发布→资源加载全阶段）。

## 强制规则：先查 Skills 再回答

在本工作区回答任何问题、执行任何任务之前，**必须先检查本工作区的 `.claude/skills/` 下是否有匹配的 skill**；只要有一点点可能匹配，就必须先调用该 skill 并按其规范执行，再给出回复。不得绕过 skill 直接凭记忆回答。

## 可用 Skill

- `opendoc-error-log` — 文档打开故障分析（文档打不开、预览白屏、编辑报错、转换失败、保存失败等）

## 图片 OCR（离线）

用户上传的**截图/图片**若模型无法直接识图（或需要精确提取图中文字），用工作区自带的 OCR 工具：

```bash
node /workspace/openDoc/tools/ocr.js <图片绝对路径> [更多图片...]
```

- 中英文双语（chi_sim+eng），tesseract.js，语言包在 `tools/langdata/`，**完全离线**，不会联网下载。
- 图片路径从用户消息里的附件路径取（见 `upload-attachments` skill）。
- 一次可传多张；输出文本到 stdout。
