# DR.02 - Sistema de Localização de Rodovias e KM## Como usar localmente

1. **Clone ou baixe** este repositório
2. **Abra `index.html`** diretamente no navegador ou use um servidor local:
   ```bash
   # Usando Python
   python -m http.server 8080
   
   # Usando Node.js
   npx serve .
   
   # Usando PHP
   php -S localhost:8080
   ```
3. Acesse `http://localhost:8080` no navegador

## Como usar o sistema

1. **Clique no botão "🔍 Localizar Km"** no canto superior direito
2. **Selecione a rodovia** no dropdown
3. **Escolha o KM** desejado na lista
4. **Clique em "Mostrar no mapa"** para visualizar o ponto
5. Use o **link do Google Maps** para navegação externa

## Deploy automático no GitHub Pages

Este projeto está configurado para deploy automático no GitHub Pages. Após fazer push das alterações, o site será atualizado automaticamente em poucos minutos.rio contém um site interativo que exibe:

* **Mapa interativo das rodovias do DR.02** com sistema de localização por KM
* **Busca de pontos específicos** nas rodovias com coordenadas GPS
* **Visualização de dados geográficos** através de shapefiles e arquivos KMZ
* **Interface responsiva** que funciona em desktop e mobile
* **Links diretos para Google Maps** para cada ponto localizado

Tudo roda **100% no front-end** (Leaflet + bibliotecas JavaScript). Não há dependências de servidor ou build step. Site de Mapa Interativo

Este repositório contém um site estático que exibe:

* **Seis shapefiles de regiões do DR.02** (RC 2.1, RC 2.2, RC 2.4, RC 2.5, RC 2.6+2.8 e RC 2.7) com cores semi‑transparentes.
* **Malha completa das rodovias do DR.02**, traçada a partir de um arquivo Excel (`PLANILHA BI - OFICIAL.xlsx`) contendo KMs, coordenadas e municípios.
* **Filtros de visualização** para ligar/desligar cada região e cada rodovia.

Tudo roda **100 % no front‑end** (Leaflet + SheetJS). Não há dependências de servidor ou build step.

## Estrutura de pastas

```
/
├── index.html              # Página principal com interface completa
├── favicon.ico             # Ícone do site
├── meta.csv               # Dados de metadados
├── css/
│   └── style.css          # Estilos personalizados
├── js/
│   ├── script.js          # Script principal
│   └── script_backup.js   # Backup do script
└── data/
    ├── malha_dr02.kmz     # Arquivo KMZ com malha rodoviária
    ├── RC_2.1.zip         # Dados RC 2.1
    ├── RC_2.2.zip         # Dados RC 2.2
    ├── RC_2.4.zip         # Dados RC 2.4
    ├── RC_2.5.zip         # Dados RC 2.5
    ├── RC_2.6_2.8.zip     # Dados RC 2.6 e 2.8
    └── RC_2.7.zip         # Dados RC 2.7
```

## Funcionalidades

- **🔍 Localização de KM**: Sistema de busca que permite localizar qualquer quilômetro em rodovias específicas
- **📍 Coordenadas GPS**: Cada ponto exibe coordenadas precisas com link para Google Maps
- **🗺️ Visualização de dados**: Carregamento automático de shapefiles e arquivos KMZ
- **📱 Interface responsiva**: Funciona perfeitamente em dispositivos móveis
- **🎯 Marcadores customizados**: Destaque visual para pontos localizados

## Como testar localmente

1. Baixe/clone o repositório.
2. Coloque `PLANILHA BI - OFICIAL.xlsx` e os arquivos `RC *.zip` em `/data/`.
3. **Abra `index.html` em um navegador** ou rode um servidor estático, por exemplo:
   ```bash
   npx serve .
   # ou
   python -m http.server 8080
   ```
   Depois acesse `http://localhost:8080`.

## Deploy no GitHub Pages

1. Crie um novo repositório no GitHub (por exemplo, `dr02-map-site`).
2. Faça **push** de todos os arquivos do projeto (inclusive a pasta `data/`):
   ```bash
   git init
   git add .
   git commit -m "Site de mapa DR.02"
   git remote add origin https://github.com/<SEU_USUARIO>/dr02-map-site.git
   git push -u origin main
   ```
3. No GitHub, vá em **Settings ▸ Pages**, selecione a branch **`main`** e a pasta **`/ (root)`**. Salve.
4. Após alguns segundos, seu site estará disponível em  
   `https://<SEU_USUARIO>.github.io/dr02-map-site/`.

## Créditos & Licenças

* [Leaflet](https://leafletjs.com) – BSD 2‑Clause
* [leaflet‑omnivore](https://github.com/mapbox/leaflet-omnivore) – BSD
* [SheetJS](https://github.com/SheetJS/sheetjs) – Apache‑2.0
* Mosaico base: © OpenStreetMap contributors (ODbL) / tiles via openstreetmap.org

---

Desenvolvido para DR.02 – Exemplo de uso em engenharia rodoviária.
