# Génère le fichier de test antivirus EICAR (inoffensif).
# Windows Defender peut le supprimer immédiatement : lancez ce script
# juste avant de l'uploader dans SecureDocs.

$eicar = 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
$outDir = Join-Path $env:USERPROFILE 'Downloads'
if (-not (Test-Path $outDir)) { $outDir = $PSScriptRoot }
$path = Join-Path $outDir 'eicar-test.txt'

[System.IO.File]::WriteAllText($path, $eicar, [System.Text.Encoding]::ASCII)

Write-Host ""
Write-Host "Fichier cree :" -ForegroundColor Green
Write-Host "  $path"
Write-Host ""
Write-Host "Uploadez-le tout de suite dans SecureDocs (Ajouter un document)." -ForegroundColor Yellow
Write-Host "Si Windows le bloque, excluez temporairement ce dossier dans Defender." -ForegroundColor Yellow
Write-Host ""
explorer.exe /select,$path
