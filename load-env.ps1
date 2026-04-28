Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+?)\s*$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        Write-Host "Loaded: $($matches[1])"
    }
}