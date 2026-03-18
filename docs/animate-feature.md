# 名画动画功能设计文档

## 功能概述
让名画"动起来"——通过AI分析画作意境，生成符合画作风格的动画视频

## 技术方案

### 1. 视频生成API选择

| API | 特点 | 价格 | 适用场景 |
|-----|------|------|----------|
| **可灵 AI (Kling)** | 国产、图生视频、5秒视频 | 约0.5元/次 | 推荐，性价比高 |
| Runway Gen-3 | 高质量、图生视频 | $0.05/秒 | 高端需求 |
| Pika Labs | 简单易用 | 免费/付费 | 入门级 |
| 通义万象 | 阿里云、中文理解好 | 按量计费 | 中文场景 |

### 2. 工作流程

```
用户上传/选择画作
    ↓
AI分析画作内容+意境
    ↓
生成动画提示词（描述画面如何动）
    ↓
调用视频生成API
    ↓
返回视频URL
    ↓
前端展示视频
```

### 3. 数据库设计

```sql
-- 动画记录表
CREATE TABLE IF NOT EXISTS animations (
    id TEXT PRIMARY KEY,
    historyId TEXT,           -- 关联的历史记录
    imageUrl TEXT,            -- 原图URL
    prompt TEXT,              -- 动画提示词
    videoUrl TEXT,            -- 生成的视频URL
    status TEXT DEFAULT 'pending', -- pending/processing/completed/failed
    provider TEXT,            -- API提供商
    cost REAL,                -- 消耗费用
    createdAt TEXT,
    FOREIGN KEY (historyId) REFERENCES history(id)
);
```

### 4. API设计

#### 后端接口

```
POST /api/animate/generate
请求体：
{
    "imageUrl": "画作图片URL",
    "analysis": "画作赏析内容（可选）",
    "style": "动画风格：自然/艺术/古典"
}
响应：
{
    "success": true,
    "animationId": "动画记录ID",
    "prompt": "生成的动画提示词",
    "status": "processing"
}

GET /api/animate/:id/status
响应：
{
    "success": true,
    "status": "completed",
    "videoUrl": "视频URL",
    "thumbnailUrl": "缩略图URL"
}

GET /api/animations
获取动画历史列表
```

### 5. 前端设计

- 在画作详情页添加"让画作动起来"按钮
- 动画生成进度显示
- 视频播放器组件
- 动画历史记录

### 6. 动画提示词生成逻辑

根据画作类型生成不同风格的动画描述：

**山水画**：
- 云雾流动、瀑布倾泻、松柏摇曳
- 水波荡漾、鸟飞云移

**花鸟画**：
- 花瓣飘落、蝴蝶飞舞
- 鸟儿展翅、枝条轻摇

**人物画**：
- 衣袂飘飘、眼神流转
- 手势动作、场景动态

**写意画**：
- 墨色晕染扩散
- 笔触流动效果

## 实现计划

1. **Phase 1**: 基础架构
   - 数据库表创建
   - 后端API框架
   - 视频生成服务封装

2. **Phase 2**: 核心功能
   - 可灵API集成
   - 动画提示词生成
   - 视频状态轮询

3. **Phase 3**: 前端界面
   - 动画生成按钮
   - 进度显示
   - 视频播放

4. **Phase 4**: 优化
   - 视频缓存
   - 成本控制
   - 错误处理
