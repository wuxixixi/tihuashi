#!/usr/bin/env bash
set -euo pipefail

# Local Deploy Helper
# 功能：提交改动、将仓库 push 到 GitHub、（可选）生成 SSH key、使用 gh CLI 设置 GitHub Actions Secrets、并触发 ssh-deploy.yml 工作流
# 依赖：git, gh (GitHub CLI), ssh, ssh-keygen

DEFAULT_REPO="wuxixixi/tihuashi"
DEFAULT_REMOTE_URL="git@github.com:${DEFAULT_REPO}.git"
DEFAULT_BRANCH="main"
DEFAULT_SSH_HOST="101.34.62.149"
DEFAULT_SSH_USER="deploy"
DEFAULT_SSH_PORT="22"
DEFAULT_DEPLOY_DIR="/home/deploy/tihuashi"
DEFAULT_KEY_PATH="$HOME/.ssh/deploy_key"

echo "Local Deploy Helper"
echo "此脚本会：commit + push、可选生成 SSH key、使用 gh CLI 设置 Secrets、触发 GitHub Actions 部署工作流。"

for cmd in git gh ssh; do
  if ! command -v "$cmd" > /dev/null 2>&1; then
    echo "ERROR: 需要安装 '$cmd'，先安装再运行此脚本。"
    exit 1
  fi
done

read -p "Repo (owner/repo) [${DEFAULT_REPO}]: " REPO
REPO=${REPO:-$DEFAULT_REPO}
read -p "Remote URL [${DEFAULT_REMOTE_URL}]: " REMOTE_URL
REMOTE_URL=${REMOTE_URL:-$DEFAULT_REMOTE_URL}
read -p "Branch [${DEFAULT_BRANCH}]: " BRANCH
BRANCH=${BRANCH:-$DEFAULT_BRANCH}

read -p "Commit message [Audit: deploy changes]: " CM
CM=${CM:-"Audit: deploy changes"}

# stage & commit
git add .
if git diff --cached --quiet; then
  echo "No staged changes. Nothing to commit."
else
  git commit -m "$CM"
fi

# ensure branch
git checkout -B "$BRANCH"

# ensure remote
if git remote get-url origin > /dev/null 2>&1; then
  echo "origin exists"
else
  git remote add origin "$REMOTE_URL"
fi

echo "Pushing to origin/$BRANCH..."
git push -u origin "$BRANCH"

# SSH key
read -p "Use existing SSH private key? (y/n) [y]: " usekey
usekey=${usekey:-y}
if [ "$usekey" != "y" ]; then
  echo "Generating ed25519 key at ${DEFAULT_KEY_PATH} (no passphrase)..."
  mkdir -p "$(dirname "$DEFAULT_KEY_PATH")"
  ssh-keygen -t ed25519 -f "$DEFAULT_KEY_PATH" -N "" -C "github-actions-deploy"
  echo "Created key: ${DEFAULT_KEY_PATH} and ${DEFAULT_KEY_PATH}.pub"
fi

read -p "Private key path [${DEFAULT_KEY_PATH}]: " KEY_PATH
KEY_PATH=${KEY_PATH:-$DEFAULT_KEY_PATH}

# ensure gh auth
if ! gh auth status --hostname github.com > /dev/null 2>&1; then
  echo "gh CLI 未认证，请执行 'gh auth login' 并完成认证。"
  gh auth login
fi

# set secrets
echo "Setting repository secrets with gh CLI for repo ${REPO}..."
gh secret set SSH_PRIVATE_KEY --body "$(cat "$KEY_PATH")" --repo "$REPO"
gh secret set SSH_HOST --body "${DEFAULT_SSH_HOST}" --repo "$REPO"
gh secret set SSH_USERNAME --body "${DEFAULT_SSH_USER}" --repo "$REPO"
gh secret set SSH_PORT --body "${DEFAULT_SSH_PORT}" --repo "$REPO"
gh secret set DEPLOY_DIR --body "${DEFAULT_DEPLOY_DIR}" --repo "$REPO"

echo "Secrets 已设置。接下来把公钥复制到服务器 authorized_keys："
echo "  ssh-copy-id -i ${KEY_PATH}.pub ${DEFAULT_SSH_USER}@${DEFAULT_SSH_HOST}"
echo "或手动："
echo "  scp ${KEY_PATH}.pub ${DEFAULT_SSH_USER}@${DEFAULT_SSH_HOST}:~/deploy_key.pub"
echo "  ssh ${DEFAULT_SSH_USER}@${DEFAULT_SSH_HOST} 'mkdir -p ~/.ssh && cat ~/deploy_key.pub >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && rm ~/deploy_key.pub'"

read -p "现在触发 workflow 吗？ (y/n) [y]: " trig
trig=${trig:-y}
if [ "$trig" = "y" ]; then
  echo "Triggering ssh-deploy.yml workflow..."
  gh workflow run ssh-deploy.yml --repo "$REPO" --ref "$BRANCH"
  echo "已派发 workflow，查看 https://github.com/${REPO}/actions 。"
else
  echo "跳过触发。可在 GitHub Actions 页面手动触发或 push 到 main。"
fi

echo "完成。"