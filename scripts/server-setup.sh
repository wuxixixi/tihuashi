#!/bin/bash
# 墨韵 AI 项目 - 服务器端完整安装脚本
# 包含：项目部署、自检系统、定时任务配置

set -e

PROJECT_DIR="/root/tihuashi"
SCRIPTS_DIR="/root/scripts"
LOG_DIR="/var/log"

echo "=========================================="
echo "  墨韵 AI 服务器完整配置"
echo "=========================================="

# 1. 创建目录
mkdir -p "$SCRIPTS_DIR" "$LOG_DIR"

# 2. 克隆或更新项目
if [ -d "$PROJECT_DIR" ]; then
    echo "更新项目代码..."
    cd "$PROJECT_DIR"
    git pull origin main || echo "拉取失败，继续..."
else
    echo "克隆项目..."
    git clone https://github.com/wuxixixi/tihuashi.git "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# 3. 配置环境变量
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    echo "创建环境变量文件..."
    cat > "$PROJECT_DIR/backend/.env" << 'ENVEOF'
# API 配置
DMX_API_KEY=your_api_key_here
DMX_BASE_URL=https://www.dmxapi.cn/v1
DMX_MODEL=gpt-4o
VISION_MODEL=gpt-4o

# 服务端口
PORT=3001
ENVEOF
    echo "请编辑 $PROJECT_DIR/backend/.env 填入 API Key"
fi

# 4. 创建自检脚本
cat > "$SCRIPTS_DIR/selfcheck.sh" << 'SELFCHECK_EOF'
#!/bin/bash
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
        log "警告: GITHUB_TOKEN 未设置"
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
    log "检查 Docker 容器..."
    local issues=0
    cd "$PROJECT_DIR" || return
    if ! docker ps | grep -q "tihuashi-backend"; then
        log "问题: 后端容器未运行"
        create_issue "🔴 后端服务未运行" "时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check"
        ((issues++))
    fi
    if ! docker ps | grep -q "tihuashi-frontend"; then
        log "问题: 前端容器未运行"
        create_issue "🔴 前端服务未运行" "时间: $(date '+%Y-%m-%d %H:%M:%S')" "self-check"
        ((issues++))
    fi
    return $issues
}

check_api() {
    log "检查 API..."
    local api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/models 2>/dev/null || echo "000")
    if [ "$api_status" != "200" ]; then
        log "问题: API 状态码 $api_status"
        create_issue "⚠️ API 异常" "状态码: $api_status" "self-check"
        return 1
    fi
    return 0
}

main() {
    log "========== 开始自检 =========="
    local total=0
    check_docker || ((total++))
    check_api || ((total++))
    log "========== 自检完成，发现 $total 个问题 =========="
}
main "$@"
SELFCHECK_EOF
chmod +x "$SCRIPTS_DIR/selfcheck.sh"
echo "✓ 自检脚本已创建"

# 5. 创建每小时任务脚本
cat > "$SCRIPTS_DIR/hourly-task.sh" << 'HOURLY_EOF'
#!/bin/bash
PROJECT_DIR="/root/tihuashi"
LOG_FILE="/var/log/moyun-hourly.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查服务
check_services() {
    local issues=0
    if ! docker ps | grep -q "tihuashi-backend"; then
        log "后端未运行，尝试重启..."
        cd "$PROJECT_DIR" && docker-compose up -d
        ((issues++))
    fi
    if ! docker ps | grep -q "tihuashi-frontend"; then
        log "前端未运行，尝试重启..."
        cd "$PROJECT_DIR" && docker-compose up -d
        ((issues++))
    fi
    return $issues
}

# 拉取更新
deploy_updates() {
    cd "$PROJECT_DIR"
    local before=$(git rev-parse HEAD)
    git pull origin main 2>/dev/null || true
    local after=$(git rev-parse HEAD)
    if [ "$before" != "$after" ]; then
        log "检测到更新，重新部署..."
        docker-compose down 2>/dev/null || true
        docker-compose build --no-cache 2>/dev/null || docker-compose build
        docker-compose up -d
        log "部署完成"
    fi
}

main() {
    log "========== 开始每小时任务 =========="
    check_services || true
    deploy_updates
    log "========== 任务完成 =========="
}
main "$@"
HOURLY_EOF
chmod +x "$SCRIPTS_DIR/hourly-task.sh"
echo "✓ 每小时任务脚本已创建"

# 6. 创建环境变量文件
cat > "$SCRIPTS_DIR/.env" << 'ENV_EOF'
# GitHub Personal Access Token
# 获取地址: https://github.com/settings/tokens/new
# 需要权限: repo, write:issues
GITHUB_TOKEN=
ENV_EOF
echo "✓ 环境变量文件已创建: $SCRIPTS_DIR/.env"

# 7. 配置 Docker 并启动服务
cd "$PROJECT_DIR"
echo "构建并启动 Docker 服务..."
docker-compose build 2>/dev/null || docker-compose build --no-cache
docker-compose up -d
echo "✓ Docker 服务已启动"

# 8. 配置 cron 定时任务
echo "配置定时任务..."
cat > /etc/cron.d/moyun-tasks << 'CRON_EOF'
# 墨韵 AI 定时任务
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# 每小时执行：检查服务、拉取更新、部署
0 * * * * root source /root/scripts/.env && /root/scripts/hourly-task.sh >> /var/log/moyun-hourly.log 2>&1

# 每天早上8点执行：自检并创建 Issue
0 8 * * * root source /root/scripts/.env && /root/scripts/selfcheck.sh >> /var/log/tihuashi-selfcheck.log 2>&1
CRON_EOF
chmod 644 /etc/cron.d/moyun-tasks
service cron reload 2>/dev/null || systemctl reload cron 2>/dev/null || true
echo "✓ 定时任务已配置"

# 9. 显示状态
echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "服务状态："
docker ps | grep tihuashi || echo "服务未运行"
echo ""
echo "重要提示："
echo "1. 编辑 $PROJECT_DIR/backend/.env 填入 API Key"
echo "2. 编辑 $SCRIPTS_DIR/.env 填入 GitHub Token"
echo "3. 查看日志："
echo "   tail -f /var/log/moyun-hourly.log"
echo "   tail -f /var/log/tihuashi-selfcheck.log"
echo ""
echo "定时任务："
echo "   - 每小时：检查服务、拉取更新、自动部署"
echo "   - 每天8点：自检并创建 GitHub Issue"
