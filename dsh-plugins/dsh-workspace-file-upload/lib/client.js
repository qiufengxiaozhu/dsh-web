window.__ModuleLoader__.load({
  id: "@agent-hub/dsh-workspace-file-upload",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots", "locale"];
    const NS = "agent-hub-file-upload";
    const CONFIG_URL = "/agent-hub/file-upload/config";

    /** 本插件命名空间的中英文词典（DSH 语言 ID 为 "zh" 与 "en"）。 */
    const DICTIONARIES = {
      zh: {
        "button.title": "上传普通文件或 zip 压缩包到当前工作区（zip 会自动解压，最多 {limit} MB/个）；也可直接拖拽文件到页面任意位置",
        "button.uploading": "上传中…",
        "button.drop": "松开上传",
        "button.file": "文件",
        "upload.overLimit": "{name} 超过 {mb} MB 限制（可在 设置 中调整）",
        "upload.badResponse": "上传响应无效",
        "upload.failed": "上传失败 ({status})",
        "upload.progress": "正在上传 {name}（{current}/{total}）…",
        "upload.done": "已上传 {count} 个文件",
        "drop.overlay": "松开以上传到工作区",
        "zip.errEntryLimit": "压缩包包含的文件数超过解压上限（{limit} 个）。文件已保存但未解压，请到 设置 → General 调高 zip 解压上限，或先用压缩软件手动解压。",
        "zip.errSizeLimit": "压缩包解压后体积超过上限（{limit} MB）。文件已保存但未解压，请到 设置 → General 调高 zip 解压上限，或先用压缩软件手动解压。",
        "zip.errCorrupt": "压缩包已保存，但解压失败（文件可能损坏或格式不受支持）。",
        "settings.uploadLabel": "文件上传大小上限",
        "settings.extractLabel": "zip 解压上限",
        "settings.unitMb": "MB",
        "settings.unitEntries": "个文件",
        "settings.save": "保存",
        "settings.saving": "保存中…",
        "settings.saved": "已保存",
        "settings.invalidUpload": "请输入 {min}–{max} 之间的整数（单位 MB）",
        "settings.invalidExtractMb": "请输入 {min}–{max} 之间的整数（单位 MB）",
        "settings.invalidExtractEntries": "请输入 {min}–{max} 之间的整数",
        "settings.saveBadResponse": "保存响应无效",
        "settings.saveFailed": "保存失败 ({status})",
        "dock.label": "已上传：",
        "dock.zipBadge": "zip",
        "dock.zipTooltip": "{path}（已解压到 {dir}/，共 {count} 个文件）",
        "dock.fileTooltip": "{path}",
        "dock.remove": "移除 {name}",
        "dock.clear": "清空",
        "dock.deleteBadResponse": "删除响应无效",
        "dock.deleteFailed": "删除失败 ({status})",
        "dock.deleteSomeFailed": "有 {count} 个文件删除失败",
        "slot.uploadLabel": "文件上传",
        "slot.uploadListLabel": "已上传文件",
        "slot.uploadLimitLabel": "文件上传大小上限",
        "slot.extractLimitLabel": "zip 解压上限",
      },
      en: {
        "button.title": "Upload files or zip archives to the current workspace (zips auto-extract, max {limit} MB each); you can also drag & drop files anywhere on the page",
        "button.uploading": "Uploading…",
        "button.drop": "Drop to upload",
        "button.file": "Files",
        "upload.overLimit": "{name} exceeds the {mb} MB limit (adjust it in Settings)",
        "upload.badResponse": "Invalid upload response",
        "upload.failed": "Upload failed ({status})",
        "upload.progress": "Uploading {name} ({current}/{total})…",
        "upload.done": "Uploaded {count} file(s)",
        "drop.overlay": "Drop to upload to the workspace",
        "zip.errEntryLimit": "The archive contains more entries than the extraction limit ({limit}). The file was saved but not extracted — raise the zip extraction limit in Settings → General, or extract it manually with an archive tool.",
        "zip.errSizeLimit": "The archive would extract to more than the {limit} MB limit. The file was saved but not extracted — raise the zip extraction limit in Settings → General, or extract it manually with an archive tool.",
        "zip.errCorrupt": "The archive was saved, but extraction failed (the file may be corrupt or use an unsupported format).",
        "settings.uploadLabel": "Max upload size",
        "settings.extractLabel": "Zip extraction limit",
        "settings.unitMb": "MB",
        "settings.unitEntries": "entries",
        "settings.save": "Save",
        "settings.saving": "Saving…",
        "settings.saved": "Saved",
        "settings.invalidUpload": "Enter an integer between {min} and {max} (MB)",
        "settings.invalidExtractMb": "Enter an integer between {min} and {max} (MB)",
        "settings.invalidExtractEntries": "Enter an integer between {min} and {max}",
        "settings.saveBadResponse": "Invalid save response",
        "settings.saveFailed": "Save failed ({status})",
        "dock.label": "Uploaded:",
        "dock.zipBadge": "zip",
        "dock.zipTooltip": "{path} (extracted to {dir}/, {count} files)",
        "dock.fileTooltip": "{path}",
        "dock.remove": "Remove {name}",
        "dock.clear": "Clear",
        "dock.deleteBadResponse": "Invalid delete response",
        "dock.deleteFailed": "Delete failed ({status})",
        "dock.deleteSomeFailed": "{count} file(s) could not be deleted",
        "slot.uploadLabel": "File upload",
        "slot.uploadListLabel": "Uploaded files",
        "slot.uploadLimitLabel": "Max upload size",
        "slot.extractLimitLabel": "Zip extraction limit",
      },
    };

    /** 上传按钮与设置行共用的轻量配置请求封装。 */
    async function fetchConfig() {
      const response = await fetch(CONFIG_URL, { cache: "no-store" });
      const result = await response.json().catch(() => ({ ok: false }));
      return result.ok
        ? {
            maxUploadMb: Number(result.maxUploadMb) || 25,
            maxExtractMb: Number(result.maxExtractMb) || 4096,
            maxExtractEntries: Number(result.maxExtractEntries) || 100000,
            minMb: Number(result.minMb) || 1,
            maxMb: Number(result.maxMb) || 2048,
            minExtractMb: Number(result.minExtractMb) || 1,
            maxExtractMbBound: Number(result.maxExtractMbCap) || 65536,
            minExtractEntries: Number(result.minExtractEntries) || 1,
            maxExtractEntriesBound: Number(result.maxExtractEntriesCap) || 10000000,
          }
        : {
            maxUploadMb: 25,
            maxExtractMb: 4096,
            maxExtractEntries: 100000,
            minMb: 1,
            maxMb: 2048,
            minExtractMb: 1,
            maxExtractMbBound: 65536,
            minExtractEntries: 1,
            maxExtractEntriesBound: 10000000,
          };
    }

    /** 拖拽负载里是否至少含一个非图片文件。 */
    function hasNonImageFiles(dataTransfer) {
      if (!dataTransfer) return false;
      const types = Array.from(dataTransfer.types || []);
      if (!types.includes("Files")) return false;
      const items = Array.from(dataTransfer.items || []);
      // 部分浏览器在 dragover 阶段拿不到 items；拿不准时按本插件处理，
      // 保证非图片文件也能被接收。
      if (!items.length) return true;
      return items.some((item) => item.kind === "file" && !(item.type || "").startsWith("image/"));
    }

    /**
     * 模块级的小型上传记录仓库，供上传按钮与输入框 dock 列表共享。
     * 上传从不写入草稿——指令由用户自己写——因此本仓库是本次会话
     * 已上传文件的唯一记录。
     */
    const uploadStore = {
      items: [],
      listeners: new Set(),
      subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
      },
      getSnapshot() {
        return this.items;
      },
      emit() {
        for (const fn of [...this.listeners]) try { fn(); } catch (error) { console.error(error); }
      },
      add(upload) {
        this.items = [...this.items, upload];
        this.emit();
      },
      remove(path, sessionId) {
        this.items = this.items.filter((item) => !(item.path === path && String(item.sessionId ?? "") === String(sessionId ?? "")));
        this.emit();
      },
      clear() {
        this.items = [];
        this.emit();
      },
    };

    /** 把字节数格式化为可读文本。 */
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 0) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    /** 内联回形针图标（描边风格，继承 currentColor）。 */
    function PaperclipIcon({ size }) {
      return React.createElement("svg", {
        width: size, height: size, viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: 1.8,
        strokeLinecap: "round", strokeLinejoin: "round",
        "aria-hidden": "true", style: { display: "block" },
      },
        // 标准回形针路径（feather/lucide 风格）。
        React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" })
      );
    }

    function UploadButton(props) {
      const t = props.t;
      const inputRef = React.useRef(null);
      const [busy, setBusy] = React.useState(false);
      const [status, setStatus] = React.useState(null);
      const [limit, setLimit] = React.useState(25);
      const [dragOver, setDragOver] = React.useState(false);
      const [dragActive, setDragActive] = React.useState(false);
      const dragDepthRef = React.useRef(0);
      const inputState = props.useInput((state) => state);

      React.useEffect(() => {
        fetchConfig().then((config) => setLimit(config.maxUploadMb)).catch(() => {});
      }, []);

      // 语言切换时重新渲染，让翻译文案刷新。
      const [localeRev, setLocaleRev] = React.useState(0);
      React.useEffect(() => {
        if (!props.localeSubscribe) return undefined;
        return props.localeSubscribe(() => setLocaleRev((rev) => rev + 1));
      }, []);
      void localeRev;

      // 页面级拖拽：窗口任意位置都可接收非图片文件并上传；
      // 纯图片拖拽仍走原生附件流程。
      React.useEffect(() => {
        function onDragEnter(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepthRef.current += 1;
          setDragActive(true);
        }
        function onDragOver(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          // 必须 preventDefault 才允许 drop，同时阻止浏览器直接打开文件。
          event.preventDefault();
        }
        function onDragLeave(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragActive(false);
        }
        async function onDrop(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepthRef.current = 0;
          setDragActive(false);
          const files = Array.from(event.dataTransfer?.files || [])
            .filter((file) => !(file.type || "").startsWith("image/"));
          await uploadFilesRef.current(files);
        }
        window.addEventListener("dragenter", onDragEnter);
        window.addEventListener("dragover", onDragOver);
        window.addEventListener("dragleave", onDragLeave);
        window.addEventListener("drop", onDrop);
        return () => {
          window.removeEventListener("dragenter", onDragEnter);
          window.removeEventListener("dragover", onDragOver);
          window.removeEventListener("dragleave", onDragLeave);
          window.removeEventListener("drop", onDrop);
        };
      }, []);

      // 放进 ref，让上面的 effect 无需因函数变化而重新绑定。
      const uploadFilesRef = React.useRef(null);

      async function uploadOne(file, maxBytes) {
        if (file.size > maxBytes) throw new Error(t("upload.overLimit", { name: file.name, mb: maxBytes / 1024 / 1024 }));
        const query = new URLSearchParams({ sessionId: String(props.sessionId), name: file.name });
        const response = await fetch(`/agent-hub/file-upload?${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({ ok: false, error: t("upload.badResponse") }));
        if (!response.ok || !result.ok) throw new Error(result.error || t("upload.failed", { status: response.status }));
        return result;
      }

      async function uploadFiles(files) {
        if (!files || !files.length) return;
        setBusy(true);
        setStatus(null);
        try {
          const config = await fetchConfig();
          const maxBytes = config.maxUploadMb * 1024 * 1024;
          const results = [];
          for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            setStatus({ tone: "info", text: t("upload.progress", { name: file.name, current: i + 1, total: files.length }) });
            results.push(await uploadOne(file, maxBytes));
          }
          // 把每次上传记入仓库，供输入框 dock 列表展示。
          // 刻意不写入草稿：指令（编辑/读取/其他）由用户自己写。
          for (const result of results) {
            uploadStore.add({
              sessionId: String(props.sessionId ?? ""),
              path: result.path,
              name: result.path.split("/").pop(),
              bytes: result.bytes ?? 0,
              kind: result.kind,
              extracted: result.extracted,
              fileCount: result.files ? result.files.length : undefined,
              extractError: result.extractError,
              extractErrorCode: result.extractErrorCode,
              extractLimit: result.extractLimit,
            });
          }
          // 累计提示数：算上本次会话此前已上传的文件，而不是只报本次批量。
          const mine = uploadStore.getSnapshot().filter((item) => String(item.sessionId ?? "") === String(props.sessionId ?? ""));
          setStatus({ tone: "ok"/*, text: t("upload.done", { count: mine.length })*/ });
        } catch (error) {
          setStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }
      uploadFilesRef.current = uploadFiles;

      async function onFiles(event) {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        await uploadFiles(files);
      }

      async function onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        if (busy || inputState.phase !== "plain") return;
        await uploadFiles(Array.from(event.dataTransfer?.files || []));
      }

      const buttonStyle = {
        border: dragOver ? "1px dashed var(--border-color, rgba(128,128,128,.55))" : "0",
        background: dragOver ? "var(--color-bg-active, rgba(128,128,128,.15))" : "transparent",
        color: "inherit",
        opacity: busy ? 0.55 : 0.78,
        cursor: busy ? "wait" : "pointer",
        padding: "4px 7px",
        borderRadius: "6px",
        fontSize: "12px",
        lineHeight: "20px",
      };

      return React.createElement(React.Fragment, null,
        React.createElement("input", {
          ref: inputRef,
          type: "file",
          multiple: true,
          hidden: true,
          onChange: onFiles,
        }),
        React.createElement("button", {
          type: "button",
          disabled: busy || inputState.phase !== "plain",
          title: t("button.title", { limit }),
          "aria-label": t("button.file"),
          onClick: () => inputRef.current && inputRef.current.click(),
          onDragOver: (event) => { event.preventDefault(); if (!busy) setDragOver(true); },
          onDragLeave: () => setDragOver(false),
          onDrop,
          style: buttonStyle,
        }, busy
          ? t("button.uploading")
          : dragOver
            ? t("button.drop")
            : React.createElement(PaperclipIcon, { size: 14 })),
        status && React.createElement("span", {
          style: {
            marginLeft: "4px",
            fontSize: "11px",
            lineHeight: "20px",
            color: status.tone === "error" ? "#e5484d" : status.tone === "ok" ? "#46a758" : "inherit",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "240px",
            verticalAlign: "middle",
          },
        }, status.text),
        dragActive && React.createElement("div", {
          style: {
            position: "fixed",
            inset: "0",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,.45)",
            pointerEvents: "auto",
            fontFamily: "inherit",
          },
        }, React.createElement("div", {
          style: {
            padding: "28px 44px",
            borderRadius: "12px",
            background: "var(--color-bg, rgba(24,24,27,.92))",
            border: "2px dashed var(--border-color, rgba(128,128,128,.6))",
            color: "inherit",
            fontSize: "16px",
            fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,.35)",
          },
        }, t("drop.overlay")))
      );
    }

    /** 设置 → General 里的紧凑设置行：上传大小上限 + zip 解压上限。 */
    function UploadLimitRow(props) {
      const t = props.t;
      const [draft, setDraft] = React.useState("25");
      const [extractDraft, setExtractDraft] = React.useState("4096");
      const [entriesDraft, setEntriesDraft] = React.useState("100000");
      const [bounds, setBounds] = React.useState({ min: 1, max: 2048, minExtractMb: 1, maxExtractMb: 65536, minEntries: 1, maxEntries: 10000000 });
      const [busy, setBusy] = React.useState(false);
      const [message, setMessage] = React.useState(null);

      // 语言切换时重新渲染，让翻译文案刷新。
      const [localeRev, setLocaleRev] = React.useState(0);
      React.useEffect(() => {
        if (!props.localeSubscribe) return undefined;
        return props.localeSubscribe(() => setLocaleRev((rev) => rev + 1));
      }, []);
      void localeRev;

      React.useEffect(() => {
        let cancelled = false;
        fetchConfig().then((config) => {
          if (cancelled) return;
          setDraft(String(config.maxUploadMb));
          setExtractDraft(String(config.maxExtractMb));
          setEntriesDraft(String(config.maxExtractEntries));
          setBounds({
            min: config.minMb,
            max: config.maxMb,
            minExtractMb: config.minExtractMb,
            maxExtractMb: config.maxExtractMbBound,
            minEntries: config.minExtractEntries,
            maxEntries: config.maxExtractEntriesBound,
          });
        }).catch(() => {});
        return () => { cancelled = true; };
      }, []);

      async function postConfig(patch) {
        const response = await fetch(CONFIG_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({ ok: false, error: t("settings.saveBadResponse") }));
        if (!response.ok || !result.ok) throw new Error(result.error || t("settings.saveFailed", { status: response.status }));
        return result;
      }

      async function saveUpload() {
        const value = Number(draft);
        if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
          setMessage({ tone: "error", text: t("settings.invalidUpload", { min: bounds.min, max: bounds.max }) });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const result = await postConfig({ maxUploadMb: value });
          setDraft(String(result.maxUploadMb));
          setMessage({ tone: "ok", text: t("settings.saved") });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      async function saveExtract() {
        const value = Number(extractDraft);
        if (!Number.isInteger(value) || value < bounds.minExtractMb || value > bounds.maxExtractMb) {
          setMessage({ tone: "error", text: t("settings.invalidExtractMb", { min: bounds.minExtractMb, max: bounds.maxExtractMb }) });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const result = await postConfig({ maxExtractMb: value });
          setExtractDraft(String(result.maxExtractMb));
          setMessage({ tone: "ok", text: t("settings.saved") });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      async function saveEntries() {
        const value = Number(entriesDraft);
        if (!Number.isInteger(value) || value < bounds.minEntries || value > bounds.maxEntries) {
          setMessage({ tone: "error", text: t("settings.invalidExtractEntries", { min: bounds.minEntries, max: bounds.maxEntries }) });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const result = await postConfig({ maxExtractEntries: value });
          setEntriesDraft(String(result.maxExtractEntries));
          setMessage({ tone: "ok", text: t("settings.saved") });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      const rowStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "2px 0", fontSize: "13px" };
      const labelStyle = { color: "inherit" };
      const inputStyle = {
        width: "72px",
        padding: "3px 6px",
        borderRadius: "6px",
        border: "1px solid var(--border-color, rgba(128,128,128,.35))",
        background: "transparent",
        color: "inherit",
        fontSize: "13px",
      };
      const unitStyle = { color: "inherit", opacity: 0.75 };
      const buttonStyle = {
        padding: "3px 12px",
        borderRadius: "6px",
        border: "1px solid var(--border-color, rgba(128,128,128,.35))",
        background: "transparent",
        color: "inherit",
        cursor: busy ? "wait" : "pointer",
        fontSize: "13px",
      };

      return React.createElement(React.Fragment, null,
        React.createElement("div", { style: rowStyle },
          React.createElement("label", { style: labelStyle }, t("settings.uploadLabel")),
          React.createElement("input", {
            type: "number", min: bounds.min, max: bounds.max, step: 1,
            value: draft,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") saveUpload(); },
            disabled: busy, style: inputStyle,
          }),
          React.createElement("span", { style: unitStyle }, t("settings.unitMb")),
          React.createElement("button", { type: "button", onClick: saveUpload, disabled: busy, style: buttonStyle },
            busy ? t("settings.saving") : t("settings.save")),
        ),
        React.createElement("div", { style: rowStyle },
          React.createElement("label", { style: labelStyle }, t("settings.extractLabel")),
          React.createElement("input", {
            type: "number", min: bounds.minExtractMb, max: bounds.maxExtractMb, step: 1,
            value: extractDraft,
            onChange: (event) => setExtractDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") saveExtract(); },
            disabled: busy, style: inputStyle,
          }),
          React.createElement("span", { style: unitStyle }, t("settings.unitMb")),
          React.createElement("input", {
            type: "number", min: bounds.minEntries, max: bounds.maxEntries, step: 1,
            value: entriesDraft,
            onChange: (event) => setEntriesDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") saveEntries(); },
            disabled: busy, style: inputStyle,
          }),
          React.createElement("span", { style: unitStyle }, t("settings.unitEntries")),
          React.createElement("button", { type: "button", onClick: saveEntries, disabled: busy, style: buttonStyle },
            busy ? t("settings.saving") : t("settings.save")),
        ),
        message && React.createElement("div", { style: { padding: "2px 0" } },
          React.createElement("span", { style: { fontSize: "12px", color: message.tone === "error" ? "#e5484d" : "#46a758" } }, message.text)
        )
      );
    }

    /** 输入框 dock 列表：展示本会话已上传的文件（不写入草稿文本）。 */
    function UploadedFilesRow(props) {
      const t = props.t;
      const sessionId = String(props.sessionId ?? "");
      const ownItems = () => uploadStore.getSnapshot().filter((item) => String(item.sessionId ?? "") === sessionId);
      const [items, setItems] = React.useState(ownItems);
      const [error, setError] = React.useState(null);
      React.useEffect(() => uploadStore.subscribe(() => setItems(ownItems())), [sessionId]);
      // 语言切换时重新渲染。
      const [localeRev, setLocaleRev] = React.useState(0);
      React.useEffect(() => {
        if (!props.localeSubscribe) return undefined;
        return props.localeSubscribe(() => setLocaleRev((rev) => rev + 1));
      }, []);
      void localeRev;

      if (!items.length) return null;

      /** 在宿主机上删除单个已上传文件（连同解压出的目录）。 */
      async function removeOne(item) {
        setError(null);
        try {
          const response = await fetch("/agent-hub/file-upload/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: String(item.sessionId ?? ""), path: item.path }),
            cache: "no-store",
          });
          const result = await response.json().catch(() => ({ ok: false, error: t("dock.deleteBadResponse") }));
          if (!response.ok || !result.ok) throw new Error(result.error || t("dock.deleteFailed", { status: response.status }));
          uploadStore.remove(item.path, item.sessionId);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }

      /** 在宿主机上删除本会话全部已上传文件，然后清空列表。 */
      async function removeAll() {
        setError(null);
        const snapshot = uploadStore.getSnapshot();
        const mine = snapshot.filter((item) => String(item.sessionId ?? "") === sessionId);
        let failed = 0;
        for (const item of mine) {
          try {
            const response = await fetch("/agent-hub/file-upload/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: String(item.sessionId ?? ""), path: item.path }),
              cache: "no-store",
            });
            const result = await response.json().catch(() => ({ ok: false }));
            if (!response.ok || !result.ok) failed += 1;
          } catch {
            failed += 1;
          }
        }
        // 只移除本会话的记录；其他会话的上传保持不动。
        for (const item of mine) uploadStore.remove(item.path, item.sessionId);
        if (failed > 0) setError(t("dock.deleteSomeFailed", { count: failed }));
      }

      const chipStyle = {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        maxWidth: "100%",
        padding: "3px 6px 3px 9px",
        borderRadius: "8px",
        border: "1px solid var(--border-color, rgba(128,128,128,.35))",
        background: "var(--color-bg-active, rgba(128,128,128,.12))",
        fontSize: "12px",
        lineHeight: "18px",
        color: "inherit",
      };
      // 文件名在 chip 内部省略号截断；删除按钮始终可见可点
      // （chip 本身不做溢出裁剪）。
      const nameStyle = {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "220px",
        minWidth: "40px",
      };
      const indexStyle = {
        color: "inherit",
        opacity: 0.6,
        fontSize: "11px",
        flexShrink: 0,
      };
      const removeStyle = {
        border: "1px solid var(--border-color, rgba(128,128,128,.4))",
        background: "transparent",
        color: "inherit",
        opacity: 1,
        cursor: "pointer",
        padding: "1px 7px",
        marginLeft: "4px",
        fontSize: "13px",
        lineHeight: "16px",
        borderRadius: "6px",
        flexShrink: 0,
      };
      const tooltip = (item) => {
        if (item.extractErrorCode) {
          const reason = item.extractErrorCode === "ENTRY_LIMIT"
            ? t("zip.errEntryLimit", { limit: item.extractLimit })
            : item.extractErrorCode === "SIZE_LIMIT"
              ? t("zip.errSizeLimit", { limit: item.extractLimit })
              : t("zip.errCorrupt");
          return `${item.path}\n${reason}`;
        }
        return item.kind === "zip" && item.extracted
          ? t("dock.zipTooltip", { path: item.path, dir: item.extracted, count: item.fileCount ?? 0 })
          : t("dock.fileTooltip", { path: item.path });
      };

      // 对齐宿主的对话内容列：dock 插槽与输入框卡片同宽（约 780px），
      // 比消息列（--dsh-chat-content-width，748px）宽；todo/queue dock 都是
      // 自己再减去左右 clearance + inset 来对齐内容列的，这里照做，
      // 否则上传条会视觉上超出对话边界。
      return React.createElement("div", {
        style: {
          boxSizing: "border-box",
          width: "calc(100% - 2 * (var(--dsh-composer-side-clearance, 16px) + 16px))",
          maxWidth: "var(--dsh-chat-content-width, 748px)",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px",
          padding: "2px 0",
          fontSize: "12px",
        },
      },
        React.createElement("span", { style: { color: "inherit", opacity: 0.75, marginRight: "2px" } }, t("dock.label")),
        items.map((item, index) =>
          React.createElement("span", {
            key: item.path,
            title: tooltip(item),
            style: chipStyle,
          },
            React.createElement("span", { style: indexStyle }, `${index + 1}.`),
            React.createElement("span", { style: nameStyle }, item.name),
            item.extractErrorCode && React.createElement("span", { style: { color: "#e5484d", flexShrink: 0 } }, "⚠️"),
            item.bytes > 0 && React.createElement("span", { style: { opacity: 0.7, flexShrink: 0 } }, formatBytes(item.bytes)),
            item.kind === "zip" && React.createElement("span", { style: { opacity: 0.7, flexShrink: 0 } }, t("dock.zipBadge")),
            React.createElement("button", {
              type: "button",
              "aria-label": t("dock.remove", { name: item.name }),
              title: t("dock.remove", { name: item.name }),
              onClick: () => removeOne(item),
              onMouseEnter: (event) => { event.currentTarget.style.background = "rgba(229,72,77,.25)"; event.currentTarget.style.borderColor = "rgba(229,72,77,.6)"; },
              onMouseLeave: (event) => { event.currentTarget.style.background = "transparent"; event.currentTarget.style.borderColor = ""; },
              style: removeStyle,
            }, "✕")
          )
        ),
        React.createElement("button", {
          type: "button",
          onClick: removeAll,
          title: t("dock.clear"),
          onMouseEnter: (event) => { event.currentTarget.style.background = "rgba(229,72,77,.2)"; event.currentTarget.style.opacity = "1"; },
          onMouseLeave: (event) => { event.currentTarget.style.background = "transparent"; event.currentTarget.style.opacity = "0.65"; },
          style: {
            border: "0",
            background: "transparent",
            color: "inherit",
            opacity: 0.65,
            cursor: "pointer",
            padding: "3px 8px",
            fontSize: "12px",
            lineHeight: "16px",
            borderRadius: "6px",
            flexShrink: 0,
          },
        }, t("dock.clear")),
        error && React.createElement("span", { style: { color: "#e5484d", fontSize: "12px" } }, error)
      );
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      // ctx.effect(cb) 立即执行 cb，并把 cb 的返回值作为清理函数保留。
      // 所以必须传 () => register(...)——直接传清理函数本身会立刻执行、
      // 当场注销词典。
      ctx.effect(() => ctx.locale.register(NS, DICTIONARIES));
      // 把语言订阅透传下去，切换语言时组件重新渲染
      // （t() 虽在调用时读取当前语言，但组件必须重渲染才能显示新文案）。
      const localeSubscribe = ctx.locale.subscribe.bind(ctx.locale);

      ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
        name: "conversation.input.left",
        id: "agent-hub-workspace-file-upload",
        order: 35,
        label: t("slot.uploadLabel"),
      }, (props) => React.createElement(UploadButton, Object.assign({}, props, { t, localeSubscribe }))));
      // 已上传文件的 chip 挂在输入框 dock 条带（输入框上方，todo 计划条
      // 与队列条所在的位置），不再挤在按钮行里，保持输入行整洁。
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "agent-hub-workspace-file-uploads",
        order: 10,
      }, (props) => React.createElement(UploadedFilesRow, Object.assign({}, props, { t, localeSubscribe }))));
      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "agent-hub-workspace-file-upload-limit",
        order: 30,
        label: t("slot.uploadLimitLabel"),
      }, (props) => React.createElement(UploadLimitRow, Object.assign({}, props, { t, localeSubscribe }))));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
