# 📋 Documentação: Nova Estrutura da Planilha de Pontos de Interesse

## 🏗️ Estrutura das Colunas

### 1. **tipo** (Texto)
- **Descrição**: Tipo ou categoria do ponto de interesse
- **Exemplos**: 
  - "Material fresado"
  - "Obra em andamento"
  - "Área de risco"
  - "Manutenção preventiva"
  - "Sinalização nova"
  - "Pavimentação"

### 2. **rodovia** (Texto)
- **Descrição**: Nome da rodovia onde está localizado o ponto
- **Formato**: SP XXX (ex: SP 079, SP 070)
- **Integração**: Será linkado com as planilhas de navegação e arquivos KMZ existentes

### 3. **km** (Número)
- **Descrição**: Quilometragem específica na rodovia
- **Formato**: Decimal com ponto (ex: 61.000, 45.500, 78.200)
- **Integração**: Será linkado com as planilhas de navegação e arquivos KMZ existentes

### 4. **obs** (Texto)
- **Descrição**: Observações adicionais sobre o ponto
- **Exemplos**:
  - "25/06/2025 Vol. aprox: 100m³"
  - "Ponte em construção - Previsão: 30/08/2025"
  - "Deslizamento de terra - Monitoramento contínuo"

### 5. **cor** (Código Hexadecimal)
- **Descrição**: Cor do círculo no mapa
- **Formato**: #RRGGBB (ex: #FF0000, #FFA500, #00FF00)
- **Cores Sugeridas**:
  - `#FF0000` - Vermelho (Urgente/Crítico)
  - `#FFA500` - Laranja (Atenção)
  - `#FFFF00` - Amarelo (Cuidado)
  - `#00FF00` - Verde (Concluído/OK)
  - `#0066FF` - Azul (Informativo)
  - `#8A2BE2` - Roxo (Especial)

### 6. **opacidade** (Número de 0 a 1)
- **Descrição**: Transparência do círculo
- **Valores**:
  - `1` - Totalmente opaco
  - `0.8` - Pouco transparente
  - `0.5` - Semi-transparente
  - `0.3` - Muito transparente
  - `0` - Totalmente transparente

### 7. **raio** (Número em metros)
- **Descrição**: Tamanho do círculo no mapa
- **Unidade**: Metros
- **Exemplos**:
  - `100` - Círculo pequeno
  - `200` - Círculo médio
  - `400` - Círculo grande
  - `800` - Círculo muito grande

### 8. **fotos** (URL do Google Drive - Opcional)
- **Descrição**: Link para pasta do Google Drive com fotos do local
- **Formato**: URL completa da pasta compartilhada
- **Exemplo**: `https://drive.google.com/drive/folders/1EkXAUCiwetSQmbgzuRXcZwuX0IZQeOhC?usp=drive_link`
- **Nota**: Deixar em branco se não houver fotos

## 🔗 Integração com Sistema Existente

### Localização por Rodovia + KM
O sistema irá:
1. Buscar na planilha "PLANILHA BI - OFICIAL.csv" as coordenadas correspondentes à rodovia e km especificados
2. Se encontrar uma correspondência exata (ou muito próxima), usará essas coordenadas
3. Se não encontrar, tentará fazer uma interpolação entre pontos próximos
4. Como fallback, pode usar coordenadas diretas (Latitude/Longitude) se fornecidas

### Visualização no Mapa
- **Círculo**: Desenhado com a cor, opacidade e raio especificados
- **Marcador Central**: Pequeno marcador no centro do círculo
- **InfoWindow**: Popup com todas as informações quando clicado
- **Fotos**: Botões para acessar galeria no Google Drive

## 📝 Exemplo Prático

```csv
tipo,rodovia,km,obs,cor,opacidade,raio,fotos
Material fresado,SP 079,61.000,25/06/2025 Vol. aprox: 100m³,#FF0000,1,400,https://drive.google.com/drive/folders/1EkXAUCiwetSQmbgzuRXcZwuX0IZQeOhC?usp=drive_link
```

Este exemplo criará:
- Um círculo vermelho (`#FF0000`)
- Totalmente opaco (`1`)
- Com raio de 400 metros
- Na rodovia SP 079, km 61
- Com observações sobre volume de material
- Com link para fotos no Google Drive

## 🎨 Dicas de Uso

### Cores por Categoria
- **🔴 Emergencial**: #FF0000 (Vermelho)
- **🟠 Atenção**: #FFA500 (Laranja)
- **🟡 Cuidado**: #FFFF00 (Amarelo)
- **🟢 Concluído**: #00FF00 (Verde)
- **🔵 Informativo**: #0066FF (Azul)
- **🟣 Especial**: #8A2BE2 (Roxo)

### Raios Recomendados
- **Sinalização**: 50-100m
- **Manutenção**: 150-250m
- **Obras**: 300-500m
- **Áreas de risco**: 400-800m

### Opacidade por Prioridade
- **Alta prioridade**: 0.9-1.0
- **Média prioridade**: 0.6-0.8
- **Baixa prioridade**: 0.3-0.5

## 🔧 Configuração no Google Sheets

1. Crie uma planilha com as colunas exatas: `tipo`, `rodovia`, `km`, `obs`, `cor`, `opacidade`, `raio`, `fotos`
2. Torne a planilha pública para visualização
3. Obtenha o ID da planilha e GID da aba
4. Configure no sistema usando esses IDs

## 📱 Funcionalidades Integradas

- ✅ Visualização com círculos personalizados
- ✅ Cores e tamanhos configuráveis
- ✅ Integração com dados de rodovias existentes
- ✅ Links para fotos no Google Drive
- ✅ InfoWindows detalhados
- ✅ Navegação direta pelo Google Maps
- ✅ Toggle on/off dos pontos
- ✅ Zoom automático nos pontos ativos
