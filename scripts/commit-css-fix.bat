@echo off
echo Committing CSS conflict fix...
git add frontend/src/index.css
git commit -m "Fix merge conflict in frontend/src/index.css" -m "Removed leftover conflict markers and merged About Section and Error Boundary." -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
echo Done.
