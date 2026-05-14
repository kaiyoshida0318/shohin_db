@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\dev\web\projects\shohin_db"

echo.
echo ========================================
echo  shohin_db build + git push
echo ========================================
echo.

if not exist "%PROJECT_DIR%" (
  echo ERROR: Project folder was not found.
  echo Path: %PROJECT_DIR%
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Failed to move to project folder.
  echo.
  pause
  exit /b 1
)

echo Current folder:
cd
echo.

if not exist "package.json" (
  echo ERROR: package.json was not found in this folder.
  echo Please check PROJECT_DIR in this bat file.
  echo.
  pause
  exit /b 1
)

set "MSG="
set /p "MSG=Commit message (blank = Update shohin_db): "
if "%MSG%"=="" set "MSG=Update shohin_db"

echo.
echo [1/5] npm run build
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR: Build failed. Push was stopped.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/5] git status
git status

echo.
echo [3/5] git add -A
git add -A
if errorlevel 1 (
  echo.
  echo ERROR: git add failed.
  echo.
  pause
  exit /b 1
)

echo.
echo [4/5] git commit
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
  if errorlevel 1 (
    echo.
    echo ERROR: git commit failed.
    echo.
    pause
    exit /b 1
  )
) else (
  echo No local changes to commit.
)

echo.
echo [5/5] git push origin main
git push origin main
if errorlevel 1 (
  echo.
  echo ERROR: git push failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Done.
echo.
pause
endlocal
