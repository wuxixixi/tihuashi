短期部署/合并建议（供维护者执行）

目的：清理残留冲突，移除构建产物 frontend/dist，并把构建步骤移入 CI。

步骤：
1) 在本地获取最新分支并确保工作区干净
   git checkout <branch>
   git pull

2) 提交 CSS 修复（已在工作区修改）：
   git add frontend/src/index.css
   git commit -m "Fix merge conflict in frontend/src/index.css" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

3) 从版本控制中移除构建产物并提交：
   git rm -r --cached frontend/dist
   git add .gitignore
   git commit -m "Remove frontend/dist from repo" -m "Build artifacts should not be tracked; move build to CI" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

4) 推送并在 CI 中触发前端构建：
   git push origin <branch>
   在 CI（GitHub Actions）中运行 npm ci && npm run build 来生成 frontend/dist

5) 可选：若仍有合并冲突留在构建产物中，可直接删除 frontend/dist 并在 CI 中重建。

备注：当前环境无法代为执行 git 操作，请在有权限的机器上执行上述步骤。
