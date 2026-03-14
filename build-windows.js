const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.join(__dirname, 'dist', 'moyun-windows');

console.log('构建墨韵 AI Windows 便携版...\n');

// 1. 清理并创建目录
console.log('1. 创建输出目录...');
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. 构建前端
console.log('2. 构建前端...');
execSync('npm run build', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });

// 3. 复制前端构建产物
console.log('3. 复制前端文件...');
const frontendDist = path.join(__dirname, 'frontend', 'dist');
const frontendTarget = path.join(DIST_DIR, 'frontend');
fs.cpSync(frontendDist, frontendTarget, { recursive: true });

// 4. 复制后端文件
console.log('4. 复制后端文件...');
const backendSrc = path.join(__dirname, 'backend');
const backendTarget = path.join(DIST_DIR, 'backend');

// 创建后端目录
fs.mkdirSync(backendTarget, { recursive: true });

// 复制必要文件
const backendFiles = ['server.js', 'package.json', 'package-lock.json'];
backendFiles.forEach(file => {
  fs.copyFileSync(path.join(backendSrc, file), path.join(backendTarget, file));
});

// 复制 node_modules
console.log('5. 安装后端依赖...');
fs.cpSync(path.join(backendSrc, 'node_modules'), path.join(backendTarget, 'node_modules'), { recursive: true });

// 5. 创建数据目录
console.log('6. 创建数据目录...');
fs.mkdirSync(path.join(DIST_DIR, 'data', 'uploads'), { recursive: true });

// 6. 创建环境变量模板
console.log('7. 创建配置文件...');
fs.writeFileSync(path.join(DIST_DIR, '.env'), `DMX_API_KEY=your-api-key-here
DMX_BASE_URL=https://www.dmxapi.cn/v1
DMX_MODEL=gpt-5-mini
VISION_MODEL=Doubao-1.5-vision-pro-32k
PORT=3001
DB_PATH=./data/moyun.db
`);

// 7. 创建启动脚本
console.log('8. 创建启动脚本...');
fs.writeFileSync(path.join(DIST_DIR, '启动墨韵AI.bat'), `@echo off
chcp 65001 >nul
title 墨韵 AI
echo.
echo ╔══════════════════════════════════════════════╗
echo ║           墨 韵 A I                          ║
echo ║     AI 赏析中国画，为您题诗                   ║
echo ║                                              ║
echo ║     上海觉测信息科技有限公司 出品              ║
echo ╚══════════════════════════════════════════════╝
echo.
echo 正在启动服务...
echo.

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 .env 配置
findstr "your-api-key-here" .env >nul
if %errorlevel% equ 0 (
    echo [警告] 请先编辑 .env 文件，填入您的 DMX_API_KEY
    echo.
)

:: 启动后端
cd backend
start /b node server.js

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 打开浏览器
echo 服务已启动，正在打开浏览器...
start http://localhost:3001

echo.
echo ══════════════════════════════════════════════
echo  服务已启动！
echo  访问地址: http://localhost:3001
echo  关闭此窗口即可停止服务
echo ══════════════════════════════════════════════
echo.
pause
`);

// 8. 创建停止脚本
fs.writeFileSync(path.join(DIST_DIR, '停止服务.bat'), `@echo off
taskkill /f /im node.exe 2>nul
echo 服务已停止
pause
`);

// 9. 创建使用说明
fs.writeFileSync(path.join(DIST_DIR, '使用说明.txt'), `
═══════════════════════════════════════════════════════════
                    墨 韵 A I
              AI 赏析中国画，为您题诗

              上海觉测信息科技有限公司 出品
═══════════════════════════════════════════════════════════

【使用步骤】

1. 安装 Node.js
   - 下载地址: https://nodejs.org/
   - 选择 LTS 版本下载安装

2. 配置 API Key
   - 编辑 .env 文件
   - 将 your-api-key-here 替换为您的 DMX API Key
   - API Key 获取地址: https://www.dmxapi.cn/

3. 启动服务
   - 双击运行 "启动墨韵AI.bat"
   - 浏览器会自动打开 http://localhost:3001

4. 停止服务
   - 关闭命令行窗口
   - 或运行 "停止服务.bat"

【数据存储】

- 上传的图片: ./data/uploads/
- 数据库文件: ./data/moyun.db

【常见问题】

Q: 启动失败提示"未检测到 Node.js"
A: 请先安装 Node.js，下载地址: https://nodejs.org/

Q: 上传图片后分析失败
A: 请检查 .env 文件中的 DMX_API_KEY 是否正确

Q: 如何备份数据
A: 复制 data 文件夹即可

【技术支持】

GitHub: https://github.com/wuxixixi/tihuashi

═══════════════════════════════════════════════════════════
`);

console.log('\n✅ 构建完成！');
console.log(`输出目录: ${DIST_DIR}`);
console.log('\n请将 dist/moyun-windows 目录打包为 zip 文件上传到 GitHub Release');
