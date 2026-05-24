@echo off
echo Removing frontend/dist from git tracking...
git rm -r --cached frontend/dist
git add .gitignore
git commit -m "Remove frontend/dist from repo" -m "Remove build artifacts from version control; frontend/dist is in .gitignore." -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
echo Done. If git prompts for errors, run this in Git Bash or PowerShell with git installed.
