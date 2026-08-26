# openApi 工作区

本工作区专注于 OpenAPI 接口错误日志分析（鉴权→参数校验→任务入队→下载→校验→转换→回调→下载全链路）。

## 强制规则：先查 Skills 再回答

在本工作区回答任何问题、执行任何任务之前，**必须先检查本工作区的 `.claude/skills/` 下是否有匹配的 skill**；只要有一点点可能匹配，就必须先调用该 skill 并按其规范执行，再给出回复。不得绕过 skill 直接凭记忆回答。

## 可用 Skill

- `openapi-error-log` — OpenAPI 错误日志分析（转换失败、回调失败、任务超时、签名/鉴权错误等）

## 图片 OCR（离线）

用户上传的**截图/图片**若模型无法直接识图（或需要精确提取图中文字），用工作区自带的 OCR 工具：

```bash
node /workspace/openApi/tools/ocr.js <图片绝对路径> [更多图片...]
```

- 中英文双语（chi_sim+eng），tesseract.js，语言包在 `tools/langdata/`，**完全离线**，不会联网下载。
- 图片路径从用户消息里的附件路径取（见 `upload-attachments` skill）。
- 一次可传多张；输出文本到 stdout。
