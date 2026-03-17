#!/bin/bash
# 墨韵 AI 自检系统 - 服务器端安装脚本
# 使用方法: curl -fsSL https://raw.githubusercontent.com/wuxixixi/tihuashi/main/scripts/setup-selfcheck.sh | bash
# 或者直接在服务器上运行此脚本

set -e

REPO_DIR="/root/tihuashi"
SCRIPTS_DIR="/root/scripts"
LOG_DIR="/var/log"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

echo "=========================================="
echo "  墨韵 AI 自检系统安装"
echo "=========================================="

# 创建目录
mkdir -p "$SCRIPTS_DIR" "$LOG_DIR"

# 创建自检脚本
cat > "$SCRIPTS_DIR/selfcheck.sh" << 'SCRIPT_EOF'
#!/bin/bash
# 墨韵 AI 项目自检脚本
# 每日运行，检查项目健康状态并创建 GitHub Issues

REPO="wuxixixi/tihuashi"
PROJECT_DIR="/root/tihuashi"
LOG_FILE="/var/log/tihuashi-selfcheck.log"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"

    if [ -z "$GITHUB_TOKEN" ]; then
        log "警告: GITHUB_TOKEN 未设置，无法创建 Issue"
        return 1
    fi

    curl -s -X POST \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/$REPO/issues" \
        -d "{\"title\":\"$title\",\"body\":\"$body\",\"labels\":[\"$labels\"]}"
}

check_docker() {
    log "检查 Docker 容器状态..."
    local issues=0

    cd "$PROJECT_DIR" || return

    if ! docker ps | grep -q "tihuashi-backend"; then
        log "问题: 后端容器未运行"
        create_issue "🔴 后端服务未运行" "后端 Docker 容器未运行。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,bug"
        ((issues++))
    fi

    if ! docker ps | grep -q "tihuashi-frontend"; then
        log "问题: 前端容器未运行"
        create_issue "🔴 前端服务未运行" "前端 Docker 容器未运行。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,bug"
        ((issues++))
    fi

    log "Docker 检查完成，发现 $issues 个问题"
    return $issues
}

check_disk() {
    log "检查磁盘空间..."
    local issues=0

    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$disk_usage" -gt 80 ]; then
        log "问题: 磁盘使用率过高 ($disk_usage%)"
        create_issue "⚠️ 磁盘空间不足" "磁盘使用率: $disk_usage%\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,maintenance"
        ((issues++))
    fi

    log "磁盘检查完成"
    return $issues
}

check_api() {
    log "检查 API 健康状态..."
    local issues=0

    local api_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/models 2>/dev/null)
    if [ "$api_response" != "200" ]; then
        log "问题: API 返回异常 ($api_response)"
        create_issue "🔴 API 服务异常" "API 状态码: $api_response\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,bug"
        ((issues++))
    fi

    local frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    if [ "$frontend_response" != "200" ]; then
        log "问题: 前端返回异常 ($frontend_response)"
        create_issue "🔴 前端服务异常" "前端状态码: $frontend_response\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,bug"
        ((issues++))
    fi

    log "API 检查完成"
    return $issues
}

check_database() {
    log "检查数据库..."
    local issues=0

    if [ ! -f "$PROJECT_DIR/backend/data/moyun.db" ]; then
        log "问题: 数据库文件不存在"
        create_issue "🔴 数据库文件缺失" "数据库文件不存在。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,critical"
        ((issues++))
    fi

    log "数据库检查完成"
    return $issues
}

check_logs() {
    log "检查日志错误..."
    local issues=0

    local error_count=$(docker logs tihuashi-backend --since 24h 2>&1 | grep -ci "error\|exception\|failed" || echo "0")
    if [ "$error_count" -gt 10 ]; then
        log "问题: 日志中发现大量错误 ($error_count 条)"
        create_issue "⚠️ 后端存在错误日志" "24小时内错误: $error_count 条\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check,bug"
        ((issues++))
    fi

    log "日志检查完成"
    return $issues
}

main() {
    log "========== 开始每日自检 =========="
    local total_issues=0

    check_docker || ((total_issues++))
    check_disk || ((total_issues++))
    check_api || ((total_issues++))
    check_database || ((total_issues++))
    check_logs || ((total_issues++))

    log "========== 自检完成，发现 $total_issues 个问题 =========="

    if [ $total_issues -eq 0 ]; then
        create_issue "✅ 每日健康检查通过" "所有检查项正常。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check"
    fi
}

main "$@"
SCRIPT_EOF

chmod +x "$SCRIPTS_DIR/selfcheck.sh"
echo "✓ 自检脚本已创建"

# 创建环境变量文件
cat > "$SCRIPTS_DIR/.env" << 'ENV_EOF'
# GitHub Personal Access Token
# 请填入您的 GitHub Token（需要 repo 和 write:issues 权限）
# 获取方式: https://github.com/settings/tokens/new
GITHUB_TOKEN=
ENV_EOF

echo "✓ 环境配置文件已创建: $SCRIPTS_DIR/.env"

# 设置 cron 任务
cat > /etc/cron.d/tihuashi-selfcheck << 'CRON_EOF'
# 墨韵 AI 每日自检任务
# 每天早上 8:00 执行
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

0 8 * * * root source /root/scripts/.env && /root/scripts/selfcheck.sh >> /var/log/tihuashi-selfcheck.log 2>&1
CRON_EOF

chmod 644 /etc/cron.d/tihuashi-selfcheck

# 重载 cron
service cron reload 2>/dev/null || systemctl reload cron 2>/dev/null || true

echo "✓ Cron 任务已设置（每天 8:00 执行）"

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "重要提示："
echo "1. 请编辑 /root/scripts/.env 文件"
echo "2. 填入您的 GitHub Personal Access Token"
echo "   获取地址: https://github.com/settings/tokens/new"
echo "   需要权限: repo, write:issues"
echo ""
echo "手动测试命令："
echo "  source /root/scripts/.env"
echo "  /root/scripts/selfcheck.sh"
echo ""
echo "查看日志："
echo "  tail -f /var/log/tihuashi-selfcheck.log"
