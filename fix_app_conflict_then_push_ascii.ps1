$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "========================================"
Write-Host " shohin_db conflict fix + push"
Write-Host "========================================"
Write-Host ""
Write-Host "Current folder:"
Write-Host (Get-Location)
Write-Host ""

$app = Join-Path $root "src\App.tsx"

if (!(Test-Path $app)) {
  Write-Host "ERROR: src\App.tsx not found."
  Write-Host "Put this script in the shohin_db project root."
  exit 1
}

$text = Get-Content -Raw -Encoding UTF8 $app
$correctLine = '          <img src={`${import.meta.env.BASE_URL}login-logo.png`} alt="Shohin DB" className="login-logo" />'

# Fix merge conflict around login-logo.png.
$pattern = '(?s)<<<<<<< HEAD.*?login-logo\.png.*?=======.*?login-logo\.png.*?>>>>>>>[^\r\n]*(\r?\n)?'
$fixed = [regex]::Replace($text, $pattern, $correctLine + "`r`n")

if ($fixed -match '<<<<<<<|=======|>>>>>>>') {
  Write-Host ""
  Write-Host "ERROR: conflict markers are still in App.tsx."
  Write-Host "Matched lines:"
  Select-String -Path $app -Pattern '<<<<<<<|=======|>>>>>>>' -Context 4,4
  Write-Host ""
  Write-Host "Please paste this screen."
  exit 1
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($app, $fixed, $utf8NoBom)

Write-Host "[OK] App.tsx conflict fixed."
Write-Host ""

if (!(Test-Path (Join-Path $root "public\login-logo.png"))) {
  Write-Host "WARNING: public\login-logo.png not found."
  Write-Host "The login logo may not show until this file exists."
  Write-Host ""
}

Write-Host "[1/5] npm run build"
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "ERROR: build failed. Push stopped."
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[2/5] git add ."
git add .
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "ERROR: git add failed."
  exit $LASTEXITCODE
}

$rebaseMerge = Join-Path $root ".git\rebase-merge"
$rebaseApply = Join-Path $root ".git\rebase-apply"

if ((Test-Path $rebaseMerge) -or (Test-Path $rebaseApply)) {
  Write-Host ""
  Write-Host "[3/5] git rebase --continue"
  git -c core.editor=true rebase --continue
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: git rebase --continue failed."
    Write-Host "Another conflict may exist. Please paste this screen."
    exit $LASTEXITCODE
  }
} else {
  Write-Host ""
  Write-Host "[3/5] git commit"
  $status = git status --porcelain
  if ($status) {
    git commit -m "Fix login logo path"
    if ($LASTEXITCODE -ne 0) {
      Write-Host ""
      Write-Host "ERROR: git commit failed."
      exit $LASTEXITCODE
    }
  } else {
    Write-Host "No changes to commit."
  }

  Write-Host ""
  Write-Host "[4/5] git pull --rebase origin main"
  git pull --rebase origin main
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: git pull --rebase failed."
    Write-Host "A conflict may exist. Please paste this screen."
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "[5/5] git push origin main"
git push origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "ERROR: git push failed."
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "DONE: push complete."
