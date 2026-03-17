#!/bin/bash
# 墨韵 AI 项目 - 每小时自动化任务
# 功能：分析项目改进空间、创建Issue、解决Issue、部署更新

set -e

PROJECT_DIR="/root/tihuashi"
LOG_FILE="/var/log/moyun-hourly.log"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
REPO="wuxixixi/tihuashi"
SERVER="101.34.62.149"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# GitHub API 调用
github_api() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    if [ -z "$GITHUB_TOKEN" ]; then
        log "警告: GITHUB_TOKEN 未设置"
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

# 获取开放的 Issues
get_open_issues() {
    github_api GET "/issues?state=open&labels=auto-task" | jq -r '.[] | "\(.number)|\(.title)"' 2>/dev/null || echo ""
}

# 分析项目改进空间
analyze_improvements() {
    log "=== 分析项目改进空间 ==="

    local suggestions=""

    # 检查后端代码
    if [ -f "$PROJECT_DIR/backend/server.js" ]; then
        # 检查是否有 TODO 注释
        local todos=$(grep -c "TODO\|FIXME\|HACK" "$PROJECT_DIR/backend/server.js" 2>/dev/null || echo "0")
        if [ "$todos" -gt 0 ]; then
            suggestions+="发现 $todos 个待处理的代码注释\n"
        fi

        # 检查错误处理
        local error_handlers=$(grep -c "catch.*error" "$PROJECT_DIR/backend/server.js" 2>/dev/null || echo "0")
        if [ "$error_handlers" -lt 20 ]; then
            suggestions+="错误处理覆盖率可能不足（当前 $error_handlers 处）\n"
        fi
    fi

    # 检查前端代码
    if [ -d "$PROJECT_DIR/frontend/src/components" ]; then
        local component_count=$(find "$PROJECT_DIR/frontend/src/components" -name "*.jsx" | wc -l)
        suggestions+="当前组件数量: $component_count\n"
    fi

    # 检查数据库大小
    if [ -f "$PROJECT_DIR/backend/data/moyun.db" ]; then
        local db_size=$(du -h "$PROJECT_DIR/backend/data/moyun.db" | cut -f1)
        suggestions+="数据库大小: $db_size\n"
    fi

    # 检查日志错误
    local recent_errors=$(docker logs tihuashi-backend --since 1h 2>&1 | grep -ci "error\|exception" 2>/dev/null || echo "0")
    if [ "$recent_errors" -gt 5 ]; then
        suggestions+="过去1小时发现 $recent_errors 条错误日志\n"
    fi

    echo "$suggestions"
}

# 检查服务状态
check_services() {
    log "=== 检查服务状态 ==="

    local issues=0

    # 检查 Docker 容器
    if ! docker ps | grep -q "tihuashi-backend"; then
        log "问题: 后端容器未运行"
        create_issue "🔴 后端服务未运行" "后端 Docker 容器未运行。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["auto-task","bug"]'
        ((issues++))
    fi

    if ! docker ps | grep -q "tihuashi-frontend"; then
        log "问题: 前端容器未运行"
        create_issue "🔴 前端服务未运行" "前端 Docker 容器未运行。\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["auto-task","bug"]'
        ((issues++))
    fi

    # 检查 API 响应
    local api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/models 2>/dev/null || echo "000")
    if [ "$api_status" != "200" ]; then
        log "问题: API 返回异常状态码 ($api_status)"
        create_issue "⚠️ API 服务异常" "API 返回状态码: $api_status\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["auto-task","bug"]'
        ((issues++))
    fi

    log "服务检查完成，发现 $issues 个问题"
    return $issues
}

# 拉取最新代码并部署
deploy_updates() {
    log "=== 拉取更新并部署 ==="

    cd "$PROJECT_DIR"

    # 拉取最新代码
    if git pull origin main 2>/dev/null; then
        log "代码已更新"

        # 检查是否有变更
        if [ -n "$(git diff HEAD@{1} --name-only 2>/dev/null)" ]; then
            log "检测到代码变更，重新构建..."

            # 重新构建并启动
            docker-compose down 2>/dev/null || true
            docker-compose build --no-cache 2>/dev/null || docker-compose build
            docker-compose up -d

            log "部署完成"
        else
            log "无代码变更"
        fi
    else
        log "拉取代码失败"
    fi
}

# 主函数
main() {
    log "========== 开始每小时自动化任务 =========="

    # 1. 检查服务状态
    check_services || true

    # 2. 分析改进空间
    local improvements=$(analyze_improvements)
    if [ -n "$improvements" ]; then
        log "发现改进空间:\n$improvements"

        # 每天只创建一次改进建议（避免重复）
        local today=$(date '+%Y-%m-%d')
        local last_suggestion_file="/tmp/moyun-last-suggestion"

        if [ ! -f "$last_suggestion_file" ] || [ "$(cat $last_suggestion_file)" != "$today" ]; then
            create_issue "💡 项目改进建议 ($today)" "自动化分析发现以下改进空间：\n\n$improvements\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')" '["auto-task","enhancement"]'
            echo "$today" > "$last_suggestion_file"
            log "已创建改进建议 Issue"
        fi
    fi

    # 3. 拉取更新并部署
    deploy_updates

    log "========== 自动化任务完成 =========="
}

main "$@"
