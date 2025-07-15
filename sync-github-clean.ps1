# ==========================================
# Script de Sincronização - LBR Engenharia
# DR02 Map Site - Rodrigo Henrique
# ==========================================

# Configurações fixas
$RepositoryUrl = "https://github.com/rodrigohenriquecc/dr02-map-site.git"
$BranchName = "main"
$LocalDataPath = "Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo\DadosSite"
$WorkspaceRoot = "Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo"
$GitRepoPath = "$env:TEMP\dr02-sync"
$CommitMessage = "Atualizar dados CSV - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"

Write-Host "🚀 LBR Engenharia - Sincronização DR02 Map Site" -ForegroundColor Green
Write-Host "👤 Usuário: Rodrigo Henrique (rodrigohenriquecc)" -ForegroundColor Cyan
Write-Host "🌐 Site: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
Write-Host ""

# Verifica se o Git está instalado
try {
    $gitVersion = git --version 2>$null
    Write-Host "✅ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git não encontrado! Instalando..." -ForegroundColor Red
    Write-Host "💡 Baixe em: https://git-scm.com/download/win" -ForegroundColor Yellow
    Start-Process "https://git-scm.com/download/win"
    Read-Host "Pressione Enter após instalar o Git"
    exit 1
}

# Verifica se a pasta de dados existe
if (-not (Test-Path $LocalDataPath)) {
    Write-Host "❌ Pasta de dados não encontrada: $LocalDataPath" -ForegroundColor Red
    exit 1
}

# Remove diretório temporário se existir
if (Test-Path $GitRepoPath) {
    Write-Host "🗑️ Limpando diretório temporário..." -ForegroundColor Yellow
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Clona o repositório
Write-Host "📥 Conectando ao repositório GitHub..." -ForegroundColor Cyan
try {
    # Configura credenciais Git
    git config --global user.name "Rodrigo Henrique"
    git config --global user.email "rodrigohc@live.com"
    git config --global credential.helper store
    
    # Cria URL com credenciais
    $repoWithAuth = "https://rodrigohenriquecc:@rHcc_1993@github.com/rodrigohenriquecc/dr02-map-site.git"
    
    # Clona o repositório
    git clone $repoWithAuth $GitRepoPath 2>$null
    
    if (-not (Test-Path $GitRepoPath)) {
        throw "Falha ao clonar repositório"
    }
    
    Set-Location $GitRepoPath
    Write-Host "✅ Repositório clonado com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao conectar com GitHub" -ForegroundColor Red
    Write-Host "💡 Verifique suas credenciais e conexão com internet" -ForegroundColor Yellow
    Read-Host "Pressione Enter para continuar"
    exit 1
}

# Verifica/cria pasta DadosSite no repositório
$RepoDataPath = Join-Path $GitRepoPath "DadosSite"
if (-not (Test-Path $RepoDataPath)) {
    Write-Host "📁 Criando pasta DadosSite no repositório..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $RepoDataPath -Force | Out-Null
}

# Lista de arquivos CSV obrigatórios
$csvFiles = @("meta.csv", "pontos_interesse.csv", "mapa_calor.csv", "linhas_trecho.csv")

Write-Host "📋 Verificando arquivos CSV..." -ForegroundColor Cyan
$filesChanged = $false
$filesFound = 0

foreach ($file in $csvFiles) {
    $sourcePath = Join-Path $LocalDataPath $file
    $destPath = Join-Path $RepoDataPath $file
    
    if (Test-Path $sourcePath) {
        $filesFound++
        
        # Verifica se precisa atualizar
        $needsCopy = $true
        if (Test-Path $destPath) {
            $sourceHash = (Get-FileHash $sourcePath -Algorithm MD5).Hash
            $destHash = (Get-FileHash $destPath -Algorithm MD5).Hash
            $needsCopy = $sourceHash -ne $destHash
        }
        
        if ($needsCopy) {
            Copy-Item $sourcePath $destPath -Force
            Write-Host "  ✅ $file → Atualizado" -ForegroundColor Green
            $filesChanged = $true
        } else {
            Write-Host "  ⏩ $file → Sem alterações" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ $file → NÃO ENCONTRADO" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Resumo: $filesFound de $($csvFiles.Count) arquivos encontrados" -ForegroundColor Cyan

if ($filesFound -eq 0) {
    Write-Host "❌ Nenhum arquivo CSV encontrado na pasta local!" -ForegroundColor Red
    Write-Host "💡 Verifique se os arquivos estão em: $LocalDataPath" -ForegroundColor Yellow
    Set-Location $WorkspaceRoot
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Pressione Enter para continuar"
    exit 1
}

if (-not $filesChanged) {
    Write-Host "✨ Todos os arquivos estão atualizados no GitHub!" -ForegroundColor Green
    Write-Host "🌐 Site: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
    Set-Location $WorkspaceRoot
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Pressione Enter para continuar"
    exit 0
}

# Envia alterações para GitHub
Write-Host "📤 Enviando alterações para GitHub..." -ForegroundColor Cyan

try {
    # Adiciona todos os arquivos da pasta DadosSite
    git add DadosSite/ 2>$null
    
    # Verifica se há mudanças
    $status = git status --porcelain 2>$null
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "✨ Nenhuma mudança detectada pelo Git" -ForegroundColor Green
    } else {
        # Faz commit
        git commit -m $CommitMessage 2>$null
        
        # Faz push
        git push origin $BranchName 2>$null
        
        Write-Host "🎉 SUCESSO! Dados sincronizados com GitHub!" -ForegroundColor Green
        Write-Host "🌐 Site será atualizado em: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
        Write-Host "⏱️ Aguarde 2-3 minutos para a# ==========================================
# Script de Sincronização - LBR Engenharia
# DR02 Map Site - Rodrigo Henrique
# ==========================================

# Configurações fixas
$RepositoryUrl = "https://github.com/rodrigohenriquecc/dr02-map-site.git"
$BranchName = "main"
$LocalDataPath = "Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo\DadosSite"
$WorkspaceRoot = "Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo"
$GitRepoPath = "$env:TEMP\dr02-sync"
$CommitMessage = "Atualizar dados CSV - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"

Write-Host "🚀 LBR Engenharia - Sincronização DR02 Map Site" -ForegroundColor Green
Write-Host "👤 Usuário: Rodrigo Henrique (rodrigohenriquecc)" -ForegroundColor Cyan
Write-Host "🌐 Site: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
Write-Host ""

# Verifica se o Git está instalado
try {
    $gitVersion = git --version 2>$null
    Write-Host "✅ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git não encontrado! Instalando..." -ForegroundColor Red
    Write-Host "💡 Baixe em: https://git-scm.com/download/win" -ForegroundColor Yellow
    Start-Process "https://git-scm.com/download/win"
    Read-Host "Pressione Enter após instalar o Git"
    exit 1
}

# Verifica se a pasta de dados existe
if (-not (Test-Path $LocalDataPath)) {
    Write-Host "❌ Pasta de dados não encontrada: $LocalDataPath" -ForegroundColor Red
    exit 1
}

# Remove diretório temporário se existir
if (Test-Path $GitRepoPath) {
    Write-Host "🗑️ Limpando diretório temporário..." -ForegroundColor Yellow
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Clona o repositório
Write-Host "📥 Conectando ao repositório GitHub..." -ForegroundColor Cyan
try {
    # Configura credenciais Git
    git config --global user.name "Rodrigo Henrique"
    git config --global user.email "rodrigohc@live.com"
    git config --global credential.helper store
    
    # Cria URL com credenciais
    $repoWithAuth = "https://rodrigohenriquecc:@rHcc_1993@github.com/rodrigohenriquecc/dr02-map-site.git"
    
    # Clona o repositório
    git clone $repoWithAuth $GitRepoPath 2>$null
    
    if (-not (Test-Path $GitRepoPath)) {
        throw "Falha ao clonar repositório"
    }
    
    Set-Location $GitRepoPath
    Write-Host "✅ Repositório clonado com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao conectar com GitHub" -ForegroundColor Red
    Write-Host "💡 Verifique suas credenciais e conexão com internet" -ForegroundColor Yellow
    Read-Host "Pressione Enter para continuar"
    exit 1
}

# Verifica/cria pasta DadosSite no repositório
$RepoDataPath = Join-Path $GitRepoPath "DadosSite"
if (-not (Test-Path $RepoDataPath)) {
    Write-Host "📁 Criando pasta DadosSite no repositório..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $RepoDataPath -Force | Out-Null
}

# Lista de arquivos CSV obrigatórios
$csvFiles = @("meta.csv", "pontos_interesse.csv", "mapa_calor.csv", "linhas_trecho.csv")

Write-Host "📋 Verificando arquivos CSV..." -ForegroundColor Cyan
$filesChanged = $false
$filesFound = 0

foreach ($file in $csvFiles) {
    $sourcePath = Join-Path $LocalDataPath $file
    $destPath = Join-Path $RepoDataPath $file
    
    if (Test-Path $sourcePath) {
        $filesFound++
        
        # Verifica se precisa atualizar
        $needsCopy = $true
        if (Test-Path $destPath) {
            $sourceHash = (Get-FileHash $sourcePath -Algorithm MD5).Hash
            $destHash = (Get-FileHash $destPath -Algorithm MD5).Hash
            $needsCopy = $sourceHash -ne $destHash
        }
        
        if ($needsCopy) {
            Copy-Item $sourcePath $destPath -Force
            Write-Host "  ✅ $file → Atualizado" -ForegroundColor Green
            $filesChanged = $true
        } else {
            Write-Host "  ⏩ $file → Sem alterações" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ $file → NÃO ENCONTRADO" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Resumo: $filesFound de $($csvFiles.Count) arquivos encontrados" -ForegroundColor Cyan

if ($filesFound -eq 0) {
    Write-Host "❌ Nenhum arquivo CSV encontrado na pasta local!" -ForegroundColor Red
    Write-Host "💡 Verifique se os arquivos estão em: $LocalDataPath" -ForegroundColor Yellow
    Set-Location $WorkspaceRoot
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Pressione Enter para continuar"
    exit 1
}

if (-not $filesChanged) {
    Write-Host "✨ Todos os arquivos estão atualizados no GitHub!" -ForegroundColor Green
    Write-Host "🌐 Site: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
    Set-Location $WorkspaceRoot
    Remove-Item $GitRepoPath -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Pressione Enter para continuar"
    exit 0
}

# Envia alterações para GitHub
Write-Host "📤 Enviando alterações para GitHub..." -ForegroundColor Cyan

try {
    # Adiciona todos os arquivos da pasta DadosSite
    git add DadosSite/ 2>$null
    
    # Verifica se há mudanças
    $status = git status --porcelain 2>$null
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "✨ Nenhuma mudança detectada pelo Git" -ForegroundColor Green
    } else {
        # Faz commit
        git commit -m $CommitMessage 2>$null
        
        # Faz push
        git push origin $BranchName 2>$null
        
        Write-Host "🎉 SUCESSO! Dados sincronizados com GitHub!" -ForegroundColor Green
        Write-Host "🌐 Site será atualizado em: https://rodrigohenriquecc.github.io/dr02-map-site" -ForegroundColor Cyan
        Write-Host "⏱️ Aguarde 2-3 minutos para a