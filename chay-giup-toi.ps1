# SV5T - Mo trang web + copy Code.gs vao clipboard de ban dan vao Apps Script
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$codePath = Join-Path $root "google-apps-script\Code.gs"
$indexPath = Join-Path $root "index.html"
$apiUrl = "https://script.google.com/macros/s/AKfycbwbXCFlkvPAWLb6D2LqflqxxmWdbIAVCaAfgG2TW3uPy-7HovD8a0EQjDSRUbX3JD_9mw/exec"

Write-Host "=== HE THONG XET SINH VIEN 5 TOT ===" -ForegroundColor Cyan
Write-Host ""

# 1. Copy Code.gs vao clipboard
if (Test-Path $codePath) {
    $code = Get-Content $codePath -Raw -Encoding UTF8
    Set-Clipboard -Value $code
    $lines = ($code -split "`n").Count
    Write-Host "[OK] Da copy Code.gs ($lines dong) vao clipboard." -ForegroundColor Green
    Write-Host "     -> Vao script.google.com, xoa het code cu, Ctrl+V dan vao." -ForegroundColor Yellow
} else {
    Write-Host "[LOI] Khong tim thay $codePath" -ForegroundColor Red
}

Write-Host ""

# 2. Test API
Write-Host "Dang kiem tra API..." -ForegroundColor Cyan
try {
    $pingUrl = "$apiUrl`?action=ping"
    $resp = Invoke-WebRequest -Uri $pingUrl -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 25
    if ($resp.Content -match '"ok"\s*:\s*true') {
        Write-Host "[OK] API dang chay!" -ForegroundColor Green
        Write-Host $resp.Content
    } else {
        Write-Host "[CANH BAO] API tra ve nhung chua ro:" -ForegroundColor Yellow
        Write-Host $resp.Content.Substring(0, [Math]::Min(300, $resp.Content.Length))
    }
} catch {
    Write-Host "[LOI] API chua chay - ban can lam tren script.google.com:" -ForegroundColor Red
    Write-Host "  1. Ctrl+V dan Code.gs (da copy san)" -ForegroundColor Yellow
    Write-Host "  2. Ctrl+S luu" -ForegroundColor Yellow
    Write-Host "  3. Chon ham setupSV5T -> Chay" -ForegroundColor Yellow
    Write-Host "  4. Trien khai -> Quan ly -> Sua -> Phien ban moi -> Trien khai" -ForegroundColor Yellow
    Write-Host "  5. Mo lai: $apiUrl`?action=ping" -ForegroundColor Yellow
}

Write-Host ""

# 3. Mo trinh duyet
Write-Host "Mo trang web..." -ForegroundColor Cyan
Start-Process "https://script.google.com/home/projects"
Start-Sleep -Seconds 1
if (Test-Path $indexPath) {
    Start-Process $indexPath
}
Start-Process "$apiUrl`?action=ping"

Write-Host ""
Write-Host "Xong! Lam tiep tren tab script.google.com (code da trong clipboard)." -ForegroundColor Green
Write-Host "Nhan phim bat ky de dong..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
