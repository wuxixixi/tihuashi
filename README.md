# 墨韵 AI

**上海觉测信息科技有限公司 出品**

AI 赏析中国画，为您题诗。

墨韵 AI 是一款基于人工智能的中国画赏析与诗词创作应用。用户上传中国画作品，AI 自动进行专业赏析，并根据用户感悟生成古典诗词。

## 功能特点

- **智能赏析** - AI 从题材、构图、技法、意境等角度专业赏析中国画
- **诗词创作** - 支持五言绝句、七言绝句、律诗、古体诗及多种词牌风格
- **批量上传** - 支持批量上传图片，一键分析多幅画作
- **历史记录** - 自动保存创作记录，支持收藏、标签、搜索
- **数据导出** - 支持 JSON/CSV 格式导出备份

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| AI 服务 | DMX API (Doubao Vision) |
| 部署 | Docker + Nginx |

## 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/wuxixixi/tihuashi.git
cd tihuashi

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install

# 配置环境变量
cp ../backend/.env.example ../backend/.env
# 编辑 backend/.env 填入 DMX_API_KEY

# 启动后端 (端口 3001)
cd backend && npm start

# 启动前端 (端口 5173)
cd frontend && npm run dev
```

访问 http://localhost:5173

### Docker 部署

```bash
# 配置环境变量
cp .env.production .env
# 编辑 .env 填入 DMX_API_KEY

# 启动服务
docker-compose up -d --build
```

详细部署说明请查看 [DEPLOY.md](./DEPLOY.md)

## 项目结构

```
tihuashi/
├── backend/                # 后端服务
│   ├── server.js           # Express 服务入口
│   ├── uploads/            # 上传图片存储
│   └── __tests__/          # 测试文件
├── frontend/               # 前端应用
│   └── src/
│       ├── App.jsx         # 主组件
│       ├── components/     # UI 组件
│       ├── contexts/       # React Context
│       └── hooks/          # 自定义 Hooks
├── docker-compose.yml      # Docker 编排
├── .env.production         # 环境变量模板
└── DEPLOY.md               # 部署说明
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/upload | 上传图片 |
| POST | /api/analyze | AI 赏析画作 |
| POST | /api/poem | 生成诗词 |
| GET | /api/history | 获取历史记录 |
| POST | /api/save | 保存记录 |
| DELETE | /api/history | 删除全部记录 |
| GET | /api/export | 导出数据 |

## License

MIT License

---

**上海觉测信息科技有限公司**

专注人工智能与文化科技的融合创新
