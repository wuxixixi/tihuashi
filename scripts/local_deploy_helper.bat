@echo off
REM Windows: 本地部署助手（显示要运行的命令并做简单检查）
echo Local Deploy Helper (Windows)
echo 请先在本地安装 git 与 GitHub CLI (gh)，并通过 gh auth login 认证。
echo 1) 提交并 push:
echo    git add .
echo    git commit -m "Audit: deploy changes"
echo    git push origin main
echo.
echo 2) 生成 SSH key (若尚未生成):
echo    ssh-keygen -t ed25519 -f %%USERPROFILE%%\.ssh\deploy_key -N ""
echo.
echo 3) 将公钥上传到服务器 (示例):
echo    scp %%USERPROFILE%%\.ssh\deploy_key.pub deploy@101.34.62.149:~/deploy_key.pub
echo    ssh deploy@101.34.62.149 "mkdir -p ~/.ssh && cat ~/deploy_key.pub >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && rm ~/deploy_key.pub"
echo.
echo 4) 在 GitHub 添加 Secrets（使用 gh CLI 或网页）:
echo    gh secret set SSH_PRIVATE_KEY --body "type %%USERPROFILE%%\.ssh\deploy_key" --repo wuxixixi/tihuashi
echo    gh secret set SSH_HOST --body "101.34.62.149" --repo wuxixixi/tihuashi
echo    gh secret set SSH_USERNAME --body "deploy" --repo wuxixixi/tihuashi
echo    gh secret set SSH_PORT --body "22" --repo wuxixixi/tihuashi
echo    gh secret set DEPLOY_DIR --body "/home/deploy/tihuashi" --repo wuxixixi/tihuashi
echo.
echo 5) 在 GitHub Actions 页面手动触发 "SSH Deploy to Tencent Server" 工作流，或 push 到 main。
echo.
echo 注意：请立即在 GitHub 上撤销在聊天中泄露的任何 PAT。不要在聊天中贴私钥或 token。