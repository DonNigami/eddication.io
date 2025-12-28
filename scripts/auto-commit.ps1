param(
    [string]$Message = "Auto commit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

# Move to repo root
Push-Location "D:\VS_Code_GitHub_DATA\eddication.io\eddication.io"

# Stage, commit, push
try {
    git add -A
    # Skip commit if nothing changed
    $status = git status --porcelain
    if (-not $status) {
        Write-Host "No changes to commit"
        Pop-Location
        exit 0
    }
    git commit -m $Message
    git push
    Write-Host "✅ Auto commit & push done"
}
catch {
    Write-Host "❌ Auto commit/push failed: $($_.Exception.Message)"
}
finally {
    Pop-Location
}
