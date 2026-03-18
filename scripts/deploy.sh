#!/bin/bash
# 墨韵 AI - 自动部署脚本
# 检测 GitHub 更新并自动部署

PROJECT_DIR="/root/tihuashi"
LOG_FILE="/var/log/moyun-deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

deploy() {
    log "========== 开始自动部署 =========="

    cd "$PROJECT_DIR" || { log "错误: 项目目录不存在"; exit 1; }

    # 获取当前版本
    LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

    # 拉取最新代码
    log "检查 GitHub 更新..."
    git fetch origin 2>/dev/null

    REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

    if [ "$LOCAL" = "$REMOTE" ]; then
        log "代码已是最新 (commit: ${LOCAL:0:7})"
        return 0
    fi

    log "发现新版本!"
    log "  本地: ${LOCAL:0:7}"
    log "  远程: ${REMOTE:0:7}"

    # 拉取更新
    log "拉取更新..."
    git pull origin main 2>/dev/null

    # 检查是否有变更
    CHANGED_FILES=$(git diff --name-only $LOCAL $REMOTE 2>/dev/null)

    if echo "$CHANGED_FILES" | grep -q "backend/"; then
        log "后端代码有更新，重新构建..."
        docker-compose build backend 2>/dev/null || docker-compose build
    fi

    if echo "$CHANGED_FILES" | grep -q "frontend/"; then
        log "前端代码有更新，重新构建..."
        docker-compose build frontend 2>/dev/null || docker-compose build
    fi

    # 重启服务
    log "重启服务..."
    docker-compose down 2>/dev/null || true
    docker-compose up -d

    # 等待服务启动
    sleep 3

    # 检查服务状态
    log "检查服务状态..."
    if docker ps | grep -q "tihuashi-backend"; then
        log "✓ 后端服务运行正常"
    else
        log "✗ 后端服务启动失败"
    fi

    if docker ps | grep -q "tihuashi-frontend"; then
        log "✓ 前端服务运行正常"
    else
        log "✗ 前端服务启动失败"
    fi

    log "========== 部署完成 =========="
}

# 执行部署
deploy
