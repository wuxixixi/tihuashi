#!/bin/bash
# 心跳机制安装脚本

echo "=========================================="
echo "  墨韵 AI 心跳机制安装"
echo "=========================================="

SCRIPTS_DIR="/root/scripts"
LOG_DIR="/var/log"

mkdir -p "$SCRIPTS_DIR" "$LOG_DIR"

# 复制心跳脚本
cp /root/tihuashi/scripts/heartbeat.sh "$SCRIPTS_DIR/"
chmod +x "$SCRIPTS_DIR/heartbeat.sh"
echo "✓ 心跳脚本已安装"

# 创建环境变量文件
if [ ! -f "$SCRIPTS_DIR/.env" ]; then
    cat > "$SCRIPTS_DIR/.env" << 'EOF'
# GitHub Personal Access Token
# 获取地址: https://github.com/settings/tokens/new
# 需要权限: repo, write:issues
GITHUB_TOKEN=
EOF
    echo "✓ 环境变量文件已创建"
else
    echo "✓ 环境变量文件已存在"
fi

# 配置 cron 任务
cat > /etc/cron.d/moyun-heartbeat << 'CRON_EOF'
# 墨韵 AI 心跳机制
# 每小时执行一次
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

0 * * * * root source /root/scripts/.env && /root/scripts/heartbeat.sh >> /var/log/moyun-heartbeat.log 2>&1
CRON_EOF

chmod 644 /etc/cron.d/moyun-heartbeat
service cron reload 2>/dev/null || systemctl reload cron 2>/dev/null || true
echo "✓ Cron 任务已配置（每小时执行）"

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "重要提示："
echo "1. 编辑 $SCRIPTS_DIR/.env 填入 GitHub Token"
echo "2. 手动测试: source $SCRIPTS_DIR/.env && $SCRIPTS_DIR/heartbeat.sh"
echo "3. 查看日志: tail -f /var/log/moyun-heartbeat.log"
echo ""
echo "心跳功能："
echo "  - 每小时检查服务健康状态"
echo "  - 自动拉取代码更新并部署"
echo "  - 分析代码改进空间并创建 Issue"
echo "  - 检查开放的 Issues"
echo "  - 清理旧日志"
