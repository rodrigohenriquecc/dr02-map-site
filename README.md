# DR.02 - Site de Mapa Interativo

Este repositório contém um site estático que exibe:

* **Seis shapefiles de regiões do DR.02** (RC 2.1, RC 2.2, RC 2.4, RC 2.5, RC 2.6+2.8 e RC 2.7) com cores semi‑transparentes.
* **Malha completa das rodovias do DR.02**, traçada a partir de um arquivo Excel (`PLANILHA BI - OFICIAL.xlsx`) contendo KMs, coordenadas e municípios.
* **Filtros de visualização** para ligar/desligar cada região e cada rodovia.

Tudo roda **100 % no front‑end** (Leaflet + SheetJS). Não há dependências de servidor ou build step.

## Estrutura de pastas

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── data/
│   ├── PLANILHA BI - OFICIAL.xlsx
│   ├── RC 2.1.zip
│   ├── RC 2.2.zip
│   ├── RC 2.4.zip
│   ├── RC 2.5.zip
│   ├── RC 2.6+2.8.zip
│   └── RC 2.7.zip
└── README.md
```

Coloque seu **Excel** e os **shapefiles zip** dentro da pasta `data/` com exatamente os nomes acima.

> **Obs.:** Cada ZIP deve conter todos os arquivos do shapefile (`.shp`, `.dbf`, `.prj`, etc.).

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
