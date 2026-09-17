#!/usr/bin/env bash
# 每日日志收集推送脚本（部署在【日志产出方】服务器的 /opt/dsh-web/ 下）：
# 打包 luoshu 昨天的 combined / error / java 日志，推送到 dsh-web 服务器
# 的 /opt/dsh-web/demosite-log/，供 dsh 定时任务每日分析并写回分析报告。
#
# 依赖：sshpass（yum install -y sshpass 或 apt install -y sshpass）
# 定时：crontab 每晚 01:00 执行，见 docs/log-collection.md
set -euo pipefail

# ========== 按环境修改的配置 ==========
LOG_ROOT="/opt/zdocs/luoshu_log"        # luoshu 日志根目录（含各节点子目录）
TARGET_HOST="172.16.52.27"              # dsh-web 服务器
TARGET_PORT="22"
TARGET_USER="root"
TARGET_PASS="lenovolabs"
TARGET_DIR="/opt/dsh-web/demosite-log"  # 接收目录（dsh 定时任务从这里取包）
KEEP_DAYS=7                             # 本地历史压缩包保留天数
# =====================================

command -v sshpass >/dev/null || { echo "[collect] 缺少 sshpass，请先安装：yum install -y sshpass" >&2; exit 1; }

# 日期用昨天：当天未结束，日志不完整。文件名匹配用 yyyy-mm-dd（luoshu 日志
# 文件名如 combined-2026-08-24）；压缩包名用紧凑 yyyyymmdd。
DAY_FILE=$(date -d yesterday +%Y-%m-%d)
DAY=$(date -d yesterday +%Y%m%d)
NAME="luoshu-log-${DAY}.tar.gz"
WORKDIR="$(cd "$(dirname "$0")" && pwd)"

log() { echo "[$(date '+%F %T')] $*"; }

cd "$WORKDIR"

log "开始收集 ${DAY_FILE} 日志 -> ${NAME}"

# 打包。glob 由 shell 按绝对路径展开（tar 自动剥离包内前导 /，包内结构为
# opt/zdocs/...）。三类文件任一缺失由 || true 兜底（如当天无 error 日志），
# 只要包非空即认为成功。
# shellcheck disable=SC2086
tar -czf "${NAME}.incoming" \
  ${LOG_ROOT}/*/combined-*${DAY_FILE}* \
  ${LOG_ROOT}/*/error-*${DAY_FILE}* \
  ${LOG_ROOT}/*/java* || true

if [ ! -s "${NAME}.incoming" ]; then
  log "错误：未收集到任何日志（检查 ${LOG_ROOT} 下是否有 ${DAY_FILE} 的 combined/error/java 文件）" >&2
  rm -f "${NAME}.incoming"
  exit 1
fi
mv "${NAME}.incoming" "$NAME"
log "打包完成: $(du -h "$NAME" | cut -f1)"

# 推送：先传远端临时名 .uploading-*，成功后远端原子改名——
# 避免 dsh 端在传输中途读到半个包。
SSH_OPTS="-p ${TARGET_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10"
sshpass -p "$TARGET_PASS" scp $SSH_OPTS "$NAME" \
  "${TARGET_USER}@${TARGET_HOST}:${TARGET_DIR}/.uploading-${NAME}"
sshpass -p "$TARGET_PASS" ssh $SSH_OPTS \
  "${TARGET_USER}@${TARGET_HOST}" "mv ${TARGET_DIR}/.uploading-${NAME} ${TARGET_DIR}/${NAME}"
log "推送完成: ${TARGET_USER}@${TARGET_HOST}:${TARGET_DIR}/${NAME}"

# 清理本地过期压缩包
find "$WORKDIR" -maxdepth 1 -name 'luoshu-log-*.tar.gz' -mtime +"${KEEP_DAYS}" -delete
log "完成（本地保留最近 ${KEEP_DAYS} 天压缩包）"
