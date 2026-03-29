# JETSETGO - Load Environment Secrets
# Run this script to load all API keys and secrets

$SECRETS_FILE = Join-Path $PSScriptRoot ".env.secrets"

Write-Host "Loading JETSETGO secrets..." -ForegroundColor Cyan

if (Test-Path $SECRETS_FILE) {
    Get-Content $SECRETS_FILE | ForEach-Object {
        # Skip comments and empty lines
        if ($_ -match '^#' -or $_ -match '^\s*$') { return }

        # Parse KEY=VALUE
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()

            # Skip empty values
            if ([string]::IsNullOrWhiteSpace($value)) { return }

            # Set environment variable
            Set-Item -Path "env:$name" -Value $value
            Write-Host "  Loaded: $name" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "Secrets loaded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available variables:" -ForegroundColor Cyan
    Write-Host "  `$env:SUPABASE_URL" -ForegroundColor White
    Write-Host "  `$env:SUPABASE_ACCESS_TOKEN" -ForegroundColor White
    Write-Host "  `$env:GROQ_API_KEY" -ForegroundColor White
    Write-Host "  etc." -ForegroundColor White
} else {
    Write-Host "Error: .env.secrets file not found at $SECRETS_FILE" -ForegroundColor Red
}
