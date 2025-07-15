# ==========================================
# Script de Sincronizacao - LBR Engenharia
# DR02 Map Site - Rodrigo Henrique
# ==========================================

$RepositoryUrl = "https://github.com/rodrigohenriquecc/dr02-map-site.git"
$BranchName = "main"
$LocalDataPath = "Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo\DadosSite"
$WorkspaceRoot = "Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo"
$GitRepoPath = "$env:TEMP\dr02-sync"
$CommitMessage = "Atualizar dados CSV - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"

Write-Host "🚀 LBR Engenharia - Sincronizacao DR02 Map Site" -ForegroundColor Green
Write-Host "👤 Usuario: Rodrigo Henrique (rodrigohenriquecc)" -ForegroundColor Cyan
Write-Host "🌐 Site: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
Write-Host ""

# Verifica se o Git esta instalado
try {
    $gitVersion = git --version 2>$null
    Write-Host "✅ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git nao encontrado!" -ForegroundColor Red
    Write-Host "💡 Baixe em: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Pressione Enter para continuar"
    exit 1
}

# Verifica se a pasta de dados existe
if (-not (Test-Path $LocalDataPath)) {
    Write-Host "❌ Pasta de dados nao encontrada: $LocalDataPath" -ForegroundColor Red
    Read-Host "Pressione Enter para continuar"
    exit 1
}

# Remove diretorio temporario se existir
if (Test-Path $GitRepoPath) {
    Write-Host "🗑️ Limpando diretorio temporario..." -ForegroundColor Yellow
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Configura credenciais Git
Write-Host "⚙️ Configurando Git..." -ForegroundColor Cyan
git config --global user.name "Rodrigo Henrique"
git config --global user.email "rodrigohc@live.com"

# Clona o repositorio
Write-Host "📥 Conectando ao repositorio GitHub..." -ForegroundColor Cyan
try {
    git clone $RepositoryUrl $GitRepoPath
    
    if (-not (Test-Path $GitRepoPath)) {
        throw "Falha ao clonar repositorio"
    }
    
    Set-Location $GitRepoPath
    Write-Host "✅ Repositorio clonado com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao conectar com GitHub" -ForegroundColor Red
    Write-Host "💡 Verifique sua conexao com internet" -ForegroundColor Yellow
    Read-Host "Pressione Enter para continuar"
    exit 1
}

# Verifica/cria pasta DadosSite no repositorio
$RepoDataPath = Join-Path $GitRepoPath "DadosSite"
if (-not (Test-Path $RepoDataPath)) {
    Write-Host "📁 Criando pasta DadosSite no repositorio..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $RepoDataPath -Force | Out-Null
}

# Lista de arquivos CSV obrigatorios
$csvFiles = @("meta.csv", "pontos_interesse.csv", "mapa_calor.csv", "linhas_trecho.csv")

Write-Host "📋 Verificando arquivos CSV..." -ForegroundColor Cyan
$filesChanged = $false
$filesFound = 0

foreach ($file in $csvFiles) {
    $sourcePath = Join-Path $LocalDataPath $file
    $destPath = Join-Path $RepoDataPath $file
    
    if (Test-Path $sourcePath) {
        $filesFound++
        Copy-Item $sourcePath $destPath -Force
        Write-Host "  ✅ $file copiado" -ForegroundColor Green
        $filesChanged = $true
    } else {
        Write-Host "  ⚠️ $file nao encontrado" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Resumo: $filesFound de $($csvFiles.Count) arquivos encontrados" -ForegroundColor Cyan

if ($filesFound -eq 0) {
    Write-Host "❌ Nenhum arquivo CSV encontrado!" -ForegroundColor Red
    Set-Location $WorkspaceRoot
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Pressione Enter para continuar"
    exit 1
}

if ($filesChanged) {
    Write-Host "📤 Enviando alteracoes para GitHub..." -ForegroundColor Cyan
    
    try {
        git add DadosSite/
        git commit -m $CommitMessage
        git push origin $BranchName
        
        Write-Host "🎉 SUCESSO! Dados sincronizados!" -ForegroundColor Green
        Write-Host "🌐 Site: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
        Write-Host "⏱️ Aguarde 2-3 minutos para atualizacao" -ForegroundColor Yellow
    } catch {
        Write-Host "❌ Erro ao enviar para GitHub" -ForegroundColor Red
        Write-Host "💡 Pode ser necessario fazer login no Git" -ForegroundColor Yellow
    }
} else {
    Write-Host "✨ Nenhuma alteracao detectada" -ForegroundColor Green
}

# Limpeza final
Set-Location $WorkspaceRoot
Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Processo finalizado" -ForegroundColor Green
Read-Host "Pressione Enter para fechar"