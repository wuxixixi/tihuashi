#!/bin/bash
set -e

# Prepare server for deployment (Ubuntu/Debian)
# Run as root: sudo bash prepare_server.sh

echo "== Preparing server for deployment =="

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash $0"
  exit 1
fi

apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release git

# Install Docker (official convenience script)
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "Docker already installed"
fi

# Ensure docker compose plugin exists (docker compose v2)
if ! docker compose version >/dev/null 2>&1; then
  echo "Installing docker compose plugin..."
  apt-get install -y docker-compose-plugin || true
fi

# Create deploy user
DEPLOY_USER=deploy
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
  echo "Created user $DEPLOY_USER"
fi

mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh

echo "Server preparation done. Add your public SSH key to /home/$DEPLOY_USER/.ssh/authorized_keys and set permissions (chmod 600)." 
