将本地仓库推送到 GitHub（使用 SSH，推荐）

1) 在本地先把变更提交：
   git add .
   git commit -m "Audit: fix conflicts, add deploy workflow & scripts"

2) 配置远程（使用 SSH，确保你本地的 SSH key 已在 GitHub 账户中注册）：
   git remote add origin git@github.com:wuxixixi/tihuashi.git
   git branch -M main
   git push -u origin main

如果你必须使用 HTTPS（不推荐在命令行中直接写入 PAT）：
   git remote add origin https://github.com/wuxixixi/tihuashi.git
   # 使用 git push 时会提示用户名/密码，或者先运行 gh auth login

注意：不要在命令行中粘贴你的 PAT。若你此前已在对话中贴出 PAT，请立即在 GitHub 上撤销并重新创建。

3) 在 GitHub 仓库页面 -> Settings -> Secrets and variables -> Actions，添加前述 SSH_PRIVATE_KEY 等 secrets。

4) 在 GitHub 上确认 Actions -> ssh-deploy 工作流存在，并手动触发（或 push 到 main）进行部署。
