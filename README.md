# 🗺️ CGR 02 - Sistema de Localização

Sistema de mapeamento e geolocalização em tempo real para a CGR 02, desenvolvido com Google Maps JavaScript API.

## ✨ Funcionalidades

- 🌍 **Mapa Google Maps** com visualização profissional
- 📍 **Geolocalização em tempo real** - rastreamento GPS preciso
- 🗂️ **Shapefiles das RCs** - polígonos das regiões com labels
- 🛣️ **Malha rodoviária KMZ** - visualização das rodovias
- 📊 **Pontos de interesse** - marcadores interativos
- 🔥 **Mapa de calor** - visualização de dados térmicos
- 🔍 **Filtros inteligentes** - busca por rodovia e KM
- 📱 **Design responsivo** - otimizado para mobile e desktop
- 📈 **Integração com planilhas** - links diretos para Google Sheets

## 🚀 Tecnologias Utilizadas

- **Google Maps JavaScript API** v3
- **HTML5 Geolocation API**
- **JavaScript ES6+**
- **CSS3 com Flexbox/Grid**
- **Papa Parse** (processamento CSV)
- **JSZip** (arquivos comprimidos)
- **shpjs** (shapefiles)
- **toGeoJSON** (conversão KMZ)

## 📋 Pré-requisitos

- Chave de API do Google Maps Platform
- Navegador moderno com suporte a HTML5
- Conexão com internet para carregar os dados

## ⚙️ Configuração

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SEU_USUARIO/NOME_DO_REPO.git
   ```

2. **Configure a chave da API:**
   - Substitua `AIzaSyDRkRnlqb3o5wZQzc9qrOv-9vRZY27eDKQ` no `index.html`
   - Configure as restrições no Google Cloud Console

3. **Abra o arquivo:**
   ```
   index.html
   ```

## 🎯 Como Usar

### Geolocalização
- Clique no botão verde 📍 no canto inferior direito
- Autorize o acesso à localização quando solicitado
- Sua posição será mostrada em tempo real no mapa

### Filtros de Localização
- Use o painel esquerdo para selecionar uma rodovia
- Escolha um KM específico
- Clique em "Localizar" para navegar até o ponto

### Acesso às Planilhas
- Use os botões no canto superior direito
- Links diretos para os dados no Google Sheets

## 📁 Estrutura do Projeto

```
├── index.html                      # Página principal
├── archives/
│   └── assets/
│       ├── js/
│       │   └── script_google_maps.js    # Sistema completo
│       └── data/
│           ├── *.csv               # Dados CSV
│           ├── *.kmz               # Malha rodoviária
│           └── RC_*.zip            # Shapefiles das RCs
├── .gitignore                      # Arquivos ignorados
└── README.md                       # Documentação
```

## 🌐 Demo Online

Acesse: [https://SEU_USUARIO.github.io/NOME_DO_REPO](https://SEU_USUARIO.github.io/NOME_DO_REPO)

## 📱 Responsividade

- ✅ **Desktop** - Interface completa
- ✅ **Tablet** - Layout adaptado
- ✅ **Mobile** - Controles otimizados

## 🔒 Segurança

- Chave de API restrita por domínio
- Validação de dados de entrada
- HTTPS recomendado para produção

## 📊 Dados Suportados

- **Shapefiles** (.zip) - RCs
- **KMZ** - Malha rodoviária
- **CSV** - Pontos, calor, linhas

## 🛠️ Desenvolvimento

### Estrutura Modular
- `initMap()` - Inicialização básica
- `carregarSistemaCompleto()` - Carregamento avançado
- Funções específicas para cada tipo de dado

### Performance
- Carregamento assíncrono
- Otimização para dispositivos móveis
- Cache de dados quando possível

## 📧 Contato

**Desenvolvedor:** [Seu Nome]  
**Email:** seu.email@gmail.com  
**Projeto:** CGR 02 - Sistema de Localização

## 📄 Licença

Este projeto é licenciado sob a [MIT License](LICENSE).

---

⭐ **Se este projeto foi útil, deixe uma estrela!**
