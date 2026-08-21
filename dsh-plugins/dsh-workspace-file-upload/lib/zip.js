/**
 * 工作区文件上传插件的极简、零依赖 ZIP 读取器。
 *
 * 支持真实压缩包里占绝大多数的两种标准压缩算法：
 *  - method 0（STORE）：原样拷贝
 *  - method 8（DEFLATE）：node:zlib 的 inflateRawSync
 *
 * 安全特性（防御恶意压缩包）：
 *  - 每个条目名都会规范化，且必须落在解压根目录之内
 *    （拒绝 zip-slip / 绝对路径 / 盘符 / `..` 穿越）
 *  - 解压总字节数与条目数有上限（防 zip 炸弹）
 *  - 加密条目（通用标志位 0）与未知压缩算法的条目会带原因跳过，
 *    而不是让整个压缩包失败
 *  - 符号链接条目（unix mode S_IFLNK）跳过，绝不落地成链接
 *
 * 读取器刻意保持简单：以中央目录作为大小信息的唯一可信来源
 * （能正确处理带数据描述符的压缩包），从各条目的本地头推算数据偏移。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { inflateRawSync } from 'node:zlib'

/**
 * 结构化解压错误。`code` 让客户端能展示友好、本地化的提示，
 * 而不是原始的英文串。
 *   - 'ENTRY_LIMIT'    - 条目数超过配置上限
 *   - 'SIZE_LIMIT'     - 解压总大小超过配置上限
 *   - 'CORRUPT'        - 压缩包结构非法
 */
export class ZipExtractError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ZipExtractError'
    this.code = code
  }
}

/**
 * 上限值：防止恶意或损坏的压缩包耗尽磁盘/内存，同时仍能接受现实中的
 * 压缩包——Windows 离线安装包动辄几万个条目、解压后几百 MB 到几 GB。
 */
export const MAX_EXTRACT_BYTES = 4 * 1024 * 1024 * 1024
export const MAX_EXTRACT_ENTRIES = 100000

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const SIG_EOCD64 = 0x06064b50
const SIG_EOCD64_LOC = 0x07064b50

/** 轻量嗅探：PK\x03\x04（本地头）、PK\x05\x06（空包）、PK\x06\x06 / PK\x06\x07（zip64）。 */
export function isZipBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false
  const magic = buffer.readUInt32LE(0)
  return magic === SIG_LOCAL || magic === SIG_EOCD || magic === SIG_EOCD64 || magic === SIG_EOCD64_LOC
}

/** 从尾部向前扫描中央目录结束记录（最后 64 KiB + 22 字节）。 */
function findEocd(buffer) {
  const start = Math.max(0, buffer.length - 22 - 0xffff)
  for (let i = buffer.length - 22; i >= start; i -= 1) {
    if (buffer.readUInt32LE(i) !== SIG_EOCD) continue
    const commentLength = buffer.readUInt16LE(i + 20)
    if (i + 22 + commentLength === buffer.length) return i
  }
  return -1
}

/** 把单个 zip 条目路径规范化为安全的相对路径，非法则返回 null 拒绝。 */
function safeEntryName(rawName) {
  if (typeof rawName !== 'string' || rawName.length === 0) return null
  if (rawName.includes('\0')) return null
  // 反斜杠也按分隔符处理（Windows 打的压缩包）。
  const parts = rawName.split(/[\\/]/).filter((part) => part !== '' && part !== '.')
  if (parts.length === 0) return null
  for (const part of parts) {
    if (part === '..') return null
    // 盘符 / UNC 根不允许逃出解压根目录。
    if (/^[a-zA-Z]:$/.test(part)) return null
  }
  return parts.join('/')
}

/**
 * 读取 ZIP64 扩展信息 extra 字段。返回部分记录；缺失的字段保持 null。
 * 只读取中央目录条目需要的字段（未压缩大小、压缩后大小、本地头偏移）。
 */
function readZip64Extra(extra, want) {
  let offset = 0
  while (offset + 4 <= extra.length) {
    const id = extra.readUInt16LE(offset)
    const size = extra.readUInt16LE(offset + 2)
    const bodyStart = offset + 4
    const bodyEnd = bodyStart + size
    if (bodyEnd > extra.length) return {}
    if (id === 0x0001) {
      let p = bodyStart
      const result = {}
      if (want.uncompressed && p + 8 <= bodyEnd) {
        result.uncompressed = Number(extra.readBigUInt64LE(p))
        p += 8
      }
      if (want.compressed && p + 8 <= bodyEnd) {
        result.compressed = Number(extra.readBigUInt64LE(p))
        p += 8
      }
      if (want.offset && p + 8 <= bodyEnd) {
        result.offset = Number(extra.readBigUInt64LE(p))
      }
      return result
    }
    offset = bodyEnd
  }
  return {}
}

/**
 * 把 zip 压缩包解压到 `destination`（不存在则创建）。
 *
 * @param {Buffer} buffer   - 整个压缩包的字节。
 * @param {string} destination - 解压根目录的绝对路径（必须已校验位于
 *   工作区之内）。
 * @param {{ maxBytes?: number, maxEntries?: number }} [limits] - 覆盖默认上限。
 * @returns {Promise<{ files: string[], skipped: { name: string, reason: string }[], bytes: number }>}
 * @throws 结构损坏或超过上限时抛出。
 */
export async function extractZip(buffer, destination, limits = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new Error('Empty or invalid ZIP archive.')
  }
  const maxBytes = limits.maxBytes ?? MAX_EXTRACT_BYTES
  const maxEntries = limits.maxEntries ?? MAX_EXTRACT_ENTRIES

  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('Not a ZIP archive: end-of-central-directory record not found.')

  let entryCount = buffer.readUInt16LE(eocd + 10)
  let cdSize = buffer.readUInt32LE(eocd + 12)
  let cdOffset = buffer.readUInt32LE(eocd + 16)

  // ZIP64 回退：32 位字段饱和为 0xffffffff 时启用。
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    if (eocd >= 20 && buffer.readUInt32LE(eocd - 20) === SIG_EOCD64_LOC) {
      const eocd64Offset = Number(buffer.readBigUInt64LE(eocd - 12))
      if (eocd64Offset >= 0 && eocd64Offset + 56 <= buffer.length
        && buffer.readUInt32LE(eocd64Offset) === SIG_EOCD64) {
        entryCount = Number(buffer.readBigUInt64LE(eocd64Offset + 32))
        cdSize = Number(buffer.readBigUInt64LE(eocd64Offset + 40))
        cdOffset = Number(buffer.readBigUInt64LE(eocd64Offset + 48))
      }
    }
  }

  if (!Number.isSafeInteger(cdOffset) || !Number.isSafeInteger(cdSize)
    || cdOffset < 0 || cdSize < 0 || cdOffset + cdSize > buffer.length) {
    throw new Error('ZIP central directory lies outside the archive.')
  }

  const root = resolve(destination)
  const rootBoundary = `${root}${sep}`
  const files = []
  const skipped = []
  let totalBytes = 0
  let cursor = cdOffset

  // 目录创建做了缓存：真实压缩包（安装器、node_modules）含几千个文件
  // 却只有几百个目录，而此前每个文件都要串行付一次递归 mkdir + writeFile。
  const createdDirs = new Set()
  async function ensureDir(dirPath) {
    if (dirPath === root || createdDirs.has(dirPath)) return
    createdDirs.add(dirPath)
    await mkdir(dirPath, { recursive: true })
  }

  // 写入按批聚合、并发落盘（内存有界：批次最多容纳 WRITE_BATCH 个文件
  // 或 WRITE_BATCH_BYTES 字节的解压数据），取代逐条目一次 await writeFile。
  const WRITE_BATCH = 64
  const WRITE_BATCH_BYTES = 8 * 1024 * 1024
  let writeBatch = []
  let writeBatchBytes = 0
  async function flushWrites() {
    if (!writeBatch.length) return
    const jobs = writeBatch
    writeBatch = []
    writeBatchBytes = 0
    await Promise.all(jobs.map(async ({ targetPath, output }) => {
      await ensureDir(dirname(targetPath))
      await writeFile(targetPath, output)
    }))
  }

  for (let index = 0; index < entryCount; index += 1) {
    if (index >= maxEntries) throw new ZipExtractError('ENTRY_LIMIT', `ZIP entry count exceeds the ${maxEntries} limit.`)
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIG_CENTRAL) {
      throw new Error('ZIP central directory is corrupt.')
    }

    const flags = buffer.readUInt16LE(cursor + 8)
    const method = buffer.readUInt16LE(cursor + 10)
    let compressedSize = buffer.readUInt32LE(cursor + 20)
    let uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    let localOffset = buffer.readUInt32LE(cursor + 42)
    const externalAttrs = buffer.readUInt32LE(cursor + 38)

    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength)
    const extra = buffer.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength)
    cursor += 46 + nameLength + extraLength + commentLength

    const z64 = readZip64Extra(extra, {
      uncompressed: uncompressedSize === 0xffffffff,
      compressed: compressedSize === 0xffffffff,
      offset: localOffset === 0xffffffff,
    })
    if (uncompressedSize === 0xffffffff && z64.uncompressed !== undefined) uncompressedSize = z64.uncompressed
    if (compressedSize === 0xffffffff && z64.compressed !== undefined) compressedSize = z64.compressed
    if (localOffset === 0xffffffff && z64.offset !== undefined) localOffset = z64.offset

    // 通用标志位 11 = UTF-8 文件名；否则按 latin-1 解码。
    const rawName = (flags & 0x0800) !== 0
      ? nameBytes.toString('utf8')
      : nameBytes.toString('latin1')
    const safeName = safeEntryName(rawName)

    if (safeName === null) {
      skipped.push({ name: rawName.slice(0, 200), reason: 'unsafe path' })
      continue
    }

    // 目录条目：名字以斜杠结尾。
    if (rawName.endsWith('/') || rawName.endsWith('\\')) {
      await ensureDir(join(root, ...safeName.split('/')))
      continue
    }

    // Unix 符号链接（S_IFLNK = 0xA000）：绝不落地成链接。
    if (((externalAttrs >>> 16) & 0xf000) === 0xa000) {
      skipped.push({ name: safeName, reason: 'symlink' })
      continue
    }
    // 加密条目（通用标志位 0）。
    if ((flags & 0x0001) !== 0) {
      skipped.push({ name: safeName, reason: 'encrypted' })
      continue
    }

    if (!Number.isSafeInteger(localOffset) || localOffset < 0 || localOffset + 30 > buffer.length
      || buffer.readUInt32LE(localOffset) !== SIG_LOCAL) {
      skipped.push({ name: safeName, reason: 'missing local header' })
      continue
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataStart < 0 || dataEnd > buffer.length) {
      skipped.push({ name: safeName, reason: 'entry data out of bounds' })
      continue
    }
    const compressed = buffer.subarray(dataStart, dataEnd)

    let output
    if (method === 0) {
      output = compressed
    } else if (method === 8) {
      try {
        output = inflateRawSync(compressed)
      } catch {
        skipped.push({ name: safeName, reason: 'invalid deflate data' })
        continue
      }
    } else {
      skipped.push({ name: safeName, reason: `unsupported method ${method}` })
      continue
    }

    if (uncompressedSize !== 0 && output.length !== uncompressedSize) {
      skipped.push({ name: safeName, reason: 'size mismatch' })
      continue
    }
    totalBytes += output.length
    if (totalBytes > maxBytes) throw new ZipExtractError('SIZE_LIMIT', `Extracted size exceeds the ${maxBytes} byte limit.`)

    const targetPath = join(root, ...safeName.split('/'))
    if (targetPath !== root && !targetPath.startsWith(rootBoundary)) {
      skipped.push({ name: safeName, reason: 'escapes extraction root' })
      continue
    }
    writeBatch.push({ targetPath, output })
    writeBatchBytes += output.length
    if (writeBatch.length >= WRITE_BATCH || writeBatchBytes >= WRITE_BATCH_BYTES) {
      await flushWrites()
    }
    files.push(safeName)
  }

  await flushWrites()
  return { files, skipped, bytes: totalBytes }
}
