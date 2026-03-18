#!/bin/bash
# 定时任务诊断脚本 - 在服务器上运行
# 用于检查为什么定时任务没有执行

echo "=========================================="
echo "  定时任务诊断报告"
echo "  运行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 检查 cron 服务状态
echo ""
echo "【1. Cron 服务状态】"
if service cron status 2>/dev/null; then
    echo "✓ cron 服务运行中"
elif systemctl status cron 2>/dev/null; then
    echo "✓ cron 服务运行中"
else
    echo "✗ cron 服务未运行！"
    echo "  尝试启动: service cron start 或 systemctl start cron"
fi

# 2. 检查定时任务配置文件
echo ""
echo "【2. 定时任务配置】"
if [ -f /etc/cron.d/moyun-tasks ]; then
    echo "✓ 定时任务文件存在"
    echo "--- 内容 ---"
    cat /etc/cron.d/moyun-tasks
    echo "---"
else
    echo "✗ 定时任务文件不存在: /etc/cron.d/moyun-tasks"
    echo "  需要运行安装脚本配置定时任务"
fi

# 3. 检查脚本是否存在
echo ""
echo "【3. 脚本文件检查】"
SCRIPTS_DIR="/root/scripts"
for script in hourly-task.sh selfcheck.sh deploy.sh; do
    if [ -f "$SCRIPTS_DIR/$script" ]; then
        if [ -x "$SCRIPTS_DIR/$script" ]; then
            echo "✓ $script 存在且可执行"
        else
            echo "⚠ $script 存在但不可执行"
            echo "  修复: chmod +x $SCRIPTS_DIR/$script"
        fi
    else
        echo "✗ $script 不存在"
    fi
done

# 4. 检查项目目录
echo ""
echo "【4. 项目目录检查】"
PROJECT_DIR="/root/tihuashi"
if [ -d "$PROJECT_DIR" ]; then
    echo "✓ 项目目录存在: $PROJECT_DIR"
    cd "$PROJECT_DIR"
    echo "  当前版本: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo "  远程版本: $(git rev-parse --short origin/main 2>/dev/null || echo 'unknown')"
else
    echo "✗ 项目目录不存在: $PROJECT_DIR"
fi

# 5. 检查环境变量文件
echo ""
echo "【5. 环境变量检查】"
ENV_FILE="$SCRIPTS_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo "✓ 环境变量文件存在"
    if grep -q "GITHUB_TOKEN=." "$ENV_FILE" 2>/dev/null; then
        echo "✓ GITHUB_TOKEN 已配置"
    else
        echo "⚠ GITHUB_TOKEN 未配置"
    fi
else
    echo "✗ 环境变量文件不存在: $ENV_FILE"
fi

# 6. 检查日志文件
echo ""
echo "【6. 日志文件检查】"
for log in /var/log/moyun-hourly.log /var/log/tihuashi-selfcheck.log /var/log/moyun-deploy.log; do
    if [ -f "$log" ]; then
        echo "✓ $log 存在"
        echo "  最后更新: $(stat -c %y "$log" 2>/dev/null | cut -d. -f1)"
        echo "  最新内容:"
        tail -3 "$log" 2>/dev/null | sed 's/^/    /'
    else
        echo "✗ $log 不存在"
    fi
done

# 7. 检查 Docker 服务
echo ""
echo "【7. Docker 服务检查】"
if docker ps 2>/dev/null | grep -q tihuashi; then
    echo "✓ 墨韵容器运行中"
    docker ps | grep tihuashi
else
    echo "✗ 墨韵容器未运行"
fi

# 8. 检查 cron 执行权限
echo ""
echo "【8. Cron 执行权限检查】"
if [ -f /etc/cron.d/moyun-tasks ]; then
    perms=$(stat -c %a /etc/cron.d/moyun-tasks)
    if [ "$perms" = "644" ]; then
        echo "✓ 定时任务文件权限正确: $perms"
    else
        echo "⚠ 定时任务文件权限可能不正确: $perms (应为 644)"
        echo "  修复: chmod 644 /etc/cron.d/moyun-tasks"
    fi
fi

# 9. 手动测试定时任务
echo ""
echo "【9. 手动测试建议】"
echo "如果定时任务配置正确但未执行，请手动测试："
echo ""
echo "  # 测试每小时任务"
echo "  source $SCRIPTS_DIR/.env && $SCRIPTS_DIR/hourly-task.sh"
echo ""
echo "  # 测试自检任务"
echo "  source $SCRIPTS_DIR/.env && $SCRIPTS_DIR/selfcheck.sh"
echo ""

# 10. 常见问题
echo ""
echo "【10. 常见问题排查】"
echo "1. cron 服务未运行 -> 启动: service cron start"
echo "2. 脚本不可执行 -> 修复: chmod +x /root/scripts/*.sh"
echo "3. 环境变量未加载 -> 确保 .env 文件存在且 GITHUB_TOKEN 已设置"
echo "4. 文件权限错误 -> 检查 /etc/cron.d/moyun-tasks 权限为 644"
echo "5. 路径错误 -> 确保脚本中的路径正确"
echo ""
echo "=========================================="
echo "  诊断完成"
echo "=========================================="
