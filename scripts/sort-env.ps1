$files = @(".env", ".env.local")

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "SKIP: $file not found"
        continue
    }

    $lines = Get-Content $file

    $blankLines = $lines | Where-Object {
        $_.Trim() -eq ""
    }

    $commentLines = $lines | Where-Object {
        $_.Trim().StartsWith("#")
    }

    $envLines = $lines | Where-Object {
        $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#") -and $_ -match "="
    }

    $sortedEnvLines = $envLines | Sort-Object {
        ($_ -split "=", 2)[0].Trim().ToUpper()
    }

    $output = @()

    if ($commentLines.Count -gt 0) {
        $output += $commentLines
        $output += ""
    }

    $output += $sortedEnvLines

    Set-Content -Path $file -Value $output -Encoding UTF8

    Write-Host "SORTED: $file"
}