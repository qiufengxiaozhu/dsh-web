#!/usr/bin/env node
/**
 * 图片 OCR（中英文）：node ocr.js <图片路径> [图片路径...]
 *
 * - tesseract.js + 本地 langdata（chi_sim/eng），完全离线，无需运行时下载。
 * - 图片路径来自命令行参数；无参数时打印用法并以退出码 2 结束。
 */
"use strict";

const path = require("path");
const fs = require("fs");
const { createWorker } = require("tesseract.js");

const LANGDATA_DIR = path.join(__dirname, "langdata");

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("用法: node ocr.js <图片路径> [图片路径...]");
    console.error("支持 png/jpg/jpeg/webp/bmp；输出识别文本到 stdout。");
    process.exit(2);
  }
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`文件不存在: ${f}`);
      process.exit(2);
    }
  }

  // langPath 指向本地目录 + gzip 压缩的 traineddata，tesseract.js 不会联网。
  const worker = await createWorker("chi_sim+eng", 1, {
    langPath: LANGDATA_DIR,
    gzip: true,
    cachePath: LANGDATA_DIR,
    logger: () => {},
  });
  try {
    for (const f of files) {
      const { data } = await worker.recognize(f);
      console.log(`===== ${f} =====`);
      console.log(data.text.trim() || "(未识别到文本)");
    }
  } finally {
    await worker.terminate();
  }
}

main().catch((err) => {
  console.error("OCR 失败:", err && err.message ? err.message : err);
  process.exit(1);
});
