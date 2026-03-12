# 墨韵 AI 测试说明

## 后端测试（集成测试）

- **框架**：Jest + supertest
- **位置**：`backend/__tests__/server.integration.test.js`
- **运行**：
  ```bash
  cd backend && npm test
  ```
- **说明**：测试所有 API 路由（上传、分析、题诗、历史增删查），外部 AI 调用已 mock，历史记录使用独立 `test-history.json`，不污染正式数据。

## 前端测试（单元测试）

- **框架**：Vitest + @testing-library/react
- **位置**：`frontend/src/App.test.jsx`
- **运行**：
  ```bash
  cd frontend && npm test
  ```
  或监听模式：`npm run test:watch`
- **说明**：测试 App 组件渲染、Tab 切换、风格选择、感悟输入、上传与题诗流程（fetch 已 mock）。

## 一键运行全部测试

```bash
cd backend && npm test && cd ../frontend && npm test
```
