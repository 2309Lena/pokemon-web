param(
    [string]$Message = "Update PokeWorld Atlas"
)

$git = "C:\Program Files\Git\cmd\git.exe"
$repo = "C:\Users\shubu\pokemon-web"

& $git -C $repo add .
$changes = & $git -C $repo status --porcelain
if (-not $changes) {
    Write-Host "Khong co thay doi moi de push." -ForegroundColor Yellow
    exit 0
}

& $git -C $repo commit -m $Message
& $git -C $repo push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "Da day code len GitHub (2309Lena/pokemon-web) thanh cong!" -ForegroundColor Green
}
