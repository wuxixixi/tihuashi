#!/bin/bash
# 墨韵 AI - 心跳机制脚本
# 每小时运行，持续开发和运维

PROJECT_DIR="/root/tihuashi"
LOG_FILE="/var/log/moyun-heartbeat.log"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
REPO="wuxixixi/tihuashi"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [心跳] $1" | tee -a "$LOG_FILE"
}

# GitHub API 调用
github_api() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    if [ -z "$GITHUB_TOKEN" ]; then
        return 1
    fi

    if [ "$method" = "GET" ]; then
        curl -s -X GET \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/$REPO$endpoint"
    else
        curl -s -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/$REPO$endpoint" \
            -d "$data"
    fi
}

# 创建 Issue
create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"
    github_api POST "/issues" "{\"title\":\"$title\",\"body\":\"$body\",\"labels\":$labels}"
}

# 1. 检查服务健康状态
check_health() {
    log "=== 1. 检查服务健康状态 ==="
    local issues=0

    # 检查 Docker 容器
    if ! docker ps | grep -q "tihuashi-backend"; then
        log "⚠️ 后端容器未运行"
        create_issue "🔴 后端服务未运行" "后端 Docker 容器未运行。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n\n请检查服务器状态。" '["heartbeat","bug"]'
        ((issues++))
    else
        log "✓ 后端容器运行正常"
    fi

    if ! docker ps | grep -q "tihuashi-frontend"; then
        log "⚠️ 前端容器未运行"
        create_issue "🔴 前端服务未运行" "前端 Docker 容器未运行。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["heartbeat","bug"]'
        ((issues++))
    else
        log "✓ 前端容器运行正常"
    fi

    # 检查 API 响应
    local api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/models 2>/dev/null || echo "000")
    if [ "$api_status" != "200" ]; then
        log "⚠️ API 返回异常状态码: $api_status"
        create_issue "⚠️ API 服务异常" "API 返回状态码: $api_status\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["heartbeat","bug"]'
        ((issues++))
    else
        log "✓ API 响应正常"
    fi

    # 检查磁盘空间
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$disk_usage" -gt 85 ]; then
        log "⚠️ 磁盘使用率过高: $disk_usage%"
        create_issue "⚠️ 磁盘空间不足" "磁盘使用率: $disk_usage%\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["heartbeat","maintenance"]'
        ((issues++))
    else
        log "✓ 磁盘空间充足 ($disk_usage%)"
    fi

    return $issues
}

# 2. 拉取最新代码并部署
deploy_updates() {
    log "=== 2. 拉取最新代码 ==="

    cd "$PROJECT_DIR" || { log "错误: 项目目录不存在"; return 1; }

    git fetch origin 2>/dev/null
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)

    if [ "$LOCAL" = "$REMOTE" ]; then
        log "✓ 代码已是最新 (${LOCAL:0:7})"
        return 0
    fi

    log "发现新版本! 本地: ${LOCAL:0:7} -> 远程: ${REMOTE:0:7}"

    # 拉取更新
    if git pull origin main 2>/dev/null; then
        log "✓ 代码已更新"

        # 检查变更
        CHANGED=$(git diff --name-only $LOCAL $REMOTE 2>/dev/null)

        if echo "$CHANGED" | grep -q "backend/"; then
            log "后端代码有变更，重新构建..."
            docker-compose build backend 2>/dev/null || docker-compose build
        fi

        if echo "$CHANGED" | grep -q "frontend/"; then
            log "前端代码有变更，重新构建..."
            docker-compose build frontend 2>/dev/null || docker-compose build
        fi

        # 重启服务
        log "重启服务..."
        docker-compose down 2>/dev/null || true
        docker-compose up -d

        log "✓ 部署完成"
    else
        log "✗ 拉取代码失败"
        return 1
    fi
}

# 3. 分析代码改进空间
analyze_improvements() {
    log "=== 3. 分析代码改进空间 ==="

    local suggestions=""

    # 检查 TODO 注释
    local todos=$(grep -r "TODO\|FIXME\|HACK\|XXX" "$PROJECT_DIR/backend" --include="*.js" 2>/dev/null | wc -l || echo "0")
    if [ "$todos" -gt 0 ]; then
        log "发现 $todos 个待处理注释"
        suggestions+="- 发现 $todos 个 TODO/FIXME 注释待处理\n"
    fi

    # 检查错误日志
    local errors=$(docker logs tihuashi-backend --since 1h 2>&1 | grep -ci "error\|exception" 2>/dev/null || echo "0")
    if [ "$errors" -gt 5 ]; then
        log "发现 $errors 条错误日志"
        suggestions+="- 过去1小时有 $errors 条错误日志\n"
    fi

    # 检查数据库大小
    if [ -f "$PROJECT_DIR/backend/data/moyun.db" ]; then
        local db_size=$(du -m "$PROJECT_DIR/backend/data/moyun.db" | cut -f1)
        if [ "$db_size" -gt 100 ]; then
            log "数据库较大: ${db_size}MB"
            suggestions+="- 数据库大小: ${db_size}MB，建议定期清理\n"
        fi
    fi

    # 每天只创建一次改进建议
    local today=$(date '+%Y-%m-%d')
    local last_file="/tmp/moyun-last-suggestion"

    if [ -n "$suggestions" ] && [ ! -f "$last_file" -o "$(cat $last_file 2>/dev/null)" != "$today" ]; then
        create_issue "💡 项目改进建议 ($today)" "自动化分析发现以下改进空间：\n\n$suggestions\n\n---\n由心跳机制自动检测" '["heartbeat","enhancement"]'
        echo "$today" > "$last_file"
        log "已创建改进建议 Issue"
    fi
}

# 4. 检查开放 Issues
check_issues() {
    log "=== 4. 检查开放 Issues ==="

    local issues=$(github_api GET "/issues?state=open&labels=heartbeat" | jq -r '.[] | "\(.number)|\(.title)"' 2>/dev/null || echo "")

    if [ -n "$issues" ]; then
        log "当前开放的 heartbeat Issues:"
        echo "$issues" | while read line; do
            log "  #$line"
        done
    else
        log "✓ 没有待处理的 heartbeat Issues"
    fi
}

# 5. 清理旧日志
cleanup_logs() {
    log "=== 5. 清理旧日志 ==="

    # 清理7天前的日志
    find /var/log -name "moyun-*.log" -mtime +7 -delete 2>/dev/null
    find /tmp -name "moyun-*.log" -mtime +7 -delete 2>/dev/null

    log "✓ 旧日志已清理"
}

# 主函数
main() {
    log "=========================================="
    log "  墨韵 AI 心跳机制启动"
    log "=========================================="

    local total_issues=0

    check_health || ((total_issues++))
    deploy_updates
    analyze_improvements
    check_issues
    cleanup_logs

    log "=========================================="
    log "  心跳完成，发现 $total_issues 个问题"
    log "=========================================="

    # 如果一切正常，创建健康报告
    if [ $total_issues -eq 0 ]; then
        # 每天只创建一次健康报告
        local today=$(date '+%Y-%m-%d')
        local health_file="/tmp/moyun-last-health"

        if [ ! -f "$health_file" -o "$(cat $health_file 2>/dev/null)" != "$today" ]; then
            create_issue "✅ 每日健康检查通过 ($today)" "所有系统运行正常！\n\n检查项目:\n- ✓ Docker 容器状态\n- ✓ API 健康状态\n- ✓ 磁盘空间\n- ✓ 代码更新\n- ✓ 日志清理\n\n---\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["heartbeat"]'
            echo "$today" > "$health_file"
        fi
    fi
}

main "$@"
