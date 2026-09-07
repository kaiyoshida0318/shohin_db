@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "PROJECT_DIR=C:\dev\web\projects\shohin_db"

call :main
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo ========================================
  echo  Process stopped with an error.
  echo  Exit code: %EXIT_CODE%
  echo ========================================
) else (
  echo ========================================
  echo  Done.
  echo ========================================
)
echo.
echo Press any key to close this window.
pause >nul
endlocal & exit /b %EXIT_CODE%

:main
echo.
echo ========================================
echo  shohin_db build + git pull/rebase + push
echo ========================================
echo.

if not exist "%PROJECT_DIR%" (
  echo ERROR: Project folder was not found.
  echo Path: %PROJECT_DIR%
  exit /b 1
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Failed to move to project folder.
  exit /b 1
)

echo Current folder:
cd
echo.

if not exist "package.json" (
  echo ERROR: package.json was not found in this folder.
  echo Please check PROJECT_DIR in this bat file.
  exit /b 1
)

set "MSG="
set /p "MSG=Commit message (blank = Update shohin_db): "
if not defined MSG set "MSG=Update shohin_db"

echo.
echo [1/7] npm run build
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR: Build failed. Push was stopped.
  exit /b 1
)

echo.
echo [2/7] git status
git status
if errorlevel 1 (
  echo.
  echo ERROR: git status failed.
  exit /b 1
)

echo.
echo [3/7] git add -A
git add -A
if errorlevel 1 (
  echo.
  echo ERROR: git add failed.
  exit /b 1
)

echo.
echo [4/7] git commit
git diff --cached --quiet
if errorlevel 1 (
  rem Pass the commit message through the environment so CMD special characters
  rem in the message are not re-parsed as BAT syntax.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "& git commit -m $env:MSG"
  if errorlevel 1 (
    echo.
    echo ERROR: git commit failed.
    exit /b 1
  )
) else (
  echo No local changes to commit.
)

echo.
echo [5/7] git pull --rebase origin main
git pull --rebase origin main
if errorlevel 1 (
  echo.
  echo ERROR: git pull --rebase failed.
  echo Remote main has changes that could not be merged automatically.
  echo Please copy this screen and ask ChatGPT what to fix.
  echo.
  echo To cancel the rebase manually, run:
  echo git rebase --abort
  exit /b 1
)

echo.
echo [6/7] git push origin main
git push origin main
if errorlevel 1 (
  echo.
  echo ERROR: git push failed.
  echo Please copy this screen and ask ChatGPT what to fix.
  exit /b 1
)

echo.
echo [7/7] git status
git status
if errorlevel 1 (
  echo.
  echo ERROR: final git status failed.
  exit /b 1
)

exit /b 0
