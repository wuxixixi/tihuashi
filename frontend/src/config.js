/**
 * API 配置
 * 开发环境使用 localhost，生产环境使用相对路径（通过 nginx 代理）
 */
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001'

export default API_BASE
