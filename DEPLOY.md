# 墨韵 AI 部署指南

## 服务器要求

- 操作系统：Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- 配置：2核 CPU，2GB 内存，20GB 硬盘
- 已安装 Docker 和 Docker Compose

## 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo apt install docker-compose
```

## 部署步骤

### 1. 上传代码

```bash
# 方式一：git clone
git clone https://github.com/wuxixixi/tihuashi.git
cd tihuashi

# 方式二：上传压缩包
scp tihuashi.zip user@your-server:/home/user/
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production .env

# 编辑配置，填入你的 API Key
nano .env
```

修改 `.env` 文件：
```
DMX_API_KEY=sk-your-real-api-key
```

### 3. 启动服务

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

### 4. 访问应用

打开浏览器访问：`http://你的服务器IP`

## 常用命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend

# 更新代码后重新部署
git pull
docker-compose up -d --build
```

## 数据备份

数据存储在 `./data` 目录：
- `./data/uploads` - 上传的图片
- `./data/db` - SQLite 数据库

```bash
# 备份数据
tar -czvf moyun-backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzvf moyun-backup-20260314.tar.gz
```

## 域名配置（可选）

如果有域名，可以使用 Nginx 反向代理并配置 HTTPS：

```nginx
# /etc/nginx/sites-available/moyun
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

然后使用 Certbot 配置 HTTPS：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 故障排查

### 端口被占用
```bash
# 查看端口占用
sudo lsof -i :80
sudo lsof -i :3001

# 修改 docker-compose.yml 中的端口映射
```

### 容器无法启动
```bash
# 查看详细日志
docker-compose logs backend
docker-compose logs frontend

# 检查环境变量
docker-compose config
```

### API 调用失败
检查 `.env` 文件中的 `DMX_API_KEY` 是否正确配置。

## 生产部署注意

- 队列与异步任务：若要在生产环境使用持久化队列，请配置 REDIS_URL（示例：REDIS_URL=redis://:password@redis-host:6379/0），并在 docker-compose 或环境中提供 Redis 服务。项目已支持内存队列回退，建议生产使用 Redis + BullMQ 以提升可靠性。

- 构建产物管理：仓库不应跟踪 frontend/dist（构建产物）。已在 .gitignore 中列出 frontend/dist。合并到主分支前请在本地或 CI 中移除仓库中的构建产物：

  git rm -r --cached frontend/dist
  git add .gitignore
  git commit -m "Remove frontend/dist from repo; move build to CI" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

  在 CI 中添加前端构建步骤：npm ci && npm run build（在发布时生成 frontend/dist）。

- 机密管理：切勿将 API Key 写入镜像或提交到仓库。使用 CI/CD 平台的 Secrets 功能管理敏感信息（例如 GitHub Actions Secrets）。

- 基线负载测试：项目 scripts/ 下提供了负载测试示例（Windows: scripts\run_baseline_load_test.bat，Linux: scripts/autocannon_cmds.txt）。请在隔离的测试环境（staging）运行，并将生成的报告保存在 scripts/reports/ 目录以便分析。

- 安全扫描：建议在合并前启用 secrets scan（已在 .github/workflows/secret-scan.yml 中添加）和依赖审计（npm audit / Dependabot）。


