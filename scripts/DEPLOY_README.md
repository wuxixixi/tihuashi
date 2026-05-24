自动部署说明（概览）

1) 准备服务器（在服务器上运行或按说明手动安装）：
   - 安装 Docker & docker-compose
   - 创建 deploy 用户并安装公钥（参考 scripts/prepare_server.sh）
   - 确保服务器可以访问 GitHub（如果仓库为私有，需要在服务器上配置 git 的凭据或使用 deploy key）

2) 在 GitHub 仓库中设置 Secrets：SSH_HOST、SSH_USERNAME、SSH_PORT、DEPLOY_DIR、SSH_PRIVATE_KEY

3) 将代码推到 main 分支，Actions 会自动构建并通过 SSH 在目标服务器执行拉取/重启流程

4) 若要手动在服务器部署：将脚本 server_deploy.sh 放到服务器并运行：
   sudo bash server_deploy.sh <commit-ish>

安全建议：
- 立即撤销在对话中泄露的任何令牌/密钥，并使用安全渠道管理凭据。
- 在生产环境使用仅具备最小权限的部署账号。