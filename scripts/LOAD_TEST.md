# 基线负载测试说明

目的
- 对当前后端在本地/CI 下的性能进行基线测量（QPS、平均/分位延迟、错误率、CPU/内存占用），用于改造前后对比。

工具
- autocannon（快速、轻量，基于 Node.js）
- k6（更专业，可导出详细指标）

autocannon 示例
- 本地快速测试（安装：npm install -g autocannon 或 npx autocannon）：

  npx autocannon -c 20 -d 30 -m POST -H "Content-Type: application/json" -b '{"imagePath":"/absolute/path/to/uploads/sample.jpg"}' http://localhost:3001/api/analyze

k6 示例
- 安装参考：https://k6.io/docs/getting-started/installation/
- 运行示例：

  k6 run scripts/k6_analyze_test.js

建议流程
1. 启动后端（cd backend && npm start）
2. 在另一个 shell 运行 autocannon 或 k6（可先用小并发确认无误）
3. 保存报告（autocannon 支持 --output，k6 可生成 JSON）
4. 把报告上传到 repo（scripts/load-test-reports/）或存档为 artifacts 用于对比

注意事项
- 在测试前确保 CI 已通过，数据库/文件准备妥当（测试数据尽量隔离）
- 在生产环境测试前需征得权限
