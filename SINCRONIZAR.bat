@echo off
chcp 65001 >nul
echo ==========================================
echo    SINCRONIZAR DADOS CSV COM GITHUB
echo          LBR Engenharia - DR02
echo ==========================================
echo.

REM Verifica se o PowerShell está disponível
powershell -Command "Write-Host 'PowerShell OK' -ForegroundColor Green"
if errorlevel 1 (
    echo ERRO: PowerShell nao encontrado!
    pause
    exit /b 1
)

echo Executando script de sincronizacao...
echo.

REM Verifica se o arquivo PowerShell existe
if not exist "%~dp0sync-github-clean.ps1" (
    echo ERRO: Arquivo sync-github-clean.ps1 nao encontrado!
    echo Verifique se o arquivo foi criado na mesma pasta.
    pause
    exit /b 1
)

REM Executa o script PowerShell com verbose
powershell -ExecutionPolicy Bypass -File "%~dp0sync-github-clean.ps1"

if errorlevel 1 (
    echo.
    echo ERRO: Script PowerShell falhou!
)

echo.
echo ==========================================
echo Pressione qualquer tecla para fechar...
pause >nul