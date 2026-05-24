如何在 GitHub 仓库中添加 Secrets（强烈阅读并遵循）

说明：不会在对话中使用或存储任何密钥/令牌。请立即撤销你在对话中贴出的任何个人访问令牌（PAT），并通过 GitHub 网站恢复/删除该令牌。

建议的部署方式：使用 SSH key（更安全），并在 GitHub 仓库的 Settings -> Secrets and variables -> Actions 中添加以下 Secrets：

- SSH_HOST: 101.34.62.149
- SSH_USERNAME: (例如 "deploy" 或 "root")
- SSH_PORT: 22
- DEPLOY_DIR: /home/deploy/tihuashi
- SSH_PRIVATE_KEY: （部署私钥的完整内容）

如何生成并安装 SSH 密钥对：
1. 在本地机器（或 CI 管理机器）生成密钥对：
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./deploy_key
   # 产生 deploy_key (私钥) 与 deploy_key.pub (公钥)

2. 将公钥拷贝到服务器上（作为 deploy 用户的 authorized_keys）：
   ssh-copy-id -i ./deploy_key.pub deploy@101.34.62.149
   # 或手动追加到 /home/deploy/.ssh/authorized_keys 并设置权限 chmod 600

3. 将私钥 deploy_key 的内容复制到 GitHub 仓库 Secrets -> Actions -> New repository secret 名称为 SSH_PRIVATE_KEY（注意不要泄露私钥）。

4. 在 Secrets 中添加其它变量：SSH_HOST、SSH_USERNAME、SSH_PORT、DEPLOY_DIR。

重要安全通知：
- 绝对不要在聊天中粘贴私人令牌或私钥。已贴出的 GitHub PAT 请立即在 GitHub 网站上撤销（Settings -> Developer settings -> Personal access tokens），并重新创建更安全的凭据。
- 在部署后，考虑在服务器上为部署创建专用非 root 用户（例如 deploy），并使用受限权限运行服务。
